/**
 * 内存使用图表组件
 * 使用 recharts RadialBarChart 显示 RAM 和 Swap
 * 固定高度 142px
 */

"use client"

import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import type { MemoryData } from '../types/metrics';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

interface MemoryChartProps {
  data: MemoryData;
}

/**
 * 图表配置
 */
const chartConfig = {
  ram: {
    label: "RAM",
    color: "var(--chart-2)",
  },
  swap: {
    label: "Swap",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

/**
 * 内存使用图表组件
 */
export const MemoryChart: React.FC<MemoryChartProps> = React.memo(({ data }) => {
  // 转换数据格式为 recharts 需要的格式
  // 注意：数组顺序决定了径向条的层叠顺序（从内到外）
  const chartData = [
    {
      name: "swap",
      value: data.swap.percent,
      fill: "var(--color-swap)",
    },
    {
      name: "ram",
      value: data.ram.percent,
      fill: "var(--color-ram)",
    },
  ];

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-semibold">内存</span>
      </div>

      {/* 图表区域 - 固定高度 106px,左图右文 */}
      <div className="h-[106px] flex items-center gap-3">
        {/* 左侧:径向条形图 */}
        <div className="w-[100px] h-[100px] relative flex-shrink-0">
          <ChartContainer config={chartConfig} className="w-full h-full">
            {({ width, height }) => (
            <RadialBarChart
              width={width}
              height={height}
              data={chartData}
              startAngle={90}
              endAngle={450}
              innerRadius={22}
              outerRadius={50}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) {
                    return null;
                  }

                  const item = payload[0].payload;
                  const isRAM = item.name === 'ram';
                  const memData = isRAM ? data.ram : data.swap;

                  return (
                    <div className="rounded-lg border bg-background px-2.5 py-2 shadow-xl">
                      <div className="flex items-center gap-2 text-xs font-medium mb-1.5">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span>{isRAM ? 'RAM' : 'Swap'}</span>
                      </div>
                      <div className="text-xs font-mono space-y-0.5 pl-3.5">
                        <div className={`font-medium ${
                          memData.percent > 85 ? 'text-red-500' : memData.percent > 70 ? 'text-yellow-500' : ''
                        }`}>
                          {memData.percent}%
                        </div>
                        <div className="text-muted-foreground">
                          {memData.value} {memData.unit} / {memData.total} {memData.totalUnit}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <RadialBar
                dataKey="value"
                background
                cornerRadius={5}
              />
            </RadialBarChart>
            )}
          </ChartContainer>

        </div>

        {/* 右侧:文字信息 */}
        <div className="flex-1 space-y-3 text-xs min-w-0">
          {/* RAM 信息 */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--chart-2)' }} />
              <span className="font-medium">RAM</span>
            </div>
            <div className={`font-medium tabular-nums pl-3.5 ${
              data.ram.percent > 85 ? 'text-red-500' : data.ram.percent > 70 ? 'text-yellow-500' : ''
            }`}>
              {data.ram.percent}%
            </div>
            <div className="text-muted-foreground font-mono tabular-nums text-[11px] pl-3.5">
              {data.ram.value} {data.ram.unit} / {data.ram.total} {data.ram.totalUnit}
            </div>
          </div>

          {/* Swap 信息 */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--chart-4)' }} />
              <span className="font-medium">Swap</span>
            </div>
            <div className={`font-medium tabular-nums pl-3.5 ${
              data.swap.percent > 85 ? 'text-red-500' : data.swap.percent > 70 ? 'text-yellow-500' : ''
            }`}>
              {data.swap.percent}%
            </div>
            <div className="text-muted-foreground font-mono tabular-nums text-[11px] pl-3.5">
              {data.swap.value} {data.swap.unit} / {data.swap.total} {data.swap.totalUnit}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

MemoryChart.displayName = 'MemoryChart';
