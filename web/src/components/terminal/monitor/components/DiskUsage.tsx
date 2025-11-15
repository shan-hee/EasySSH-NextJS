"use client"

import React from 'react';
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { DiskData } from '../types/metrics';
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { useEchartsColors } from "@/lib/echarts-theme";

interface DiskUsageProps {
  data: DiskData[];
  totalPercent: number;
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
 * 使用 ECharts 堆叠条形图显示磁盘使用情况
 * 固定高度 142px
 */
export const DiskUsage: React.FC<DiskUsageProps> = React.memo(({ data, totalPercent }) => {
  // 转换数据格式为图表需要的格式
  const chartData = React.useMemo(
    () =>
      data.map((disk) => ({
        name: disk.name,
        used: disk.value,
        free: disk.total - disk.value,
        total: disk.total,
        percent: disk.percent,
        unit: disk.unit,
        totalUnit: disk.totalUnit,
      })),
    [data]
  );

  const colors = useEchartsColors(chartConfig);
  const usedColor = colors.used || "#4b9cff";
  const freeColor = colors.free || "#a5b4fc";

  const option: EChartsOption = React.useMemo(() => {
    const names = chartData.map((item) => item.name);
    // 使用后端传来的整机总容量作为 X 轴最大值, 精确显示总数
    const maxTotal = chartData.length > 0 ? chartData[0].total : undefined;

    return {
      animation: true,
      animationDuration: 220,
      animationEasing: "cubicOut",
      // 慢速变化数据使用更慢的动画
      animationDurationUpdate: 300,
      animationEasingUpdate: "cubicOut",
      grid: {
        // 与上方图表对齐, 不再给左侧名称预留空间
        left: 12,
        right: 12,
        top: 8,
        bottom: 8,
      },
      legend: { show: false },
      tooltip: {
        // 仅针对当前条形项显示 tooltip，不使用轴高亮阴影
        trigger: "item",
        axisPointer: { type: "none" },
        borderRadius: 6,
        padding: 8,
        backgroundColor: "rgba(15,23,42,0.88)",
        borderColor: "rgba(148,163,184,0.15)",
        borderWidth: 1,
        textStyle: {
          fontSize: 11,
        },
        formatter: (params: any) => {
          const list = Array.isArray(params) ? params : [params];
          if (!list.length) return "";
          const base = list[0];
          const data = base.data || {};
          const used = data.used ?? data.value ?? 0;
          const free = data.free ?? 0;
          const unit = data.unit || "";
           const total = data.total ?? (used + free);
           const totalUnit = data.totalUnit || unit;
          const percent = data.percent ?? 0;
          const freeDisplay =
            typeof free === "number" && Number.isFinite(free)
              ? free.toFixed(1)
              : free;

          const percentColor =
            percent > 90
              ? "rgb(239,68,68)"
              : percent > 80
              ? "rgb(234,179,8)"
              : "rgba(248,250,252,1)";

          return `
            <div style="font-size:11px;">
              <div style="margin-bottom:4px;">总容量: ${total} ${totalUnit}</div>
              <div style="margin-bottom:2px;display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${usedColor};"></span>
                <span>已使用:</span>
                <span style="font-family:var(--font-geist-mono,ui-monospace);font-weight:600;">
                  ${used} ${unit}
                </span>
              </div>
              <div style="margin-bottom:2px;display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${freeColor};"></span>
                <span>剩余:</span>
                <span style="font-family:var(--font-geist-mono,ui-monospace);font-weight:600;">
                  ${freeDisplay} ${unit}
                </span>
              </div>
              <div style="padding-left:14px;font-weight:600;color:${percentColor};">
                ${percent}%
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: "value",
        max: maxTotal,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "rgba(148,163,184,0.9)",
          fontSize: 9,
          // 强制显示最大值标签
          showMaxLabel: true,
          showMinLabel: true,
          formatter: (value: number) => {
            const unit = chartData[0]?.unit || "GB";
            // 对于最大值，显示2位小数
            if (maxTotal && Math.abs(value - maxTotal) < 0.01) {
              return `${maxTotal.toFixed(2)}${unit}`;
            }
            // 其他刻度显示整数
            return `${Math.round(value)}${unit}`;
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: "rgba(148,163,184,0.3)",
            opacity: 0.3,
            type: "dashed",
          },
        },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLine: { show: false },
        axisTick: { show: false },
        // 不显示左侧挂载点名称, 只保留进度条
        axisLabel: { show: false },
      },
      series: [
        {
          name: "used",
          type: "bar",
          stack: "total",
          barWidth: chartData.length === 1 ? 30 : 18,
          itemStyle: {
            color: usedColor,
            borderRadius: [4, 0, 0, 4],
          },
          // 悬浮时仅显示 tooltip，不改变条形样式
          emphasis: {
            disabled: true,
          },
          data: chartData.map((item) => ({
            value: item.used,
            ...item,
          })),
        },
        {
          name: "free",
          type: "bar",
          stack: "total",
          barWidth: chartData.length === 1 ? 30 : 18,
          itemStyle: {
            color: freeColor,
            opacity: 0.3,
            borderRadius: [0, 4, 4, 0],
          },
          emphasis: {
            disabled: true,
          },
          data: chartData.map((item) => ({
            value: item.free,
            ...item,
          })),
        },
      ],
    };
  }, [chartData, usedColor, freeColor]);

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-semibold">磁盘</span>
        <span className={`text-xs font-mono font-semibold tabular-nums transition-colors duration-500 ${
          totalPercent > 90 ? 'text-red-500' : totalPercent > 80 ? 'text-yellow-500' : 'text-muted-foreground'
        }`}>
          {totalPercent}%
        </span>
      </div>

      {/* 图表区域 - 固定高度 106px */}
      <div className="h-[106px] w-full">
        <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
          {(_size) => (
            <ReactECharts
              option={option}
              style={{ width: "100%", height: "100%" }}
              notMerge={false}
              lazyUpdate={true}
            />
          )}
        </ChartContainer>
      </div>
    </div>
  );
});

DiskUsage.displayName = 'DiskUsage';
