/**
 * 磁盘使用组件
 * 使用 recharts 堆叠柱状图显示磁盘使用情况
 * 固定高度 142px
 */

"use client"

import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { DiskData } from '../types/metrics';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

interface DiskUsageProps {
  data: DiskData[];
}

/**
 * 图表配置
 */
const chartConfig = {
  used: {
    label: "已使用",
    color: "var(--chart-1)",
  },
  free: {
    label: "剩余",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

/**
 * 磁盘使用组件
 */
export const DiskUsage: React.FC<DiskUsageProps> = React.memo(({ data }) => {
  // 转换数据格式为 recharts 需要的格式
  const chartData = data.map(disk => ({
    name: disk.name,
    used: disk.used,
    free: disk.total - disk.used,
    total: disk.total,
    percent: disk.percent,
  }));

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-medium">磁盘</span>
      </div>

      {/* 图表区域 - 固定高度 106px */}
      <div className="h-[106px] w-full">
        <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
          {({ width, height }) => (
          <BarChart
            width={width}
            height={height}
            data={chartData}
            layout="vertical"
            margin={{
              left: 0,
              right: 12,
              top: 8,
              bottom: 8,
            }}
            barSize={chartData.length === 1 ? 30 : undefined}
          >
            <CartesianGrid
              horizontal={false}
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", opacity: 0.7 }}
              tickFormatter={(value) => `${value}G`}
            />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              width={60}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) {
                  return null;
                }

                const data = payload[0].payload;

                return (
                  <div className="rounded-lg border bg-background px-2.5 py-2 shadow-xl">
                    <div className="mb-1.5 text-xs font-medium">
                      {data.name}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: 'var(--chart-1)' }}
                        />
                        <span className="text-muted-foreground">已使用:</span>
                        <span className="font-mono font-medium">{data.used}G</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: 'var(--chart-2)' }}
                        />
                        <span className="text-muted-foreground">剩余:</span>
                        <span className="font-mono font-medium">{data.free.toFixed(0)}G</span>
                      </div>
                      <div className={`font-medium pl-3.5 ${
                        data.percent > 90 ? 'text-red-500' : data.percent > 80 ? 'text-yellow-500' : ''
                      }`}>
                        {data.percent}%
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="used"
              stackId="a"
              fill="var(--color-used)"
              radius={[4, 0, 0, 4]}
            />
            <Bar
              dataKey="free"
              stackId="a"
              fill="var(--color-free)"
              radius={[0, 4, 4, 0]}
              opacity={0.3}
            />
          </BarChart>
          )}
        </ChartContainer>
      </div>
    </div>
  );
});

DiskUsage.displayName = 'DiskUsage';
