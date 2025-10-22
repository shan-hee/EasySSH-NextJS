/**
 * 网络流量图表组件
 * 使用 recharts 库显示上行和下行流量
 * 固定高度 142px
 */

"use client"

import React from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { NetworkData } from '../types/metrics';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

interface NetworkChartProps {
  data: NetworkData[];
  currentDownload: number;
  currentUpload: number;
}

/**
 * 格式化速率 (自动转换单位)
 */
function formatSpeed(kbps: number): string {
  if (kbps >= 1024) {
    return `${(kbps / 1024).toFixed(1)}MB/s`;
  }
  return `${kbps.toFixed(0)}KB/s`;
}

/**
 * 图表配置
 */
const chartConfig = {
  download: {
    label: "下载",
    color: "var(--chart-3)",
  },
  upload: {
    label: "上传",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

/**
 * 网络流量图表组件
 */
export const NetworkChart: React.FC<NetworkChartProps> = React.memo(({
  data,
  currentDownload,
  currentUpload,
}) => {
  // 转换数据格式为 recharts 需要的格式
  const chartData = data.map(item => ({
    time: item.time.slice(3, 8), // 只显示时间部分
    download: item.download,
    upload: item.upload,
  }));

  // 计算Y轴的最大值用于显示刻度
  const maxValue = chartData.length > 0
    ? Math.max(...chartData.map(d => Math.max(d.download, d.upload)), 100)
    : 100;

  const yAxisTicks = [
    0,
    Math.round(maxValue * 0.33),
    Math.round(maxValue * 0.66),
    Math.round(maxValue)
  ];

  // 格式化 Y 轴刻度标签
  const formatYAxisTick = (value: number): string => {
    if (value === 0) return '0';
    if (value >= 1024) return `${(value / 1024).toFixed(0)}M`;
    return `${value}K`;
  };

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-medium">网络</span>
        <div className="text-xs font-mono tabular-nums flex items-center gap-2">
          <span style={{ color: 'var(--chart-3)' }}>↓ {formatSpeed(currentDownload)}</span>
          <span style={{ color: 'var(--chart-5)' }}>↑ {formatSpeed(currentUpload)}</span>
        </div>
      </div>

      {/* 图表区域 - 固定高度 106px */}
      <div className="h-[106px] w-full relative">
        {/* 内嵌 Y 轴标签 */}
        <div className="absolute left-1 top-2 bottom-4 flex flex-col justify-between text-[9px] text-muted-foreground/70 pointer-events-none z-10">
          {[...yAxisTicks].reverse().map((value, idx) => (
            <span key={idx} className="leading-none">
              {value === 0 ? '' : formatYAxisTick(value)}
            </span>
          ))}
        </div>

        <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
          <LineChart
            data={chartData}
            margin={{
              left: 12,
              right: 12,
              top: 8,
              bottom: 0,
            }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <ChartTooltip
              cursor={false}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) {
                  return null;
                }

                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
                    <div className="mb-1.5 text-xs font-medium text-foreground">
                      时间: {label}
                    </div>
                    <div className="space-y-1">
                      {payload.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-muted-foreground">
                            {item.name === 'download' ? '下载' : '上传'}:
                          </span>
                          <span className="font-mono font-medium text-foreground">
                            {formatSpeed(item.value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            <Line
              dataKey="download"
              type="natural"
              stroke="var(--color-download)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 0,
                style: { transition: 'cx 300ms ease-out, cy 300ms ease-out' }
              }}
              animationDuration={300}
              animationEasing="ease-out"
              isAnimationActive={true}
            />
            <Line
              dataKey="upload"
              type="natural"
              stroke="var(--color-upload)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 0,
                style: { transition: 'cx 300ms ease-out, cy 300ms ease-out' }
              }}
              animationDuration={300}
              animationEasing="ease-out"
              isAnimationActive={true}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
});

NetworkChart.displayName = 'NetworkChart';
