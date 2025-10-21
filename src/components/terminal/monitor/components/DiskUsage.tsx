/**
 * 磁盘使用组件
 * 显示多个磁盘分区的使用情况,使用进度条可视化
 * 总高度约 155px
 */

import React from 'react';
import { Progress } from '@/components/ui/progress';
import type { DiskData } from '../types/metrics';
import { cn } from '@/lib/utils';

interface DiskUsageProps {
  data: DiskData[];
}

/**
 * 单个磁盘信息组件
 */
const DiskItem: React.FC<{ disk: DiskData }> = ({ disk }) => {
  return (
    <div className="space-y-1">
      {/* 磁盘名称和容量 */}
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium truncate">{disk.name}</span>
        <span className="font-mono tabular-nums text-muted-foreground shrink-0 ml-2">
          {disk.used}G / {disk.total}G
        </span>
      </div>

      {/* 进度条 */}
      <Progress
        value={disk.percent}
        className={cn(
          "h-2",
          disk.percent > 90 && "[&>div]:bg-red-500",
          disk.percent > 80 && disk.percent <= 90 && "[&>div]:bg-yellow-500"
        )}
      />
    </div>
  );
};

/**
 * 磁盘使用组件
 */
export const DiskUsage: React.FC<DiskUsageProps> = React.memo(({ data }) => {
  return (
    <div className="space-y-1">
      {/* 模块标题 - 高度 28px */}
      <div className="h-7 flex items-center">
        <span className="text-xs font-medium">磁盘</span>
      </div>

      {/* 磁盘列表 - 每个磁盘约 50px */}
      <div className="space-y-3">
        {data.map((disk, index) => (
          <DiskItem key={`${disk.name}-${index}`} disk={disk} />
        ))}
      </div>
    </div>
  );
});

DiskUsage.displayName = 'DiskUsage';
