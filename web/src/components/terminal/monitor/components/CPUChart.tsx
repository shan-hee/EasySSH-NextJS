/**
 * CPU 使用率图表组件
 * 使用 recharts AreaChart 显示最近 20 个数据点的 CPU 使用率
 * 固定高度 142px
 */

"use client"

import React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { CPUData } from '../types/metrics';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { AnimatedActiveDot } from './AnimatedActiveDot';

interface CPUChartProps {
  data: CPUData[];
  currentUsage: number;
}

/**
 * 图表配置
 */
const chartConfig = {
  usage: {
    label: "CPU",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * CPU 使用率图表组件
 */
export const CPUChart: React.FC<CPUChartProps> = React.memo(({ data, currentUsage }) => {
  // 转换数据格式为 recharts 需要的格式
  const chartData = data.map(item => ({
    time: item.time.slice(3, 8), // 只显示时间部分
    usage: item.usage,
  }));

  // Y 轴刻度值
  const yAxisTicks = [0, 25, 50, 75, 100];

  // 计算 X 轴刻度间隔 - 根据数据点数量动态调整
  // 数据点少时显示更多刻度，数据点多时显示更少刻度
  const getXAxisInterval = () => {
    const dataLength = chartData.length;
    if (dataLength <= 2) return 0; // 显示所有刻度
    if (dataLength <= 5) return 1; // 每隔 1 个显示
    return 'preserveStartEnd'; // 只显示首尾
  };

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-semibold">CPU</span>
        <span className={`text-xs font-mono font-semibold tabular-nums ${
          currentUsage > 80 ? 'text-red-500' : currentUsage > 60 ? 'text-yellow-500' : 'text-muted-foreground'
        }`}>
          {currentUsage}%
        </span>
      </div>

      {/* 图表区域 - 固定高度 106px */}
      <div className="h-[106px] w-full relative">
        {/* 内嵌 Y 轴标签 */}
        <div className="absolute left-1 top-2 bottom-4 flex flex-col justify-between text-[9px] text-muted-foreground/70 pointer-events-none z-10">
          {[...yAxisTicks].reverse().map((value, idx) => (
            <span key={idx} className="leading-none">
              {value === 0 ? '' : value}
            </span>
          ))}
        </div>

        {/* 当数据为空时显示提示 */}
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            等待数据...
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
            {({ width, height }) => (
            <AreaChart
              width={width}
              height={height}
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 8,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id="fillCPU" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-usage)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-usage)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
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
                interval={getXAxisInterval()}
              />
              <YAxis hide domain={[0, 100]} />
              <ChartTooltip
                cursor={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) {
                    return null;
                  }

                  const usage = payload[0].value as number;

                  return (
                    <div className="rounded-lg border bg-background px-2.5 py-2 shadow-xl">
                      <div className="mb-1.5 text-xs font-medium text-foreground">
                        时间: {label}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium mb-1">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: 'var(--chart-1)' }}
                        />
                        <span>CPU</span>
                      </div>
                      <div className="text-xs font-mono pl-3.5">
                        <div className={`font-medium ${
                          usage > 80 ? 'text-red-500' : usage > 60 ? 'text-yellow-500' : ''
                        }`}>
                          {usage}%
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                dataKey="usage"
                type="natural"
                fill="url(#fillCPU)"
                fillOpacity={0.4}
                stroke="var(--color-usage)"
                strokeWidth={2}
                dot={false}
                activeDot={<AnimatedActiveDot r={3} animationDuration={300} />}
                animationDuration={300}
                animationEasing="ease-out"
                isAnimationActive={true}
              />
            </AreaChart>
            )}
          </ChartContainer>
        )}
      </div>
    </div>
  );
});

CPUChart.displayName = 'CPUChart';
