import { useState, useCallback, useEffect, useRef } from 'react';
import { sftpApi, type FileInfo, type TransferProgressMessage } from '@/lib/api/sftp';
import { getWsUrl } from '@/lib/config';
import { createAuthTicket } from '@/lib/auth-ticket';
import { useAuthStore } from '@/stores/auth-store';
import {
  createServerTransferTask,
  createUploadTransferTask,
  mapTransferProgressMessageToTaskUpdate,
  mapUploadProgressMessageToTransferUpdate,
  mapUploadTaskStatusToTransferTask,
  mergeTransferTaskUpdate,
  type UploadProgressMessageLike,
  type TransferTask,
} from '@/lib/session/transfer-tasks';
import {
  cancelTransferRuntimeTask,
  clearTransferRuntimeTaskHandles,
  consumeTransferCancelledBeforeStart,
  createTransferConcurrencyLimiter,
  createTransferRuntimeHandleStore,
  createTransferProgressWebSocket,
  isTransferCancellationRequested,
  registerTransferWebSocket,
  registerTransferXhr,
  releaseTransferRuntimeTaskHandles,
  waitForTransferWebSocketOpen,
  type ReleaseTransferRuntimeSlot,
  type TransferAuthTicketProvider,
  type TransferConcurrencyLimiter,
  type TransferRuntimeHandleStore,
  type TransferWebSocketConstructor,
  type TransferWebSocketUrlResolver,
} from '@/lib/session/transfer-runtime';

/**
 * 传输任务接口。UI 与 Workspace 共享同一份任务合约，避免 hook 和可嵌入组件漂移。
 */
export type { TransferTask }

export interface FileTransferSftpApi {
  createUploadTask: () => Promise<{ task_id: string }>;
  listUploadTasks: typeof sftpApi.listUploadTasks;
  cancelUploadTask: (taskId: string) => Promise<unknown>;
  uploadFile: typeof sftpApi.uploadFile;
  directTransfer: typeof sftpApi.directTransfer;
  cancelTransfer: (taskId: string) => Promise<unknown>;
}

export interface UseFileTransferOptions {
  api?: FileTransferSftpApi;
  createTicket?: TransferAuthTicketProvider;
  resolveWebSocketUrl?: TransferWebSocketUrlResolver;
  WebSocketCtor?: TransferWebSocketConstructor;
  uploadLimiter?: TransferConcurrencyLimiter;
}

/**
 * 文件传输Hook
 * 管理文件上传下载任务和进度
 */
