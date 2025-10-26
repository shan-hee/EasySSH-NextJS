/**
 * 监控 WebSocket Hook
 * 使用 Protobuf 二进制传输获取实时系统监控数据
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { monitor } from '@/lib/proto/metrics';
import { getWsUrl } from '@/lib/config';

// WebSocket 连接状态
export enum WSStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

// 监控数据接口
export interface MonitorMetrics {
  systemInfo: {
    os: string;
    hostname: string;
    cpuModel: string;
    arch: string;
    loadAvg: string;
    uptimeSeconds: number;
    cpuCores: number;
  };
  cpu: {
    usagePercent: number;
    coreCount: number;
  };
  memory: {
    ramUsedBytes: number;
    ramTotalBytes: number;
    swapUsedBytes: number;
    swapTotalBytes: number;
  };
  network: {
    bytesRecvPerSec: number;
    bytesSentPerSec: number;
  };
  disks: Array<{
    mountPoint: string;
    usedBytes: number;
    totalBytes: number;
  }>;
  diskTotalPercent: number;
  sshLatencyMs: number;
  timestamp: number;
}

interface UseMonitorWebSocketOptions {
  serverId: string;
  enabled?: boolean;
  interval?: number; // 采集间隔（秒），默认 2 秒
  onError?: (error: Error) => void;
  onStatusChange?: (status: WSStatus) => void;
  // 本地延迟测量间隔（毫秒），默认 5000ms。若为 0 则关闭。
  latencyIntervalMs?: number;
}

/**
 * 监控 WebSocket Hook
 *
 * @example
 * const { metrics, status } = useMonitorWebSocket({ serverId: 'xxx', interval: 2 });
 */
