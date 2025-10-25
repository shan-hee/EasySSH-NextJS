/**
 * 系统监控主面板组件
 * 固定宽度 250px, 高度 915px
 * 整合所有监控子组件,实现紧凑美观的布局
 * 使用 WebSocket + Protobuf 二进制传输获取真实监控数据
 */

'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/format-utils';
import { useMonitorWebSocket, WSStatus } from './hooks/useMonitorWebSocket';
import { SystemInfo } from './components/SystemInfo';
import { CPUChart } from './components/CPUChart';
import { MemoryChart } from './components/MemoryChart';
import { NetworkChart } from './components/NetworkChart';
import { DiskUsage } from './components/DiskUsage';
import { Loader2, WifiOff, AlertCircle } from 'lucide-react';

interface MonitorPanelProps {
  className?: string;
  serverId?: string; // 服务器 ID
  interval?: number; // 采集间隔（秒）
}

/**
 * 监控面板主组件
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
export const MonitorPanel: React.FC<MonitorPanelProps> = ({ className, serverId, interval = 2 }) => {
  // 连接监控 WebSocket
  const { metrics, status, getMetricsHistory } = useMonitorWebSocket({
    serverId: serverId || '',
    enabled: !!serverId,
    interval: interval,
  });

  // 转换数据格式以适配现有组件
  const formattedMetrics = useMemo(() => {
    if (!metrics) return null;

    // 获取历史数据
    const history = getMetricsHistory();

    // 格式化运行时间
    const formatUptime = (seconds: number): string => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
    };

    // 构建历史数据（用于图表）
    // 使用历史数据队列，而不是单个数据点
    const cpuHistory = history.map((m) => {
      const time = new Date(m.timestamp * 1000);
      return {
        time: time.toTimeString().split(' ')[0],
        usage: Math.round(m.cpu.usagePercent),
      };
    });

    const networkHistory = history.map((m) => {
      const time = new Date(m.timestamp * 1000);
      return {
        time: time.toTimeString().split(' ')[0],
        download: Math.round(m.network.bytesRecvPerSec / 1024), // bytes to KB
        upload: Math.round(m.network.bytesSentPerSec / 1024),
      };
    });

    return {
      systemInfo: {
        os: metrics.systemInfo.os,
        hostname: metrics.systemInfo.hostname,
        cpu: metrics.systemInfo.cpuModel,
        arch: metrics.systemInfo.arch,
        load: metrics.systemInfo.loadAvg,
        uptime: formatUptime(metrics.systemInfo.uptimeSeconds),
      },
      cpuHistory: cpuHistory,
      currentCPU: Math.round(metrics.cpu.usagePercent),
      memory: {
        ram: {
          ...formatBytes(metrics.memory.ramUsedBytes),
          total: formatBytes(metrics.memory.ramTotalBytes).value,
          totalUnit: formatBytes(metrics.memory.ramTotalBytes).unit,
          percent: Math.round((metrics.memory.ramUsedBytes / metrics.memory.ramTotalBytes) * 100),
        },
        swap: {
          ...formatBytes(metrics.memory.swapUsedBytes),
          total: formatBytes(metrics.memory.swapTotalBytes).value,
          totalUnit: formatBytes(metrics.memory.swapTotalBytes).unit,
          percent: metrics.memory.swapTotalBytes > 0
            ? Math.round((metrics.memory.swapUsedBytes / metrics.memory.swapTotalBytes) * 100)
            : 0,
        },
      },
      networkHistory: networkHistory,
      currentNetwork: {
        download: Math.round(metrics.network.bytesRecvPerSec / 1024),
        upload: Math.round(metrics.network.bytesSentPerSec / 1024),
      },
      disks: metrics.disks.map(disk => ({
        name: disk.mountPoint,
        ...formatBytes(disk.usedBytes),
        total: formatBytes(disk.totalBytes).value,
        totalUnit: formatBytes(disk.totalBytes).unit,
        percent: Math.round((disk.usedBytes / disk.totalBytes) * 100),
      })),
      diskTotalPercent: Math.round(metrics.diskTotalPercent),
    };
  }, [metrics, getMetricsHistory]);

  // 渲染状态提示
  const renderStatusHint = () => {
    if (!serverId) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">未选择服务器</p>
          <p className="text-xs mt-1">请先连接到服务器</p>
        </div>
      );
    }

    if (status === WSStatus.CONNECTING) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Loader2 className="w-12 h-12 mb-4 animate-spin opacity-50" />
          <p className="text-sm">正在连接监控服务...</p>
        </div>
      );
    }

    if (status === WSStatus.ERROR || status === WSStatus.DISCONNECTED) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <WifiOff className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">监控连接已断开</p>
          <p className="text-xs mt-1">正在尝试重新连接...</p>
        </div>
      );
    }

    return null;
  };

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
        "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
        className
      )}
    >
      {/* 显示状态提示或数据 */}
      {!formattedMetrics || status !== WSStatus.CONNECTED ? (
        renderStatusHint()
      ) : (
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
      )}
    </div>
  );
};

MonitorPanel.displayName = 'MonitorPanel';
