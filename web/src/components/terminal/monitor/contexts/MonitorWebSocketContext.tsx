/**
 * 监控 WebSocket Context
 *
 * 提供全局单例的监控 WebSocket 连接，避免重复连接
 * 在页签初始化时创建，与页签生命周期绑定
 * 所有需要监控数据的组件都从此 Context 获取
 *
 * 性能优化：
 * - 使用 useMemo 拆分数据，避免不必要的重新渲染
 * - 组件只订阅自己需要的数据分组
 */

'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useMonitorWebSocket, WSStatus, MonitorMetrics } from '../hooks/useMonitorWebSocket';

/**
 * 延迟相关数据
 * 用于网络延迟展示组件
 */
export interface LatencyData {
  // 本地 RTT 延迟
  localLatencyMs: number;
  localLatencySmoothedMs: number;
  localLatencyDevMs: number;
  localLatencyUpMs: number;
  localLatencyDownMs: number;
  clockOffsetMs: number;

  // SSH 延迟（来自服务器监控数据）
  sshLatencyMs: number;
}

/**
 * 监控数据
 * 用于监控面板组件
 */
export interface MonitoringData {
  metrics: MonitorMetrics | null;
  status: WSStatus;
  getMetricsHistory: () => MonitorMetrics[];
}

/**
 * 控制方法
 * 用于手动控制连接
 */
export interface ControlMethods {
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * Context 完整数据结构
 * 拆分成三个独立的数据组，减少不必要的重新渲染
 */
interface MonitorWebSocketContextValue {
  // 延迟数据（高频更新：每 5 秒）
  latency: LatencyData;

  // 监控数据（中频更新：每 2 秒）
  monitoring: MonitoringData;

  // 控制方法（稳定，几乎不变）
  controls: ControlMethods;
}

const MonitorWebSocketContext = createContext<MonitorWebSocketContextValue | null>(null);

interface MonitorWebSocketProviderProps {
  children: ReactNode;
  serverId: string;
  enabled?: boolean;
  interval?: number;
  latencyIntervalMs?: number;
}

/**
 * MonitorWebSocket Provider
 *
 * 在页签级别提供单例的监控 WebSocket 连接
 * 所有子组件通过 useMonitorWebSocketContext 共享同一个连接
 *
 * 性能优化：
 * - 数据按用途分组，避免交叉更新导致的不必要渲染
 * - 使用 useMemo 缓存稳定的数据对象
 *
 * @example
 * <MonitorWebSocketProvider serverId="xxx" enabled={isConnected}>
 *   <NetworkLatencyPopover />
 *   <MonitorPanel />
 * </MonitorWebSocketProvider>
 */
export const MonitorWebSocketProvider: React.FC<MonitorWebSocketProviderProps> = ({
  children,
  serverId,
  enabled = true,
  interval = 2,
  latencyIntervalMs = 5000,
}) => {
  const monitorData = useMonitorWebSocket({
    serverId,
    enabled,
    interval,
    latencyIntervalMs,
  });

  // 延迟数据组 - 只在延迟相关值变化时更新
  const latency = useMemo<LatencyData>(() => ({
    localLatencyMs: monitorData.localLatencyMs,
    localLatencySmoothedMs: monitorData.localLatencySmoothedMs,
    localLatencyDevMs: monitorData.localLatencyDevMs,
    localLatencyUpMs: monitorData.localLatencyUpMs,
    localLatencyDownMs: monitorData.localLatencyDownMs,
    clockOffsetMs: monitorData.clockOffsetMs,
    sshLatencyMs: monitorData.metrics?.sshLatencyMs || 0,
  }), [
    monitorData.localLatencyMs,
    monitorData.localLatencySmoothedMs,
    monitorData.localLatencyDevMs,
    monitorData.localLatencyUpMs,
    monitorData.localLatencyDownMs,
    monitorData.clockOffsetMs,
    monitorData.metrics?.sshLatencyMs,
  ]);

  // 监控数据组 - 只在监控数据或状态变化时更新
  const monitoring = useMemo<MonitoringData>(() => ({
    metrics: monitorData.metrics,
    status: monitorData.status,
    getMetricsHistory: monitorData.getMetricsHistory,
  }), [
    monitorData.metrics,
    monitorData.status,
    monitorData.getMetricsHistory,
  ]);

  // 控制方法组 - 稳定引用，几乎不会变化
  const controls = useMemo<ControlMethods>(() => ({
    reconnect: monitorData.reconnect,
    disconnect: monitorData.disconnect,
  }), [
    monitorData.reconnect,
    monitorData.disconnect,
  ]);

  // 组合成最终的 Context 值
  const contextValue = useMemo<MonitorWebSocketContextValue>(() => ({
    latency,
    monitoring,
    controls,
  }), [latency, monitoring, controls]);

  return (
    <MonitorWebSocketContext.Provider value={contextValue}>
      {children}
    </MonitorWebSocketContext.Provider>
  );
};

/**
 * 使用监控 WebSocket Context（完整数据）
 *
 * @throws 如果在 MonitorWebSocketProvider 外部使用
 *
 * @example
 * const { latency, monitoring, controls } = useMonitorWebSocketContext();
 */
export const useMonitorWebSocketContext = (): MonitorWebSocketContextValue => {
  const context = useContext(MonitorWebSocketContext);

  if (!context) {
    throw new Error(
      'useMonitorWebSocketContext must be used within MonitorWebSocketProvider. ' +
      'Make sure your component is wrapped with <MonitorWebSocketProvider>.'
    );
  }

  return context;
};

/**
 * 只使用延迟数据（性能优化）
 *
 * 推荐用法：如果组件只需要延迟数据，使用此 Hook 可以避免
 * 在监控数据更新时不必要的重新渲染
 *
 * @example
 * // NetworkLatencyPopover 只需要延迟数据
 * const latency = useLatencyData();
 */
export const useLatencyData = (): LatencyData => {
  const context = useMonitorWebSocketContext();
  return context.latency;
};

/**
 * 只使用监控数据（性能优化）
 *
 * 推荐用法：如果组件只需要监控数据，使用此 Hook 可以避免
 * 在延迟数据更新时不必要的重新渲染
 *
 * @example
 * // MonitorPanel 只需要监控数据
 * const monitoring = useMonitoringData();
 */
export const useMonitoringData = (): MonitoringData => {
  const context = useMonitorWebSocketContext();
  return context.monitoring;
};

/**
 * 只使用控制方法（性能优化）
 *
 * @example
 * const { reconnect, disconnect } = useMonitorControls();
 */
export const useMonitorControls = (): ControlMethods => {
  const context = useMonitorWebSocketContext();
  return context.controls;
};

/**
 * 安全地使用监控 WebSocket Context (可选)
 *
 * 如果在 Provider 外部使用，返回 null 而不是抛出错误
 * 适用于可选的监控功能
 *
 * @example
 * const monitorData = useMonitorWebSocketContextSafe();
 * if (monitorData) {
 *   // 使用 monitorData
 * }
 */
export const useMonitorWebSocketContextSafe = (): MonitorWebSocketContextValue | null => {
  return useContext(MonitorWebSocketContext);
};
