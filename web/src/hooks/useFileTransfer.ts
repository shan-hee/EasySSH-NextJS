import { useState, useCallback, useRef } from 'react';
import { formatSpeed, formatRemainingTime, formatBytesString } from '@/lib/format-utils';
import { sftpApi, type FileInfo, type TransferProgressMessage } from '@/lib/api/sftp';
import { getWsUrl } from '@/lib/config';
import { createAuthTicket } from '@/lib/auth-ticket';

/**
 * 传输任务接口
 */
export interface TransferTask {
  id: string;
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  progress: number;
  status: 'pending' | 'uploading' | 'downloading' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  type: 'upload' | 'download' | 'transfer'; // transfer = 跨服务器传输
  speed?: string;
  timeRemaining?: string;
  error?: string;
  startTime?: number;
  bytesTransferred?: number;
  stage?: 'http' | 'sftp'; // 当前传输阶段
  // 跨服务器传输专用字段
  sourceServer?: string;
  targetServer?: string;
  transferMethod?: 'rsync' | 'scp' | 'sftp'; // 直连传输方式
}

/**
 * 文件传输Hook
 * 管理文件上传下载任务和进度
 */
export function useFileTransfer() {
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const xhrRefs = useRef<Map<string, XMLHttpRequest>>(new Map());
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());
  const cancelledBeforeStartRef = useRef<Set<string>>(new Set());

  // 客户端侧并发限制：避免一次性发起过多上传压垮本地/服务端
  const MAX_CONCURRENT_UPLOADS = 3;
  const uploadSemaphoreRef = useRef<{ active: number; queue: Array<() => void> }>({
    active: 0,
    queue: [],
  });

  const acquireUploadSlot = useCallback((): Promise<() => void> => {
    return new Promise((resolve) => {
      const state = uploadSemaphoreRef.current;
      const grant = () => {
        state.active += 1;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          state.active -= 1;
          const next = state.queue.shift();
          if (next) next();
        });
      };
      if (state.active < MAX_CONCURRENT_UPLOADS) {
        grant();
      } else {
        state.queue.push(grant);
      }
    });
  }, []);

  /**
   * 更新任务进度
   */
  const updateTaskProgress = useCallback((taskId: string, update: Partial<TransferTask>) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== taskId) return task;

        const stageChanged = update.stage && update.stage !== task.stage;
        const now = Date.now();

        const updatedTask: TransferTask = {
          ...task,
          ...update,
          // 当阶段从 HTTP 切换到 SFTP（或反之）时，重置计时起点，避免不同阶段混算平均速度
          startTime: stageChanged ? now : task.startTime,
        };

        // 计算速度和剩余时间
        if (updatedTask.bytesTransferred !== undefined && updatedTask.startTime) {
          const elapsedSeconds = (now - updatedTask.startTime) / 1000;
          if (elapsedSeconds > 0) {
            const speed = updatedTask.bytesTransferred / elapsedSeconds;
            updatedTask.speed = formatSpeed(speed);

            const remainingBytes = updatedTask.fileSizeBytes - updatedTask.bytesTransferred;
            if (speed > 0) {
              const remainingSeconds = remainingBytes / speed;
              updatedTask.timeRemaining = formatRemainingTime(remainingSeconds);
            }
          }
        }

        return updatedTask;
      })
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
      // 服务端生成 task_id（避免客户端自带 task_id 造成撞库/窃听）
      let taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      if (enableWebSocket) {
        const created = await sftpApi.createUploadTask()
        taskId = created.task_id
      }

      const task: TransferTask = {
        id: taskId,
        fileName: file.name,
        fileSize: formatBytesString(file.size),
        fileSizeBytes: file.size,
        progress: 0,
        status: 'pending',
        type: 'upload',
        startTime: Date.now(),
        bytesTransferred: 0,
      }
      setTasks(prev => [...prev, task]);

      // 获取上传并发许可：排队等待，避免瞬间并发过高
      let releaseSlot: (() => void) | null = null;
      try {
        releaseSlot = await acquireUploadSlot();
      } catch {
        // 理论上不会失败；兜底
      }

      // 如果在排队期间被用户取消，则直接结束
      if (cancelledBeforeStartRef.current.has(task.id)) {
        cancelledBeforeStartRef.current.delete(task.id);
        updateTaskProgress(task.id, {
          status: 'cancelled',
          error: '已取消',
        });
        releaseSlot?.();
        return null;
      }

      // WebSocket 连接引用
      let wsConnection: WebSocket | null = null;
      let wsConnected = false;

      try {
        // 如果启用 WebSocket，先建立连接
        if (enableWebSocket) {
          try {
            const { ticket } = await createAuthTicket({ type: 'ws_sftp_upload', task_id: task.id })
            const params = new URLSearchParams()
            params.set('ticket', ticket)
            const wsUrl = getWsUrl(`/api/v1/sftp/upload/ws/${task.id}?${params.toString()}`);

            wsConnection = new WebSocket(wsUrl);
            // 记录 WebSocket 连接,以支持取消时发送控制消息
            wsRefs.current.set(task.id, wsConnection);
          } catch (err) {
            console.warn('[useFileTransfer] Failed to create upload WS ticket, fallback to non-WS upload:', err);
          }

          if (wsConnection) {
            // WebSocket 消息处理
            wsConnection.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);

                if (msg.type === 'progress' && msg.stage === 'sftp') {
                  // SFTP 阶段进度更新
                  const progress = Math.round((msg.loaded / msg.total) * 100);
                  updateTaskProgress(task.id, {
                    progress,
                    bytesTransferred: msg.loaded,
                    status: 'uploading',
                    stage: 'sftp',
                    speed: msg.speed_bps ? formatSpeed(msg.speed_bps) : undefined,
                  });
                  onProgress?.(msg.loaded, msg.total);
                } else if (msg.type === 'complete') {
                  // SFTP 传输完成
                  updateTaskProgress(task.id, {
                    progress: 100,
                    status: 'completed',
                    bytesTransferred: file.size,
                    stage: 'sftp',
                  });
                } else if (msg.type === 'cancelled') {
                  // 服务器端 SFTP 阶段已取消
                  updateTaskProgress(task.id, {
                    status: 'cancelled',
                    stage: 'sftp',
                    error: '已取消',
                  });
                } else if (msg.type === 'error') {
                  console.error('[useFileTransfer] SFTP error:', msg.message);
                }
              } catch (err) {
                console.error('[useFileTransfer] Failed to parse WS message:', err);
              }
            };

            wsConnection.onerror = (err) => {
              console.error('[useFileTransfer] WebSocket error:', err);
            };

            wsConnection.onopen = () => {
              wsConnected = true;
            };
          }

          // 等待 WebSocket 连接（最多 2 秒）
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 2000);
            if (wsConnection) {
              wsConnection.onopen = () => {
                wsConnected = true;
                clearTimeout(timeout);
                resolve();
              };
            }
          });
        }

        // HTTP 阶段进度回调
        const httpProgressCallback = (loaded: number, total: number) => {
          const progress = Math.round((loaded / total) * 100);
          updateTaskProgress(task.id, {
            progress,
            bytesTransferred: loaded,
            status: 'uploading',
            stage: 'http',
          });
          onProgress?.(loaded, total);
        };

        // 调用 API 上传（传递任务 ID 以便后端推送 SFTP 进度，并保存 xhr 以支持取消）
        const fileInfo = await sftpApi.uploadFile(
          serverId,
          remotePath,
          file,
          httpProgressCallback,
          enableWebSocket && wsConnected ? task.id : undefined,
          (xhr) => {
            xhrRefs.current.set(task.id, xhr);
          }
        );

        // HTTP 上传完成，如果没有 WebSocket，直接标记完成
        if (!enableWebSocket || !wsConnected) {
          updateTaskProgress(task.id, {
            progress: 100,
            status: 'completed',
            bytesTransferred: file.size,
          });
        }
        // 如果有 WebSocket，等待 SFTP 完成消息（由 WebSocket onmessage 处理）
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
        // 清理 xhr 引用
        xhrRefs.current.delete(task.id);
        // 清理 WebSocket 连接
        if (wsConnection) {
          if (wsConnection.readyState === WebSocket.OPEN) {
            wsConnection.close();
          }
          wsRefs.current.delete(task.id);
        }
      }
    },
    [updateTaskProgress, acquireUploadSlot]
  );

  /**
   * 取消任务
   */
  const cancelTask = useCallback((taskId: string) => {
    cancelledBeforeStartRef.current.add(taskId);
    // 先通知后端取消 SFTP 阶段（通过 WebSocket 控制消息）
    const ws = wsRefs.current.get(taskId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'cancel', task_id: taskId }));
      } catch (err) {
        console.error('[useFileTransfer] Failed to send cancel message via WebSocket:', err);
      }
    }

    // 中断 HTTP 上传
    const xhr = xhrRefs.current.get(taskId);
    if (xhr) {
      xhr.abort();
      xhrRefs.current.delete(taskId);
    } else {
      // 没有 xhr（例如纯 SFTP 阶段或已完成），仅更新状态
      setTasks(prev =>
        prev.map(task =>
          task.id === taskId
            ? { ...task, status: 'cancelled', error: '已取消' }
            : task
        )
      );
    }
  }, []);

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
    setTasks(prev =>
      prev.filter(
        t =>
          t.status !== 'completed' &&
          t.status !== 'failed' &&
          t.status !== 'cancelled'
      )
    );
  }, []);

  /**
   * 清除所有任务
   */
  const clearAll = useCallback(() => {
    // 中断所有进行中的 HTTP 上传
    tasks.forEach(task => {
      if (task.status === 'uploading') {
        const xhr = xhrRefs.current.get(task.id);
        if (xhr) {
          xhr.abort();
          xhrRefs.current.delete(task.id);
        }
      }
    });
    setTasks([]);
  }, [tasks]);

  /**
   * 创建跨服务器传输任务
   */
  const createTransferTask = useCallback((
    fileName: string,
    sourceServer: string,
    targetServer: string
  ): TransferTask => {
    return {
      id: `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName,
      fileSize: '-',
      fileSizeBytes: 0,
      progress: 0, // 跨服务器传输暂不支持进度，显示为 indeterminate
      status: 'transferring',
      type: 'transfer',
      startTime: Date.now(),
      sourceServer,
      targetServer,
    };
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
      const started = await sftpApi.directTransfer(
        sourceServerId,
        sourcePath,
        targetServerId,
        targetPath,
      )
      const taskId = started.task_id

      const task: TransferTask = {
        id: taskId,
        fileName,
        fileSize: '-', // 初始未知，等待服务器推送
        fileSizeBytes: 0,
        progress: 0,
        status: 'transferring',
        type: 'transfer',
        startTime: Date.now(),
        sourceServer: sourceServerName,
        targetServer: targetServerName,
      };

      setTasks(prev => [...prev, task]);

      // WebSocket 连接
      let wsConnection: WebSocket | null = null;
      // 标记传输是否已完成（用于区分正常关闭和异常关闭）
      let transferFinished = false;

      try {
        // 建立 WebSocket 连接获取进度
        const { ticket } = await createAuthTicket({ type: 'ws_sftp_transfer', task_id: taskId })
        const params = new URLSearchParams()
        params.set('ticket', ticket)
        const wsUrl = getWsUrl(`/api/v1/sftp/transfer/ws/${taskId}?${params.toString()}`)

        wsConnection = new WebSocket(wsUrl);
        wsRefs.current.set(taskId, wsConnection);

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

            if (msg.type === 'started') {
              updateTask(taskId, {
                status: 'transferring',
              });
            } else if (msg.type === 'progress') {
              updateTask(taskId, {
                progress: msg.progress,
                bytesTransferred: msg.bytes_copied,
                fileSizeBytes: msg.bytes_total,
                fileSize: msg.bytes_total > 0 ? formatBytesString(msg.bytes_total) : '-',
                speed: msg.speed_bps > 0 ? formatSpeed(msg.speed_bps) : undefined,
                timeRemaining: msg.eta || undefined,
                transferMethod: msg.method,
              });
            } else if (msg.type === 'complete') {
              transferFinished = true;
              updateTask(taskId, {
                progress: 100,
                status: 'completed',
                transferMethod: msg.method,
              });
              resolveTransfer();
            } else if (msg.type === 'error') {
              transferFinished = true;
              updateTask(taskId, {
                status: 'failed',
                error: msg.message || '传输失败',
                transferMethod: msg.method,
              });
              rejectTransfer(new Error(msg.message || '传输失败'));
            } else if (msg.type === 'cancelled') {
              transferFinished = true;
              updateTask(taskId, {
                status: 'cancelled',
                error: '已取消',
                transferMethod: msg.method,
              });
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
        await new Promise<void>((resolve, reject) => {
          const ws = wsConnection
          if (!ws) {
            reject(new Error('WebSocket not initialized'));
            return;
          }

          // 如果已经打开（理论上不太可能，但以防万一）
          if (ws.readyState === WebSocket.OPEN) {
            resolve();
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error('WebSocket 连接超时'));
          }, 5000);

          const originalOnopen = ws.onopen;
          ws.onopen = (event) => {
            clearTimeout(timeout);
            resolve();
            // 恢复原来的 onopen（如果有的话）
            if (originalOnopen) {
              originalOnopen.call(ws, event);
            }
          };

          const originalOnerror = ws.onerror;
          const errorHandler = () => {
            clearTimeout(timeout);
            reject(new Error('WebSocket 连接失败'));
            // 恢复原来的 onerror
            ws.onerror = originalOnerror;
          };
          ws.onerror = errorHandler;
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
          if (wsConnection.readyState === WebSocket.OPEN) {
            wsConnection.close();
          }
          wsRefs.current.delete(taskId);
        }
      }
    },
    [updateTask]
  );

  /**
   * 取消直连传输任务
   */
  const cancelDirectTransfer = useCallback(async (taskId: string) => {
    // 通过 WebSocket 发送取消消息
    const ws = wsRefs.current.get(taskId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'cancel', task_id: taskId }));
      } catch (err) {
        console.error('[useFileTransfer] Failed to send cancel message via WebSocket:', err);
      }
    }

    // 同时调用 API 取消（双保险）
    try {
      await sftpApi.cancelTransfer(taskId);
    } catch (err) {
      console.error('[useFileTransfer] Failed to cancel transfer via API:', err);
    }

    updateTask(taskId, {
      status: 'cancelled',
      error: '已取消',
    });
  }, [updateTask]);

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
