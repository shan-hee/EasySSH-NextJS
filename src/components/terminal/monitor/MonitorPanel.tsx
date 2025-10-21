/**
 * 系统监控主面板组件
 * 固定宽度 250px, 高度 915px
 * 整合所有监控子组件,实现紧凑美观的布局
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useSystemMetrics } from './hooks/useSystemMetrics';
import { SystemInfo } from './components/SystemInfo';
import { CPUChart } from './components/CPUChart';
import { MemoryChart } from './components/MemoryChart';
import { NetworkChart } from './components/NetworkChart';
import { DiskUsage } from './components/DiskUsage';

interface MonitorPanelProps {
  className?: string;
}

/**
 * 监控面板主组件
 *
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
export const MonitorPanel: React.FC<MonitorPanelProps> = ({ className }) => {
  // 获取实时监控数据
  const metrics = useSystemMetrics();

  return (
    <div
      className={cn(
        // 固定宽度,最小高度
        "w-[250px] min-h-[720px] flex-shrink-0",
        // 内边距和间距
        "py-1.5 px-3 space-y-1.5",
        // 样式 - 移除边框（由外层容器处理）
        "overflow-y-auto",
        // 滚动条样式
        "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
        className
      )}
    >
      {/* 1. 系统信息 - 148px */}
      <div className="min-h-[148px]">
        <SystemInfo data={metrics.systemInfo} />
      </div>

      {/* 2. CPU 图表 - 134px */}
      <div className="min-h-[134px]">
        <CPUChart data={metrics.cpuHistory} currentUsage={metrics.currentCPU} />
      </div>

      {/* 3. 内存图表 - 134px */}
      <div className="min-h-[134px]">
        <MemoryChart data={metrics.memory} />
      </div>

      {/* 4. 网络图表 - 134px */}
      <div className="min-h-[134px]">
        <NetworkChart
          data={metrics.networkHistory}
          currentDownload={metrics.currentNetwork.download}
          currentUpload={metrics.currentNetwork.upload}
        />
      </div>

      {/* 5. 磁盘使用 - 134px */}
      <div className="min-h-[134px]">
        <DiskUsage data={metrics.disks} />
      </div>
    </div>
  );
};

MonitorPanel.displayName = 'MonitorPanel';
