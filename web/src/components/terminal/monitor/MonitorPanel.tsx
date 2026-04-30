/**
 * 系统监控主面板组件
 * 固定宽度 250px, 高度 915px
 * 整合所有监控子组件,实现紧凑美观的布局
 * 使用 WebSocket + Protobuf 二进制传输获取真实监控数据
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/format-utils';
import { WSStatus } from './hooks/useMonitorWebSocket';
import { useMonitoringData } from './contexts/MonitorWebSocketContext';
import { SystemInfo } from './components/SystemInfo';
import { CPUChart } from './components/CPUChart';
import { MemoryChart } from './components/MemoryChart';
import { NetworkChart } from './components/NetworkChart';
import { DiskUsage } from './components/DiskUsage';
import { MonitorSkeleton } from './components/MonitorSkeleton';

interface MonitorPanelProps {
  className?: string;
  isLive?: boolean;
}

/**
 * 监控面板主组件
 *
 * 从 MonitorWebSocketContext 获取监控数据
 * 必须在 MonitorWebSocketProvider 内部使用
 *
 * 性能优化：使用 useMonitoringData() 只订阅监控数据
 * 避免在延迟数据更新时不必要的重新渲染
 *
 * 宽度: 280px (固定宽度)
 * 高度分配 (总计 720px, 完美适配1080p):
 * - 顶部内边距: 6px
 * - 系统信息: 148px (标题28px + 内容120px)
 * - 间距: 6px
 * - CPU图表: 134px (标题28px + 图表106px)
 * - 间距: 6px
 * - 内存图表: 134px (标题28px + 图表106px)
 * - 间距: 6px
 * - 网络图表: 134px (标题28px + 图表106px)
 * - 间距: 6px
 * - 磁盘使用: 134px (标题28px + 图表106px)
 * - 底部内边距: 6px
 */
