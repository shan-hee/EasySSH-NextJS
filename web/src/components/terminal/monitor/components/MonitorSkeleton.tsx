/**
 * 监控面板骨架屏
 * 在数据加载时显示优雅的占位符
 * 使用 shadcn/ui 的 Skeleton 组件
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 系统信息骨架
 */
const SystemInfoSkeleton: React.FC = () => (
  <div className="space-y-1">
    <div className="h-7 flex items-center">
      <Skeleton className="h-3 w-16" />
    </div>
    <div className="space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center h-5 px-1.5">
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * CPU/网络 曲线图骨架（Area/Line Chart）
 */
const LineChartSkeleton: React.FC<{ title: string; showPercentage?: boolean }> = ({
  title,
  showPercentage = true
}) => (
  <div className="space-y-1">
    {/* 标题行 */}
    <div className="flex justify-between items-center h-7">
      <Skeleton className="h-3 w-12" />
      {showPercentage ? (
        <Skeleton className="h-3 w-10" />
      ) : (
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      )}
    </div>

    {/* 曲线图区域 */}
    <div className="h-[106px] relative px-2">
      {/* Y轴刻度 */}
      <div className="absolute left-1 top-2 bottom-4 flex flex-col justify-between">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-2 w-4" />
        ))}
      </div>

      {/* 模拟曲线 */}
      <div className="h-full flex items-end justify-between gap-0.5 pl-6 pr-1 pb-2">
        {Array.from({ length: 20 }).map((_, i) => {
          const height = 20 + Math.sin(i * 0.5) * 30 + Math.random() * 20;
          return (
            <Skeleton
              key={i}
              className="flex-1"
              style={{
                height: `${height}%`,
                minWidth: '2px',
              }}
            />
          );
        })}
      </div>

      {/* X轴刻度 */}
      <div className="absolute bottom-0 left-6 right-1 flex justify-between">
        <Skeleton className="h-2 w-8" />
        <Skeleton className="h-2 w-8" />
      </div>
    </div>
  </div>
);

/**
 * 内存 径向图骨架（Radial Chart）
 */
const RadialChartSkeleton: React.FC = () => (
  <div className="space-y-1">
    {/* 标题行 */}
    <div className="flex justify-between items-center h-7">
      <Skeleton className="h-3 w-12" />
    </div>

    {/* 径向图区域 */}
    <div className="h-[106px] flex items-center gap-3">
      {/* 左侧：文字信息 */}
      <div className="flex-1 space-y-3">
        {/* RAM */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-2.5 w-10" />
            <Skeleton className="h-2.5 w-8" />
          </div>
          <Skeleton className="h-2 w-24 ml-3.5" />
        </div>

        {/* Swap */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-2.5 w-10" />
            <Skeleton className="h-2.5 w-8" />
          </div>
          <Skeleton className="h-2 w-24 ml-3.5" />
        </div>
      </div>

      {/* 右侧：圆形图 */}
      <div className="w-[100px] h-[100px] flex-shrink-0 flex items-center justify-center">
        <Skeleton className="w-20 h-20 rounded-full" />
      </div>
    </div>
  </div>
);

/**
 * 磁盘 柱状图骨架（Bar Chart）
 */
const BarChartSkeleton: React.FC = () => (
  <div className="space-y-1">
    {/* 标题行 */}
    <div className="flex justify-between items-center h-7">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-3 w-10" />
    </div>

    {/* 柱状图区域 */}
    <div className="h-[106px] flex flex-col justify-center gap-2 px-2">
      {/* 水平柱状条 */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          {/* 标签 */}
          <Skeleton className="h-3 w-12 flex-shrink-0" />
          {/* 柱状条 */}
          <Skeleton
            className="h-6 flex-1"
            style={{
              width: `${60 + Math.random() * 30}%`,
            }}
          />
        </div>
      ))}
    </div>
  </div>
);

/**
 * 监控面板完整骨架屏
 */
export const MonitorSkeleton: React.FC = () => {
  return (
    <div className="w-full py-1.5 px-3 space-y-1.5">
      {/* 系统信息骨架 - 148px */}
      <div className="min-h-[148px]">
        <SystemInfoSkeleton />
      </div>

      {/* CPU 曲线图骨架 - 134px */}
      <div className="min-h-[134px]">
        <LineChartSkeleton title="CPU" showPercentage={true} />
      </div>

      {/* 内存 径向图骨架 - 134px */}
      <div className="min-h-[134px]">
        <RadialChartSkeleton />
      </div>

      {/* 网络 曲线图骨架 - 134px */}
      <div className="min-h-[134px]">
        <LineChartSkeleton title="网络" showPercentage={false} />
      </div>

      {/* 磁盘 柱状图骨架 - 134px */}
      <div className="min-h-[134px]">
        <BarChartSkeleton />
      </div>
    </div>
  );
};
