/**
 * 监控 WebSocket Hook
 * 使用 Protobuf 二进制传输获取实时系统监控数据
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { monitor } from '@/lib/proto/metrics';
import { getWsUrl } from '@/lib/config';
import { useMonitorStore, WSStatus, type MonitorMetrics as StoreMonitorMetrics } from '@/stores/monitor-store';

// 重新导出 WSStatus 供外部使用
export { WSStatus };

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
  const latencyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // React Strict Mode 防护：标记当前组件是否已挂载
  const isMountedRef = useRef(false);
  // 存储待处理的延迟更新，批量提交避免频繁重新渲染
  const pendingLatencyUpdateRef = useRef<{
    localLatencyMs?: number;
    localLatencySmoothedMs?: number;
    localLatencyDevMs?: number;
    localLatencyUpMs?: number;
    localLatencyDownMs?: number;
    clockOffsetMs?: number;
  } | null>(null);

  // ==================== 核心改动：从 Store 获取和管理监控连接 ====================
  const getConnection = useMonitorStore(state => state.getConnection)
  const setConnection = useMonitorStore(state => state.setConnection)
  const updateMetrics = useMonitorStore(state => state.updateMetrics)
  const updateLocalLatency = useMonitorStore(state => state.updateLocalLatency)
  const updateStatus = useMonitorStore(state => state.updateStatus)
  const subscribe = useMonitorStore(state => state.subscribe)
  const notifySubscribers = useMonitorStore(state => state.notifySubscribers)

  // 从 Store 同步现有连接 - 使用订阅模式
  // 注意：这里不再直接复制 wsRef，而是通过订阅机制接收数据
  const existingConnection = getConnection(serverId)
  const shouldUseSubscription = existingConnection?.ws &&
    (existingConnection.ws.readyState === WebSocket.CONNECTING ||
     existingConnection.ws.readyState === WebSocket.OPEN)

  // ==================== 订阅监控数据更新 ====================
  useEffect(() => {
    if (!enabled || !serverId || !shouldUseSubscription) return

    // 注册订阅者，接收监控数据更新
    const unsubscribe = subscribe(serverId, (newMetrics) => {
      // 将 Store 的 MonitorMetrics 转换为 Hook 的 MonitorMetrics 格式
      const hookMetrics: MonitorMetrics = {
        systemInfo: {
          os: newMetrics.systemInfo.os,
          hostname: newMetrics.systemInfo.hostname,
          cpuModel: newMetrics.systemInfo.cpuModel,
          arch: newMetrics.systemInfo.arch,
          loadAvg: newMetrics.systemInfo.loadAvg,
          uptimeSeconds: newMetrics.systemInfo.uptimeSeconds,
          cpuCores: newMetrics.systemInfo.cpuCores,
        },
        cpu: {
          usagePercent: newMetrics.cpu.usage,
          coreCount: newMetrics.cpu.cores,
        },
        memory: {
          ramUsedBytes: newMetrics.memory.used,
          ramTotalBytes: newMetrics.memory.total,
          swapUsedBytes: 0,
          swapTotalBytes: 0,
        },
        network: {
          bytesRecvPerSec: newMetrics.network.bytesIn,
          bytesSentPerSec: newMetrics.network.bytesOut,
        },
        disks: newMetrics.disks,
        diskTotalPercent: newMetrics.disk.usagePercent,
        sshLatencyMs: newMetrics.sshLatencyMs,
        timestamp: newMetrics.timestamp,
      }

      setMetrics(hookMetrics)
      metricsHistoryRef.current = [...metricsHistoryRef.current, hookMetrics].slice(-10)

      // ==================== 核心修复：同步本地延迟数据 ====================
      // 从 Store 中获取延迟数据并更新到本地状态
      if (newMetrics.localLatencyMs !== undefined) {
        setLocalLatencyMs(newMetrics.localLatencyMs)
      }
      if (newMetrics.localLatencySmoothedMs !== undefined) {
        setLocalLatencySmoothedMs(newMetrics.localLatencySmoothedMs)
      }
      if (newMetrics.localLatencyJitter !== undefined) {
        setLocalLatencyDevMs(newMetrics.localLatencyJitter)
      }
    })

    // 同步现有状态
    if (existingConnection) {
      setStatus(existingConnection.status)

      // 直接从 MonitorConnectionState 读取延迟数据（不再依赖 metrics 对象）
      if (existingConnection.localLatencyMs !== undefined) {
        setLocalLatencyMs(existingConnection.localLatencyMs)
      }
      if (existingConnection.localLatencySmoothedMs !== undefined) {
        setLocalLatencySmoothedMs(existingConnection.localLatencySmoothedMs)
      }
      if (existingConnection.localLatencyJitter !== undefined) {
        setLocalLatencyDevMs(existingConnection.localLatencyJitter)
      }
    }

    // 组件卸载时取消订阅
    return () => {
      unsubscribe()
    }
  }, [enabled, serverId, shouldUseSubscription, subscribe])

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (!enabled || !serverId) return;

    // 仅在浏览器环境中执行
    if (typeof window === 'undefined') return;

    // ==================== 核心修复：检查 Store 中的现有连接 ====================
    const storeConnection = getConnection(serverId)
    if (storeConnection?.ws) {
      const ws = storeConnection.ws
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        // 注意：不再设置 wsRef.current，而是依赖订阅机制接收数据
        // 订阅逻辑已在上面的 useEffect 中处理
        return
      }
    }

    // React Strict Mode 防护：避免重复连接
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

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

      // 立即保存到 wsRef，以便 disconnect 能够正确处理
      wsRef.current = ws;

      // ==================== 核心改动：保存到 Store ====================
      setConnection(serverId, {
        ws,
        metrics: null,
        status: WSStatus.CONNECTING,
        serverId,
        createdAt: Date.now(),
        lastUpdateAt: Date.now(),
      })

      // 连接成功
      ws.onopen = () => {
        setStatus(WSStatus.CONNECTED);
        onStatusChange?.(WSStatus.CONNECTED);
        updateStatus(serverId, WSStatus.CONNECTED); // 更新 Store 状态
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
            // Protobuf 反序列化（使用 Worker 可进一步优化，但当前优先批量更新）
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

            // 批量更新：单次 setState 避免多次重新渲染
            setMetrics(formattedMetrics);

            // ==================== 核心改动：通过 Store 分发消息给所有订阅者 ====================
            const storeMetrics = {
              systemInfo: {
                os: formattedMetrics.systemInfo.os,
                hostname: formattedMetrics.systemInfo.hostname,
                cpuModel: formattedMetrics.systemInfo.cpuModel,
                arch: formattedMetrics.systemInfo.arch,
                loadAvg: formattedMetrics.systemInfo.loadAvg,
                uptimeSeconds: formattedMetrics.systemInfo.uptimeSeconds,
                cpuCores: formattedMetrics.systemInfo.cpuCores,
              },
              cpu: {
                usage: formattedMetrics.cpu.usagePercent,
                cores: formattedMetrics.cpu.coreCount,
              },
              memory: {
                total: formattedMetrics.memory.ramTotalBytes,
                used: formattedMetrics.memory.ramUsedBytes,
                free: formattedMetrics.memory.ramTotalBytes - formattedMetrics.memory.ramUsedBytes,
                usagePercent: (formattedMetrics.memory.ramUsedBytes / formattedMetrics.memory.ramTotalBytes) * 100,
              },
              disk: {
                total: formattedMetrics.disks.reduce((acc, d) => acc + d.totalBytes, 0),
                used: formattedMetrics.disks.reduce((acc, d) => acc + d.usedBytes, 0),
                free: formattedMetrics.disks.reduce((acc, d) => acc + (d.totalBytes - d.usedBytes), 0),
                usagePercent: formattedMetrics.diskTotalPercent,
              },
              disks: formattedMetrics.disks,
              network: {
                bytesIn: formattedMetrics.network.bytesRecvPerSec,
                bytesOut: formattedMetrics.network.bytesSentPerSec,
                packetsIn: 0,
                packetsOut: 0,
              },
              timestamp: formattedMetrics.timestamp,
              sshLatencyMs: formattedMetrics.sshLatencyMs,
            }

            // 更新 Store（用于新订阅者获取最新数据）
            updateMetrics(serverId, storeMetrics)

            // 通知所有订阅者（核心：让所有页签都收到数据）
            notifySubscribers(serverId, storeMetrics)
          } else if (typeof event.data === 'string') {
            // 处理文本消息（pong）- 优化：批量更新延迟状态
            try {
              const msg = JSON.parse(event.data);
              if (msg && msg.type === 'pong' && typeof msg.ts === 'number') {
                const t0 = Number(msg.ts);
                const t3 = Date.now();
                const t1 = typeof msg.serverRecvTs === 'number' ? Number(msg.serverRecvTs) : undefined;
                const t2 = typeof msg.serverSendTs === 'number' ? Number(msg.serverSendTs) : undefined;

                const rtt = Math.max(0, Math.round(t3 - t0));

                // 准备批量更新
                const updates: typeof pendingLatencyUpdateRef.current = {
                  localLatencyMs: rtt,
                };

                // EWMA 平滑与偏差估计（TCP 类似参数）
                const ALPHA = 1/8; // 0.125
                const BETA = 1/4;  // 0.25

                // 使用函数式更新避免闭包陷阱
                setLocalLatencySmoothedMs((prev) => {
                  if (!prev || prev <= 0) {
                    // 首次样本直接初始化
                    updates.localLatencySmoothedMs = rtt;
                    updates.localLatencyDevMs = 0;
                    return rtt;
                  }
                  const s = prev + ALPHA * (rtt - prev);
                  const smoothed = Math.max(0, Math.round(s));
                  updates.localLatencySmoothedMs = smoothed;

                  // 计算偏差
                  setLocalLatencyDevMs((prevDev) => {
                    const d = (isNaN(prevDev) ? 0 : prevDev) + BETA * (Math.abs(rtt - s) - (isNaN(prevDev) ? 0 : prevDev));
                    const dev = Math.max(0, Math.round(d));
                    updates.localLatencyDevMs = dev;
                    return dev;
                  });

                  return smoothed;
                });

                if (typeof t1 === 'number' && typeof t2 === 'number') {
                  // NTP 风格估算
                  const delay = (t3 - t0) - (t2 - t1);
                  const offset = ((t1 - t0) + (t2 - t3)) / 2;
                  const up = t1 - (t0 + offset);
                  const down = t3 - (t2 + offset);

                  updates.clockOffsetMs = Math.round(offset);
                  updates.localLatencyUpMs = Math.max(0, Math.round(up));
                  updates.localLatencyDownMs = Math.max(0, Math.round(down));
                }

                // 批量应用所有更新（使用 React 18 的 automatic batching）
                setLocalLatencyMs(updates.localLatencyMs!);
                if (updates.clockOffsetMs !== undefined) setClockOffsetMs(updates.clockOffsetMs);
                if (updates.localLatencyUpMs !== undefined) setLocalLatencyUpMs(updates.localLatencyUpMs);
                if (updates.localLatencyDownMs !== undefined) setLocalLatencyDownMs(updates.localLatencyDownMs);

                // ==================== 核心修复：同步延迟数据到 Store ====================
                // 确保所有订阅者都能获取到本地延迟数据
                if (updates.localLatencyMs !== undefined &&
                    updates.localLatencySmoothedMs !== undefined &&
                    updates.localLatencyDevMs !== undefined) {
                  updateLocalLatency(serverId, {
                    localLatencyMs: updates.localLatencyMs,
                    localLatencySmoothedMs: updates.localLatencySmoothedMs,
                    localLatencyJitter: updates.localLatencyDevMs,
                  });
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
        updateStatus(serverId, WSStatus.DISCONNECTED); // 更新 Store 状态
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
        console.error('[useMonitorWebSocket] 连接错误:', error);
        setStatus(WSStatus.ERROR);
        onStatusChange?.(WSStatus.ERROR);
        updateStatus(serverId, WSStatus.ERROR); // 更新 Store 状态
        onError?.(new Error('WebSocket 连接错误'));
      };

      // wsRef.current 已在上方（创建 WebSocket 后）立即设置，这里不需要重复设置
    } catch (error) {
      console.error('[Monitor WS] 创建连接失败:', error);
      setStatus(WSStatus.ERROR);
      onStatusChange?.(WSStatus.ERROR);
      onError?.(error as Error);
    }
  }, [enabled, serverId, interval, onError, onStatusChange, latencyIntervalMs, getConnection, setConnection, updateMetrics, updateLocalLatency, updateStatus, notifySubscribers]); // 添加 Store 依赖

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (latencyTimerRef.current) {
      clearInterval(latencyTimerRef.current);
      latencyTimerRef.current = null;
    }
    if (visibilityHandlerRef.current) {
      visibilityHandlerRef.current();
      visibilityHandlerRef.current = null;
    }

    // 安全关闭 WebSocket：避免竞态条件
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null; // 先置空避免重复处理

      // 只在连接未关闭时才执行关闭操作
      // WebSocket.CLOSING (2) 或 WebSocket.CLOSED (3) 时不需要再调用 close()
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        try {
          ws.close(1000, 'Client disconnected');
        } catch (err) {
          // 忽略关闭过程中的错误（例如连接已经在关闭中）
          // 这在 React Strict Mode 的双重调用中很常见
        }
      }
    }

    // 清空历史数据
    metricsHistoryRef.current = [];

    setStatus(WSStatus.DISCONNECTED);
  }, []); // 不依赖任何外部变量

  // 自动连接和清理
  useEffect(() => {
    // 标记组件已挂载
    isMountedRef.current = true;

    if (enabled && serverId) {
      connect();
    }

    return () => {
      // 标记组件已卸载
      isMountedRef.current = false;

      // ==================== 核心修复：组件卸载时不断开连接 ====================
      // 连接会保持活跃，只有在页签关闭时才会通过 Store.destroyConnection() 真正断开
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