export function useMonitorWebSocket({
  serverId,
  enabled = true,
  interval = 2,
  onError,
  onStatusChange,
  latencyIntervalMs = 5000,
}: UseMonitorWebSocketOptions) {
  const [metrics, setMetrics] = useState<MonitorMetrics | null>(null);
  const [status, setStatus] = useState<WSStatus>(WSStatus.DISCONNECTED);
  // 历史数据队列 - 维护最近 10 个数据点
  const metricsHistoryRef = useRef<MonitorMetrics[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  // 本地延迟测量
  const [localLatencyMs, setLocalLatencyMs] = useState<number>(0);
  const [localLatencyUpMs, setLocalLatencyUpMs] = useState<number>(0);
  const [localLatencyDownMs, setLocalLatencyDownMs] = useState<number>(0);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  // RTT 平滑（EWMA）与抖动（偏差）
  const [localLatencySmoothedMs, setLocalLatencySmoothedMs] = useState<number>(0);
  const [localLatencyDevMs, setLocalLatencyDevMs] = useState<number>(0);
  const latencyTimerRef = useRef<NodeJS.Timer | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (!enabled || !serverId) return;

    // 仅在浏览器环境中执行
    if (typeof window === 'undefined') return;

    // 注意: 在开发环境 React Strict Mode 下,这个函数会被调用两次
    // 第一次连接会立即被清理,第二次连接才是真正的连接
    // 这是 React 18 的预期行为,用于检测副作用问题
    // React Strict Mode 的副作用双执行 + Next.js Fast Refresh/HMR 的重挂载，会导致开发环境下连接两次，出现4 条 WS，生产环境不会出现这个问题

    try {
      // 获取 token
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        console.warn('[Monitor WS] 未找到认证令牌，跳过连接');
        setStatus(WSStatus.DISCONNECTED);
        onStatusChange?.(WSStatus.DISCONNECTED);
        return;
      }

      // 构建 WebSocket URL
      const wsUrl = getWsUrl(`/api/v1/monitor/server/${serverId}?token=${token}&interval=${interval}`);

      setStatus(WSStatus.CONNECTING);
      onStatusChange?.(WSStatus.CONNECTING);

      // 创建 WebSocket 连接
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      // 连接成功
      ws.onopen = () => {
        setStatus(WSStatus.CONNECTED);
        onStatusChange?.(WSStatus.CONNECTED);
        reconnectAttempts.current = 0;

        // 启动基于 WS 的本地 RTT 测量
        if (latencyIntervalMs > 0) {
          if (latencyTimerRef.current) clearInterval(latencyTimerRef.current);
          const sendPing = () => {
            try {
              ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            } catch {}
          };
          // 立即首 ping
          sendPing();
          // 根据可见性自适应间隔（前台：latencyIntervalMs；后台：max(30000, latencyIntervalMs)）
          const startOrRestartTimer = () => {
            if (latencyTimerRef.current) clearInterval(latencyTimerRef.current);
            const interval = typeof document !== 'undefined' && document.hidden
              ? Math.max(30000, latencyIntervalMs)
              : latencyIntervalMs;
            latencyTimerRef.current = setInterval(sendPing, interval);
          };
          startOrRestartTimer();
          // 注册可见性变化监听
          if (typeof document !== 'undefined') {
            const handler = () => startOrRestartTimer();
            document.addEventListener('visibilitychange', handler);
            visibilityHandlerRef.current = () => document.removeEventListener('visibilitychange', handler);
          }
        }
      };

      // 接收消息
      ws.onmessage = (event) => {
        try {
          if (event.data instanceof ArrayBuffer) {
            // Protobuf 反序列化
            const buffer = new Uint8Array(event.data);
            const metricsData = monitor.SystemMetrics.decode(buffer);

            // 转换数据格式
            const formattedMetrics: MonitorMetrics = {
              systemInfo: {
                os: metricsData.systemInfo?.os || '',
                hostname: metricsData.systemInfo?.hostname || '',
                cpuModel: metricsData.systemInfo?.cpuModel || '',
                arch: metricsData.systemInfo?.arch || '',
                loadAvg: metricsData.systemInfo?.loadAvg || '',
                uptimeSeconds: Number(metricsData.systemInfo?.uptimeSeconds || 0),
                cpuCores: metricsData.systemInfo?.cpuCores || 0,
              },
              cpu: {
                usagePercent: metricsData.cpu?.usagePercent || 0,
                coreCount: metricsData.cpu?.coreCount || 0,
              },
              memory: {
                ramUsedBytes: Number(metricsData.memory?.ramUsedBytes || 0),
                ramTotalBytes: Number(metricsData.memory?.ramTotalBytes || 0),
                swapUsedBytes: Number(metricsData.memory?.swapUsedBytes || 0),
                swapTotalBytes: Number(metricsData.memory?.swapTotalBytes || 0),
              },
              network: {
                bytesRecvPerSec: Number(metricsData.network?.bytesRecvPerSec || 0),
                bytesSentPerSec: Number(metricsData.network?.bytesSentPerSec || 0),
              },
              disks: (metricsData.disks || []).map((disk) => ({
                mountPoint: disk.mountPoint || '',
                usedBytes: Number(disk.usedBytes || 0),
                totalBytes: Number(disk.totalBytes || 0),
              })),
              diskTotalPercent: metricsData.diskTotalPercent || 0,
              sshLatencyMs: Number(metricsData.sshLatencyMs || 0),
              timestamp: Number(metricsData.timestamp || 0),
            };

            // 更新历史数据队列（最多保留 10 个数据点）
            metricsHistoryRef.current = [...metricsHistoryRef.current, formattedMetrics].slice(-10);

            setMetrics(formattedMetrics);
          } else if (typeof event.data === 'string') {
            // 处理文本消息（pong）
            try {
              const msg = JSON.parse(event.data);
              if (msg && msg.type === 'pong' && typeof msg.ts === 'number') {
                const t0 = Number(msg.ts);
                const t3 = Date.now();
                const t1 = typeof msg.serverRecvTs === 'number' ? Number(msg.serverRecvTs) : undefined;
                const t2 = typeof msg.serverSendTs === 'number' ? Number(msg.serverSendTs) : undefined;

                const rtt = Math.max(0, Math.round(t3 - t0));
                setLocalLatencyMs(rtt);
                // EWMA 平滑与偏差估计（TCP 类似参数）
                const ALPHA = 1/8; // 0.125
                const BETA = 1/4;  // 0.25
                setLocalLatencySmoothedMs((prev) => {
                  if (!prev || prev <= 0) {
                    // 首次样本直接初始化
                    setLocalLatencyDevMs(0);
                    return rtt;
                  }
                  const s = prev + ALPHA * (rtt - prev);
                  setLocalLatencyDevMs((prevDev) => {
                    const d = (isNaN(prevDev) ? 0 : prevDev) + BETA * (Math.abs(rtt - s) - (isNaN(prevDev) ? 0 : prevDev));
                    return Math.max(0, Math.round(d));
                  });
                  return Math.max(0, Math.round(s));
                });

                if (typeof t1 === 'number' && typeof t2 === 'number') {
                  // NTP 风格估算
                  const delay = (t3 - t0) - (t2 - t1);
                  const offset = ((t1 - t0) + (t2 - t3)) / 2;
                  const up = t1 - (t0 + offset);
                  const down = t3 - (t2 + offset);
                  setClockOffsetMs(Math.round(offset));
                  setLocalLatencyUpMs(Math.max(0, Math.round(up)));
                  setLocalLatencyDownMs(Math.max(0, Math.round(down)));
                }
              }
            } catch { /* ignore */ }
          }
        } catch (error) {
          console.error('[Monitor WS] 解析数据失败:', error);
          onError?.(error as Error);
        }
      };

      // 连接关闭
      ws.onclose = (event) => {
        setStatus(WSStatus.DISCONNECTED);
        onStatusChange?.(WSStatus.DISCONNECTED);
        // 清理本地 RTT 计时器
        if (latencyTimerRef.current) {
          clearInterval(latencyTimerRef.current);
          latencyTimerRef.current = null;
        }
        // 注销可见性监听
        if (visibilityHandlerRef.current) {
          visibilityHandlerRef.current();
          visibilityHandlerRef.current = null;
        }

        // 自动重连
        if (
          enabled &&
          reconnectAttempts.current < maxReconnectAttempts &&
          event.code !== 1000 // 非正常关闭
        ) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      // 连接错误
      ws.onerror = (error) => {
        console.error('[Monitor WS] 连接错误:', error);
        setStatus(WSStatus.ERROR);
        onStatusChange?.(WSStatus.ERROR);
        onError?.(new Error('WebSocket 连接错误'));
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[Monitor WS] 创建连接失败:', error);
      setStatus(WSStatus.ERROR);
      onStatusChange?.(WSStatus.ERROR);
      onError?.(error as Error);
    }
  }, [enabled, serverId, interval, onError, onStatusChange, latencyIntervalMs]); // 添加 interval 依赖

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnected');
      wsRef.current = null;
    }

    if (latencyTimerRef.current) {
      clearInterval(latencyTimerRef.current);
      latencyTimerRef.current = null;
    }
    if (visibilityHandlerRef.current) {
      visibilityHandlerRef.current();
      visibilityHandlerRef.current = null;
    }

    // 清空历史数据
    metricsHistoryRef.current = [];

    setStatus(WSStatus.DISCONNECTED);
  }, []); // 不依赖任何外部变量

  // 自动连接和清理
  useEffect(() => {
    if (enabled && serverId) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, serverId, interval]); // 添加 interval 依赖，当间隔改变时重新连接

  // 获取历史数据（用于图表）
  const getMetricsHistory = useCallback(() => {
    return metricsHistoryRef.current;
  }, []);

  return {
    metrics,
    status,
    localLatencyMs,
    localLatencySmoothedMs,
    localLatencyDevMs,
    localLatencyUpMs,
    localLatencyDownMs,
    clockOffsetMs,
    reconnect: connect,
    disconnect,
    getMetricsHistory,
  };
}
