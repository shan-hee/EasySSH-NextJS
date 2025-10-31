/**
 * SFTP 上传进度 WebSocket Hook
 * 用于实时跟踪 SFTP 上传的完整进度（HTTP + SFTP 阶段）
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { getWsUrl } from '@/lib/config';

// 上传进度消息接口
export interface UploadProgressMessage {
  type: 'progress' | 'complete' | 'error';
  task_id: string;
  loaded?: number;
  total?: number;
  stage?: 'http' | 'sftp';
  speed_bps?: number;
  message?: string;
}

// Hook 选项接口
interface UseSftpUploadWebSocketOptions {
  taskId: string;
  enabled?: boolean;
  onProgress?: (loaded: number, total: number, stage: 'http' | 'sftp', speedBps: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

// WebSocket 状态
export enum WSStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * SFTP 上传进度 WebSocket Hook
 *
 * @example
 * const { status, connect, disconnect } = useSftpUploadWebSocket({
 *   taskId: 'upload-123',
 *   onProgress: (loaded, total, stage, speed) => {
 *     console.log(`${stage}: ${loaded}/${total} @ ${speed}Bps`);
 *   },
 *   onComplete: () => console.log('Upload completed'),
 *   onError: (err) => console.error('Upload error:', err),
 * });
 */
export function useSftpUploadWebSocket({
  taskId,
  enabled = false,
  onProgress,
  onComplete,
  onError,
}: UseSftpUploadWebSocketOptions) {
  const [status, setStatus] = useState<WSStatus>(WSStatus.DISCONNECTED);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);
  const enabledRef = useRef(enabled);

  // 更新 enabled 引用
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // 连接 WebSocket
  const connect = useCallback(() => {
    // 如果已经连接或正在连接，直接返回
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // 清理旧连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[SftpUploadWS] No token found');
      setStatus(WSStatus.ERROR);
      onError?.('Authentication token not found');
      return;
    }

    setStatus(WSStatus.CONNECTING);

    try {
      const wsUrl = getWsUrl(`/api/v1/sftp/upload/ws/${taskId}`) + `?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        console.log('[SftpUploadWS] Connected:', taskId);
        setStatus(WSStatus.CONNECTED);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const msg: UploadProgressMessage = JSON.parse(event.data);

          if (msg.task_id !== taskId) {
            console.warn('[SftpUploadWS] Task ID mismatch:', msg.task_id, 'expected:', taskId);
            return;
          }

          switch (msg.type) {
            case 'progress':
              if (msg.loaded !== undefined && msg.total !== undefined && msg.stage && msg.speed_bps !== undefined) {
                onProgress?.(msg.loaded, msg.total, msg.stage, msg.speed_bps);
              }
              break;

            case 'complete':
              console.log('[SftpUploadWS] Upload completed:', taskId);
              onComplete?.();
              // 上传完成后自动断开
              disconnect();
              break;

            case 'error':
              console.error('[SftpUploadWS] Upload error:', msg.message);
              onError?.(msg.message || 'Unknown error');
              disconnect();
              break;
          }
        } catch (err) {
          console.error('[SftpUploadWS] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        if (!isMountedRef.current) return;
        console.error('[SftpUploadWS] WebSocket error:', event);
        setStatus(WSStatus.ERROR);
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        console.log('[SftpUploadWS] Disconnected:', taskId, 'code:', event.code);
        setStatus(WSStatus.DISCONNECTED);
        wsRef.current = null;

        // 如果是非正常关闭且仍然 enabled，尝试重连（最多1次）
        if (event.code !== 1000 && enabledRef.current && !reconnectTimeoutRef.current) {
          console.log('[SftpUploadWS] Attempting to reconnect...');
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            if (enabledRef.current && isMountedRef.current) {
              connect();
            }
          }, 2000);
        }
      };
    } catch (err) {
      console.error('[SftpUploadWS] Failed to create WebSocket:', err);
      setStatus(WSStatus.ERROR);
      onError?.('Failed to create WebSocket connection');
    }
  }, [taskId, onProgress, onComplete, onError]);

  // 断开 WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      console.log('[SftpUploadWS] Manually disconnecting:', taskId);
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }

    setStatus(WSStatus.DISCONNECTED);
  }, [taskId]);

  // 挂载和卸载处理
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  // 根据 enabled 自动连接/断开
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }
  }, [enabled, connect, disconnect]);

  return {
    status,
    connect,
    disconnect,
    isConnected: status === WSStatus.CONNECTED,
  };
}