export function useFileTransfer({
  api = sftpApi,
  createTicket = createAuthTicket,
  resolveWebSocketUrl = getWsUrl,
  WebSocketCtor,
  uploadLimiter: providedUploadLimiter,
}: UseFileTransferOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const transferHandlesRef = useRef<TransferRuntimeHandleStore | null>(null);
  const transferHandles = transferHandlesRef.current ?? createTransferRuntimeHandleStore();
  if (!transferHandlesRef.current) {
    transferHandlesRef.current = transferHandles;
  }

  const defaultUploadLimiterRef = useRef<TransferConcurrencyLimiter | null>(null);
  const defaultUploadLimiter = defaultUploadLimiterRef.current ?? createTransferConcurrencyLimiter();
  if (!defaultUploadLimiterRef.current) {
    defaultUploadLimiterRef.current = defaultUploadLimiter;
  }
  const uploadLimiter = providedUploadLimiter ?? defaultUploadLimiter;

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;

    void api.listUploadTasks()
      .then((response) => {
        if (cancelled) return;

        const uploadTasks = response.tasks
          .filter((task) => task.status === 'pending' || task.status === 'uploading')
          .map((task) => mapUploadTaskStatusToTransferTask(task));
        if (uploadTasks.length === 0) return;

        setTasks((prev) => {
          const existingIds = new Set(prev.map((task) => task.id));
          const merged = [...prev];

          for (const task of uploadTasks) {
            if (existingIds.has(task.id)) {
              continue;
            }
            merged.push(task);
          }

          return merged;
        });
      })
      .catch((err) => {
        console.warn('[useFileTransfer] Failed to load upload tasks:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, api]);

  /**
   * 更新任务进度
   */
  const updateTaskProgress = useCallback((taskId: string, update: Partial<TransferTask>) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? mergeTransferTaskUpdate(task, update) : task
      )
    );
  }, []);

  /**
   * 上传文件（支持 WebSocket 进度跟踪）
   */
  const uploadFile = useCallback(
    async (
      serverId: string,
      remotePath: string,
      file: File,
      onProgress?: (loaded: number, total: number) => void,
      enableWebSocket?: boolean // 是否启用 WebSocket 进度跟踪
    ): Promise<FileInfo | null> => {
      // 新上传链路始终由服务端生成 task_id，作为进度订阅、取消、任务恢复的统一中心。
      const created = await api.createUploadTask()
      const taskId = created.task_id

      const task = createUploadTransferTask({
        taskId,
        fileName: file.name,
        fileSizeBytes: file.size,
      })
      setTasks(prev => [...prev, task]);

      // 获取上传并发许可：排队等待，避免瞬间并发过高
      let releaseSlot: ReleaseTransferRuntimeSlot | null = null;
      try {
        releaseSlot = await uploadLimiter.acquire();
      } catch {
        // 理论上不会失败；兜底
      }

      // 如果在排队期间被用户取消，则直接结束
      if (consumeTransferCancelledBeforeStart(transferHandles, task.id)) {
        updateTaskProgress(task.id, {
          status: 'cancelled',
          error: '已取消',
        });
        releaseSlot?.();
        return null;
      }

      // WebSocket 连接引用
      let wsConnection: WebSocket | null = null;

      try {
        // 如果启用 WebSocket，先建立连接
        if (enableWebSocket) {
          try {
            wsConnection = await createTransferProgressWebSocket({
              kind: 'upload',
              taskId: task.id,
              createTicket,
              resolveWebSocketUrl,
              WebSocketCtor,
            });
            // 记录 WebSocket 连接,以支持取消时发送控制消息
            registerTransferWebSocket(transferHandles, task.id, wsConnection);
          } catch (err) {
            console.warn('[useFileTransfer] Failed to create upload WS ticket, fallback to non-WS upload:', err);
          }

          if (wsConnection) {
            // WebSocket 消息处理
            wsConnection.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data) as UploadProgressMessageLike;
                const mapped = mapUploadProgressMessageToTransferUpdate(msg, {
                  fileSizeBytes: file.size,
                });

                if (mapped.update) {
                  updateTaskProgress(task.id, mapped.update);
                }
                if (mapped.progressEvent) {
                  onProgress?.(mapped.progressEvent.loaded, mapped.progressEvent.total);
                }
                if (mapped.isError) {
                  console.error('[useFileTransfer] SFTP error:', mapped.errorMessage);
                }
              } catch (err) {
                console.error('[useFileTransfer] Failed to parse WS message:', err);
              }
            };

            wsConnection.onerror = (err) => {
              console.error('[useFileTransfer] WebSocket error:', err);
            };

          }

          // 等待 WebSocket 连接（最多 2 秒）
          if (wsConnection) {
            await waitForTransferWebSocketOpen(wsConnection, { timeoutMs: 2000 });
          }
        }

        // 浏览器到后端这一段仍由 XHR 提供客户端侧发送进度；后端 WebSocket 提供远端写入确认进度。
        const httpProgressCallback = (loaded: number, total: number) => {
          const progress = Math.round((loaded / total) * 100);
          const displayLoaded = Math.min(loaded, file.size);
          updateTaskProgress(task.id, {
            progress,
            bytesTransferred: displayLoaded,
            status: 'uploading',
            stage: 'stream',
          });
          onProgress?.(loaded, total);
        };

        // 调用 API 上传（传递任务 ID 以便后端推送 SFTP 进度，并保存 xhr 以支持取消）
        const fileInfo = await api.uploadFile(
          serverId,
          remotePath,
          file,
          httpProgressCallback,
          task.id,
          (xhr) => {
            registerTransferXhr(transferHandles, task.id, xhr);
          }
        );

        // HTTP 请求返回即代表后端已经完成远端写入；即便 WebSocket 丢了也能收敛到完成态。
        updateTaskProgress(task.id, {
          progress: 100,
          status: 'completed',
          bytesTransferred: file.size,
          stage: 'stream',
        });
        return fileInfo ?? null

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isAborted =
          message === 'Upload aborted' ||
          message.toLowerCase().includes('upload cancelled');

        updateTaskProgress(task.id, {
          status: isAborted ? 'cancelled' : 'failed',
          error: isAborted ? '已取消' : (message || '上传失败'),
        });

        // 对于用户主动取消,不再向上传抛错,避免外层弹“失败”提示
        if (isAborted) {
          return null;
        }
        throw error;
      } finally {
        releaseSlot?.();
        releaseTransferRuntimeTaskHandles(transferHandles, task.id, {
          closeWebSocket: !!wsConnection,
          includeConnecting: true,
        });
      }
    },
    [api, transferHandles, uploadLimiter, updateTaskProgress, createTicket, resolveWebSocketUrl, WebSocketCtor]
  );

  /**
   * 取消任务
   */
  const cancelTask = useCallback((taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    void cancelTransferRuntimeTask({
      handles: transferHandles,
      taskId,
      task,
      cancelUploadTask: api.cancelUploadTask,
      cancelServerTransfer: api.cancelTransfer,
      markCancelled: (cancelledTaskId) => {
        setTasks(prev =>
          prev.map(task =>
            task.id === cancelledTaskId
              ? { ...task, status: 'cancelled', error: '已取消' }
              : task
          )
        );
      },
      logError: (message, err) => {
        console.error(message.replace('[transfer-runtime]', '[useFileTransfer]'), err);
      },
    });
  }, [api, tasks, transferHandles]);

  /**
   * 删除任务
   */
  const removeTask = useCallback((taskId: string) => {
    cancelTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, [cancelTask]);

  /**
   * 清除已完成/失败的任务
   */
  const clearCompleted = useCallback(() => {
    const completedTaskIds = tasks
      .filter(
        t =>
          t.status === 'completed' ||
          t.status === 'failed' ||
          t.status === 'cancelled'
      )
      .map(t => t.id);
    clearTransferRuntimeTaskHandles(transferHandles, {
      taskIds: completedTaskIds,
      abortXhrs: false,
    });
    setTasks(prev =>
      prev.filter(
        t =>
          t.status !== 'completed' &&
          t.status !== 'failed' &&
          t.status !== 'cancelled'
      )
    );
  }, [tasks, transferHandles]);

  /**
   * 清除所有任务
   */
  const clearAll = useCallback(() => {
    const activeTasks = tasks.filter(
      task =>
        task.status === 'pending' ||
        task.status === 'uploading' ||
        task.status === 'downloading' ||
        task.status === 'transferring'
    );
    activeTasks.forEach(task => {
      void cancelTransferRuntimeTask({
        handles: transferHandles,
        taskId: task.id,
        task,
        cancelUploadTask: api.cancelUploadTask,
        cancelServerTransfer: api.cancelTransfer,
        closeWebSocket: true,
        logError: (message, err) => {
          console.error(message.replace('[transfer-runtime]', '[useFileTransfer]'), err);
        },
      });
    });
    clearTransferRuntimeTaskHandles(transferHandles, {
      taskIds: tasks.map(task => task.id),
      clearCancellationMarkers: false,
    });
    setTasks([]);
  }, [api, tasks, transferHandles]);

  /**
   * 创建跨服务器传输任务
   */
  const createTransferTask = useCallback((
    fileName: string,
    sourceServer: string,
    targetServer: string
  ): TransferTask => {
    return createServerTransferTask({
      fileName,
      sourceServer,
      targetServer,
    });
  }, []);

  /**
   * 添加传输任务到列表
   */
  const addTask = useCallback((task: TransferTask) => {
    setTasks(prev => [...prev, task]);
  }, []);

  /**
   * 更新任务状态
   */
  const updateTask = useCallback((taskId: string, update: Partial<TransferTask>) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, ...update } : task
      )
    );
  }, []);

  /**
   * 跨服务器直连传输（rsync/scp）
   * 启动后台传输任务，通过 WebSocket 实时推送进度
   */
  const directTransfer = useCallback(
    async (
      sourceServerId: string,
      sourcePath: string,
      targetServerId: string,
      targetPath: string,
      sourceServerName: string,
      targetServerName: string,
      fileName: string
    ): Promise<void> => {
      // 先发起任务，由服务端生成 task_id（避免客户端自带 task_id）
      const started = await api.directTransfer(
        sourceServerId,
        sourcePath,
        targetServerId,
        targetPath,
      )
      const taskId = started.task_id

      const task = createServerTransferTask({
        taskId,
        fileName,
        sourceServer: sourceServerName,
        targetServer: targetServerName,
      });

      setTasks(prev => [...prev, task]);

      // WebSocket 连接
      let wsConnection: WebSocket | null = null;
      // 标记传输是否已完成（用于区分正常关闭和异常关闭）
      let transferFinished = false;

      try {
        // 建立 WebSocket 连接获取进度
        wsConnection = await createTransferProgressWebSocket({
          kind: 'serverTransfer',
          taskId,
          createTicket,
          resolveWebSocketUrl,
          WebSocketCtor,
        });
        registerTransferWebSocket(transferHandles, taskId, wsConnection);

        // 创建传输完成 Promise（需要在连接建立前设置，以便捕获所有事件）
        let resolveTransfer: () => void;
        let rejectTransfer: (error: Error) => void;
        const transferComplete = new Promise<void>((resolve, reject) => {
          resolveTransfer = resolve;
          rejectTransfer = reject;
        });

        // 设置所有事件处理器（在连接建立前就设置好）
        wsConnection.onmessage = (event) => {
          try {
            const msg: TransferProgressMessage = JSON.parse(event.data);
            const update = mapTransferProgressMessageToTaskUpdate(msg);

            if (update) {
              updateTask(taskId, update);
            }

            if (msg.type === 'complete') {
              transferFinished = true;
              resolveTransfer();
            } else if (msg.type === 'error') {
              transferFinished = true;
              rejectTransfer(new Error(msg.message || '传输失败'));
            } else if (msg.type === 'cancelled') {
              transferFinished = true;
              resolveTransfer(); // 取消不视为错误
            }
          } catch (err) {
            console.error('[useFileTransfer] Failed to parse WS message:', err);
          }
        };

        wsConnection.onerror = (err) => {
          console.error('[useFileTransfer] WebSocket error:', err);
        };

        wsConnection.onclose = (event) => {
          if (isTransferCancellationRequested(transferHandles, taskId)) {
            transferFinished = true;
            resolveTransfer();
            return;
          }

          // WebSocket 关闭时，如果传输还未完成，视为失败
          // 但如果已经收到了完成/错误/取消消息，则不处理
          if (!transferFinished) {
            console.warn('[useFileTransfer] WebSocket closed unexpectedly:', event.code, event.reason);
            setTasks(prev => {
              const currentTask = prev.find(t => t.id === taskId);
              if (currentTask && currentTask.status === 'transferring') {
                return prev.map(t =>
                  t.id === taskId
                    ? { ...t, status: 'failed' as const, error: '连接断开' }
                    : t
                );
              }
              return prev;
            });
            rejectTransfer(new Error('连接断开'));
          }
        };

        // 等待 WebSocket 连接建立
        await waitForTransferWebSocketOpen(wsConnection, {
          timeoutMs: 5000,
          rejectOnError: true,
        });

        // 等待传输完成
        await transferComplete;

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isCancelled = message.includes('取消') || message.includes('cancelled');

        if (!isCancelled && !transferFinished) {
          updateTask(taskId, {
            status: 'failed',
            error: message || '传输失败',
          });
          throw error;
        }
      } finally {
        // 清理 WebSocket 连接
        if (wsConnection) {
          releaseTransferRuntimeTaskHandles(transferHandles, taskId, {
            closeWebSocket: true,
            includeConnecting: true,
          });
        }
      }
    },
    [api, transferHandles, updateTask, createTicket, resolveWebSocketUrl, WebSocketCtor]
  );

  /**
   * 取消直连传输任务
   */
  const cancelDirectTransfer = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    await cancelTransferRuntimeTask({
      handles: transferHandles,
      taskId,
      task: task ?? { id: taskId, type: 'transfer', status: 'transferring' },
      cancelServerTransfer: api.cancelTransfer,
      markCancelled: (cancelledTaskId) => {
        updateTask(cancelledTaskId, {
          status: 'cancelled',
          error: '已取消',
        });
      },
      logError: (message, err) => {
        console.error(message.replace('[transfer-runtime]', '[useFileTransfer]'), err);
      },
    });
  }, [api, tasks, transferHandles, updateTask]);

  return {
    tasks,
    uploadFile,
    cancelTask,
    removeTask,
    clearCompleted,
    clearAll,
    // 跨服务器传输相关
    createTransferTask,
    addTask,
    updateTask,
    // 直连传输相关
    directTransfer,
    cancelDirectTransfer,
  };
}
