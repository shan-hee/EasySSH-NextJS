import { useState, useCallback, useRef } from 'react';
import { formatSpeed, formatRemainingTime, formatBytesString } from '@/lib/format-utils';
import { sftpApi, type FileInfo } from '@/lib/api/sftp';
import { getWsUrl } from '@/lib/config';

/**
 * 传输任务接口
 */
export interface TransferTask {
  id: string;
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  progress: number;
  status: 'pending' | 'uploading' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  type: 'upload' | 'download';
  speed?: string;
  timeRemaining?: string;
  error?: string;
  startTime?: number;
  bytesTransferred?: number;
  stage?: 'http' | 'sftp'; // 当前传输阶段
}

/**
 * 文件传输Hook
 * 管理文件上传下载任务和进度
 */
export function useFileTransfer() {
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const xhrRefs = useRef<Map<string, XMLHttpRequest>>(new Map());
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());

  /**
   * 创建上传任务
   */
  const createUploadTask = useCallback((file: File): TransferTask => {
    return {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileSize: formatBytesString(file.size),
      fileSizeBytes: file.size,
      progress: 0,
      status: 'pending',
      type: 'upload',
      startTime: Date.now(),
      bytesTransferred: 0,
    };
  }, []);

  /**
   * 更新任务进度
   */
  const updateTaskProgress = useCallback((taskId: string, update: Partial<TransferTask>) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== taskId) return task;

        const updatedTask = { ...task, ...update };

        // 计算速度和剩余时间
        if (updatedTask.bytesTransferred !== undefined && updatedTask.startTime) {
          const elapsedSeconds = (Date.now() - updatedTask.startTime) / 1000;
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
      const task = createUploadTask(file);
      setTasks(prev => [...prev, task]);

      // WebSocket 连接引用
      let wsConnection: WebSocket | null = null;
      let wsConnected = false;

      try {
        // 如果启用 WebSocket，先建立连接
        if (enableWebSocket) {
          // 使用统一的 WebSocket URL 构建函数（凭 Cookie 认证，不再拼接 token）
          const wsUrl = getWsUrl(`/api/v1/sftp/upload/ws/${task.id}`);

          wsConnection = new WebSocket(wsUrl);
          // 记录 WebSocket 连接,以支持取消时发送控制消息
          wsRefs.current.set(task.id, wsConnection);

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
    [createUploadTask, updateTaskProgress]
  );

  /**
   * 取消任务
   */
  const cancelTask = useCallback((taskId: string) => {
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

  return {
    tasks,
    uploadFile,
    cancelTask,
    removeTask,
    clearCompleted,
    clearAll,
  };
}
