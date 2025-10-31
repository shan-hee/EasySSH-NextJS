import { useState, useCallback, useRef } from 'react';
import { formatSpeed, formatRemainingTime, formatBytesString } from '@/lib/format-utils';
import { sftpApi } from '@/lib/api/sftp';
import { useSftpUploadWebSocket } from './useSftpUploadWebSocket';
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
  status: 'pending' | 'uploading' | 'downloading' | 'completed' | 'failed';
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
   * 创建下载任务
   */
  const createDownloadTask = useCallback((fileName: string, fileSize: number): TransferTask => {
    return {
      id: `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName,
      fileSize: formatBytesString(fileSize),
      fileSizeBytes: fileSize,
      progress: 0,
      status: 'pending',
      type: 'download',
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
      token: string,
      serverId: string,
      remotePath: string,
      file: File,
      onProgress?: (loaded: number, total: number) => void,
      enableWebSocket?: boolean // 是否启用 WebSocket 进度跟踪
    ): Promise<void> => {
      const task = createUploadTask(file);
      setTasks(prev => [...prev, task]);

      // WebSocket 连接引用
      let wsConnection: WebSocket | null = null;
      let wsConnected = false;

      try {
        // 如果启用 WebSocket，先建立连接
        if (enableWebSocket) {
          // 使用统一的 WebSocket URL 构建函数
          const wsUrl = getWsUrl(`/api/v1/sftp/upload/ws/${task.id}`) + `?token=${token}`;

          wsConnection = new WebSocket(wsUrl);

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

        // 调用 API 上传（传递任务 ID 以便后端推送 SFTP 进度）
        await sftpApi.uploadFile(
          token,
          serverId,
          remotePath,
          file,
          httpProgressCallback,
          enableWebSocket && wsConnected ? task.id : undefined
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

      } catch (error: any) {
        updateTaskProgress(task.id, {
          status: 'failed',
          error: error.message || '上传失败',
        });
        throw error;
      } finally {
        // 清理 WebSocket 连接
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.close();
        }
      }
    },
    [createUploadTask, updateTaskProgress]
  );

  /**
   * 下载文件
   */
  const downloadFile = useCallback(
    async (
      token: string,
      serverId: string,
      remotePath: string,
      fileName: string,
      fileSize: number
    ): Promise<void> => {
      const task = createDownloadTask(fileName, fileSize);
      setTasks(prev => [...prev, task]);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRefs.current.set(task.id, xhr);

        // 设置响应类型为blob
        xhr.responseType = 'blob';

        // 进度监听
        xhr.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            updateTaskProgress(task.id, {
              progress,
              bytesTransferred: e.loaded,
              status: 'downloading',
            });
          }
        });

        // 完成监听
        xhr.addEventListener('load', () => {
          xhrRefs.current.delete(task.id);
          if (xhr.status >= 200 && xhr.status < 300) {
            // 创建下载链接
            const blob = xhr.response as Blob;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            updateTaskProgress(task.id, {
              progress: 100,
              status: 'completed',
              bytesTransferred: fileSize,
            });
            resolve();
          } else {
            const error = '下载失败';
            updateTaskProgress(task.id, {
              status: 'failed',
              error,
            });
            reject(new Error(error));
          }
        });

        // 错误监听
        xhr.addEventListener('error', () => {
          xhrRefs.current.delete(task.id);
          const error = '网络错误';
          updateTaskProgress(task.id, {
            status: 'failed',
            error,
          });
          reject(new Error(error));
        });

        // 取消监听
        xhr.addEventListener('abort', () => {
          xhrRefs.current.delete(task.id);
          updateTaskProgress(task.id, {
            status: 'failed',
            error: '已取消',
          });
          reject(new Error('Download cancelled'));
        });

        // 发送请求
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8521/api/v1';
        const url = `${apiUrl}/sftp/${serverId}/download?path=${encodeURIComponent(remotePath)}`;
        xhr.open('GET', url);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send();
      });
    },
    [createDownloadTask, updateTaskProgress]
  );

  /**
   * 取消任务
   */
  const cancelTask = useCallback((taskId: string) => {
    const xhr = xhrRefs.current.get(taskId);
    if (xhr) {
      xhr.abort();
      xhrRefs.current.delete(taskId);
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
    setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'failed'));
  }, []);

  /**
   * 清除所有任务
   */
  const clearAll = useCallback(() => {
    // 取消所有进行中的任务
    tasks.forEach(task => {
      if (task.status === 'uploading' || task.status === 'downloading') {
        cancelTask(task.id);
      }
    });
    setTasks([]);
  }, [tasks, cancelTask]);

  return {
    tasks,
    uploadFile,
    downloadFile,
    cancelTask,
    removeTask,
    clearCompleted,
    clearAll,
  };
}