export const MonitorPanel: React.FC<MonitorPanelProps> = ({
  className,
  isLive = true,
}) => {
  // 【性能优化】只订阅监控数据，不订阅延迟数据
  const { metrics, status, getMetricsHistory } = useMonitoringData();
  const [frozenSnapshot, setFrozenSnapshot] = useState<{
    metrics: typeof metrics;
    status: typeof status;
    history: ReturnType<typeof getMetricsHistory>;
  }>(() => ({
    metrics: null,
    status: WSStatus.DISCONNECTED,
    history: [],
  }));
  const liveHistory = isLive ? getMetricsHistory() : [];

  useEffect(() => {
    if (!isLive) return;

    setFrozenSnapshot({
      metrics,
      status,
      history: liveHistory,
    });
  }, [isLive, metrics, status, liveHistory]);

  const displayMetrics = isLive ? metrics : frozenSnapshot.metrics;
  const displayStatus = isLive ? status : frozenSnapshot.status;
  const displayHistory = isLive ? liveHistory : frozenSnapshot.history;

  // 转换数据格式以适配现有组件
  const formattedMetrics = useMemo(() => {
    if (!displayMetrics) return null;

    // 格式化运行时间
    const formatUptime = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
    };

    // 构建历史数据（用于图表）
    // 使用历史数据队列，而不是单个数据点
    const cpuHistory = displayHistory.map((m) => {
      const time = new Date(m.timestamp * 1000);
      return {
        time: time.toTimeString().split(' ')[0],
        usage: Math.round(m.cpu.usagePercent),
        timestamp: time.getTime(),
      };
    });

    const networkHistory = displayHistory.map((m) => {
      const time = new Date(m.timestamp * 1000);
      return {
        time: time.toTimeString().split(' ')[0],
        download: Math.round(m.network.bytesRecvPerSec / 1024), // bytes to KB
        upload: Math.round(m.network.bytesSentPerSec / 1024),
        timestamp: time.getTime(),
      };
    });

    return {
      systemInfo: {
        os: displayMetrics.systemInfo.os,
        hostname: displayMetrics.systemInfo.hostname,
        cpu: displayMetrics.systemInfo.cpuModel,
        arch: displayMetrics.systemInfo.arch,
        load: displayMetrics.systemInfo.loadAvg,
        uptime: formatUptime(displayMetrics.systemInfo.uptimeSeconds),
      },
      cpuHistory: cpuHistory,
      currentCPU: Math.round(displayMetrics.cpu.usagePercent),
      memory: {
        ram: {
          ...formatBytes(displayMetrics.memory.ramUsedBytes),
          total: formatBytes(displayMetrics.memory.ramTotalBytes).value,
          totalUnit: formatBytes(displayMetrics.memory.ramTotalBytes).unit,
          percent: displayMetrics.memory.ramTotalBytes > 0
            ? Math.round((displayMetrics.memory.ramUsedBytes / displayMetrics.memory.ramTotalBytes) * 100)
            : 0,
        },
        swap: {
          ...formatBytes(displayMetrics.memory.swapUsedBytes),
          total: formatBytes(displayMetrics.memory.swapTotalBytes).value,
          totalUnit: formatBytes(displayMetrics.memory.swapTotalBytes).unit,
          percent: displayMetrics.memory.swapTotalBytes > 0
            ? Math.round((displayMetrics.memory.swapUsedBytes / displayMetrics.memory.swapTotalBytes) * 100)
            : 0,
        },
      },
      networkHistory: networkHistory,
      currentNetwork: {
        download: Math.round(displayMetrics.network.bytesRecvPerSec / 1024),
        upload: Math.round(displayMetrics.network.bytesSentPerSec / 1024),
      },
      disks: displayMetrics.disks.map(disk => ({
        name: disk.mountPoint,
        ...formatBytes(disk.usedBytes),
        total: formatBytes(disk.totalBytes).value,
        totalUnit: formatBytes(disk.totalBytes).unit,
        percent: disk.totalBytes > 0
          ? Math.round((disk.usedBytes / disk.totalBytes) * 100)
          : 0,
      })),
      diskTotalPercent: Math.round(displayMetrics.diskTotalPercent),
    };
  }, [displayMetrics, displayHistory]);

  const panelContent = useMemo(() => {
    if (!formattedMetrics || displayStatus !== WSStatus.CONNECTED) {
      return <MonitorSkeleton />;
    }

    return (
      <>
        {/* 1. 系统信息 - 148px */}
        <div className="min-h-[148px]">
          <SystemInfo data={formattedMetrics.systemInfo} />
        </div>

        {/* 2. CPU 图表 - 134px */}
        <div className="min-h-[134px]">
          <CPUChart data={formattedMetrics.cpuHistory} currentUsage={formattedMetrics.currentCPU} />
        </div>

        {/* 3. 内存图表 - 134px */}
        <div className="min-h-[134px]">
          <MemoryChart data={formattedMetrics.memory} />
        </div>

        {/* 4. 网络图表 - 134px */}
        <div className="min-h-[134px]">
          <NetworkChart
            data={formattedMetrics.networkHistory}
            currentDownload={formattedMetrics.currentNetwork.download}
            currentUpload={formattedMetrics.currentNetwork.upload}
          />
        </div>

        {/* 5. 磁盘使用 - 134px */}
        <div className="min-h-[134px]">
          <DiskUsage data={formattedMetrics.disks} totalPercent={formattedMetrics.diskTotalPercent} />
        </div>
      </>
    );
  }, [formattedMetrics, displayStatus]);

  return (
    <div
      className={cn(
        // 固定宽度,最小高度
        "w-[280px] min-h-[720px] flex-shrink-0",
        // 内边距和间距
        "py-1.5 px-3 space-y-1.5",
        // 样式 - 移除边框（由外层容器处理）
        "overflow-y-auto",
        // 滚动条样式
        "monitor-panel-scrollbar",
        className
      )}
    >
      {panelContent}
    </div>
  );
};

MonitorPanel.displayName = 'MonitorPanel';
