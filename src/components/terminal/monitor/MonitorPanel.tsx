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
 * 高度分配 (总计 915px):
 * - 顶部内边距: 12px
 * - 系统信息: 168px (标题24px + 内容144px)
 * - 间距: 8px
 * - CPU图表: 170px (标题28px + 图表142px)
 * - 间距: 8px
 * - 内存图表: 170px (标题28px + 图表142px)
 * - 间距: 8px
 * - 网络图表: 170px (标题28px + 图表142px)
 * - 间距: 8px
 * - 磁盘使用: 155px (标题28px + 磁盘条×2~3)
 * - 底部内边距: 12px
 */
export const MonitorPanel: React.FC<MonitorPanelProps> = ({ className }) => {
  // 获取实时监控数据
  const metrics = useSystemMetrics();

  return (
    <div
      className={cn(
        // 固定宽度,最小高度
        "w-[250px] min-h-[915px] flex-shrink-0",
        // 内边距和间距
        "py-3 px-3 space-y-2",
        // 样式
        "border-r overflow-y-auto",
        "bg-gradient-to-b from-background to-muted/20",
        "border-border/50",
        // 滚动条样式
        "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
        className
      )}
    >
      {/* 1. 系统信息 - 168px */}
      <div className="min-h-[168px]">
        <SystemInfo data={metrics.systemInfo} />
      </div>

      {/* 2. CPU 图表 - 170px */}
      <div className="min-h-[170px]">
        <CPUChart data={metrics.cpuHistory} currentUsage={metrics.currentCPU} />
      </div>

      {/* 3. 内存图表 - 170px */}
      <div className="min-h-[170px]">
        <MemoryChart data={metrics.memory} />
      </div>

      {/* 4. 网络图表 - 170px */}
      <div className="min-h-[170px]">
        <NetworkChart
          data={metrics.networkHistory}
          currentDownload={metrics.currentNetwork.download}
          currentUpload={metrics.currentNetwork.upload}
        />
      </div>

      {/* 5. 磁盘使用 - 155px */}
      <div className="min-h-[155px]">
        <DiskUsage data={metrics.disks} />
      </div>
    </div>
  );
};

MonitorPanel.displayName = 'MonitorPanel';
