/**
 * 内存使用图表组件
 * 使用双层圆环图显示 RAM 和 Swap
 * 固定高度 142px
 */

import React from 'react';
import type { MemoryData } from '../types/metrics';

interface MemoryChartProps {
  data: MemoryData;
}

/**
 * 绘制圆环进度 - 使用 conic-gradient 实现
 */
const RingProgress: React.FC<{
  percent: number;
  size: number;
  thickness: number;
  color: string;
}> = ({ percent, size, thickness }) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="transparent"
      stroke="currentColor"
      strokeWidth={thickness}
      strokeDasharray={circumference}
      strokeDashoffset={offset}
      strokeLinecap="round"
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
      style={{ transition: 'stroke-dashoffset 0.3s ease' }}
    />
  );
};

/**
 * 内存使用图表组件
 */
export const MemoryChart: React.FC<MemoryChartProps> = React.memo(({ data }) => {
  const svgSize = 110;

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-medium">内存</span>
        <span className={`text-xs font-mono tabular-nums ${
          data.ram.percent > 85 ? 'text-red-500' : data.ram.percent > 70 ? 'text-yellow-500' : 'text-muted-foreground'
        }`}>
          {data.ram.percent}%
        </span>
      </div>

      {/* 图表区域 - 固定高度 142px,左图右文 */}
      <div className="h-[142px] flex items-center gap-3">
        {/* 左侧:双层圆环 */}
        <div className="w-[110px] h-[110px] relative flex items-center justify-center flex-shrink-0">
          <svg width={svgSize} height={svgSize} className="absolute">
            {/* 背景圆环 - Swap (内圈) */}
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={34}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={12}
              opacity={0.15}
            />

            {/* Swap 进度 (内圈) - 紫色 */}
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={34}
              fill="transparent"
              stroke="#a855f7"
              strokeWidth={12}
              strokeDasharray={2 * Math.PI * 34}
              strokeDashoffset={2 * Math.PI * 34 - (data.swap.percent / 100) * 2 * Math.PI * 34}
              transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />

            {/* 背景圆环 - RAM (外圈) */}
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={46}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={12}
              opacity={0.15}
            />

            {/* RAM 进度 (外圈) - 蓝色 */}
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={46}
              fill="transparent"
              stroke="#3b82f6"
              strokeWidth={12}
              strokeDasharray={2 * Math.PI * 46}
              strokeDashoffset={2 * Math.PI * 46 - (data.ram.percent / 100) * 2 * Math.PI * 46}
              transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>

          {/* 中心百分比 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold tabular-nums">{data.ram.percent}%</span>
          </div>
        </div>

        {/* 右侧:文字信息 */}
        <div className="flex-1 space-y-3 text-xs min-w-0">
          {/* RAM 信息 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
              <span className="font-medium">RAM</span>
            </div>
            <div className="text-muted-foreground font-mono tabular-nums text-[11px] pl-3.5">
              {data.ram.used.toFixed(1)}G / {data.ram.total}G
            </div>
          </div>

          {/* Swap 信息 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'hsl(var(--chart-4))' }} />
              <span className="font-medium">Swap</span>
            </div>
            <div className="text-muted-foreground font-mono tabular-nums text-[11px] pl-3.5">
              {data.swap.used.toFixed(1)}G / {data.swap.total}G
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

MemoryChart.displayName = 'MemoryChart';
