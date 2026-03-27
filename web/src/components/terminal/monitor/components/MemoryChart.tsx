"use client"

import React from 'react';
import { useTranslations } from "next-intl";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { MemoryData } from '../types/metrics';
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { useEchartsColors } from "@/lib/echarts-theme";
import { MONITOR_COLORS } from "../constants/colors";

interface MemoryChartProps {
  data: MemoryData;
}

/**
 * 图表配置
 */
const chartConfig = {
  ram: {
    label: "RAM",
    color: MONITOR_COLORS.memory.ram,
  },
  swap: {
    label: "Swap",
    color: MONITOR_COLORS.memory.swap,
  },
} satisfies ChartConfig;

/**
 * 内存使用图表组件
 * 使用 ECharts 同心环形图显示 RAM 和 Swap
 * 固定高度 142px
 */
export const MemoryChart: React.FC<MemoryChartProps> = React.memo(({ data }) => {
  const t = useTranslations("terminalMonitor");
  const memoryTooltipUsedLabel = t("memoryTooltipUsed");
  const chartData = React.useMemo(
    () => ({
      ramPercent: data.ram.percent,
      swapPercent: data.swap.percent,
    }),
    [data]
  );

  const colors = useEchartsColors(chartConfig);
  const ramColor = colors.ram || MONITOR_COLORS.memory.ram;
  const swapColor = colors.swap || MONITOR_COLORS.memory.swap;

  const option: EChartsOption = React.useMemo(() => {
    const ramPercent = Math.max(0, Math.min(100, chartData.ramPercent));
    const swapPercent = Math.max(0, Math.min(100, chartData.swapPercent));

    const ramRest = Math.max(0, 100 - ramPercent);
    const swapRest = Math.max(0, 100 - swapPercent);

    const ramBgColor = "rgba(148,163,184,0.18)";
    const swapBgColor = "rgba(148,163,184,0.24)";

    return {
      animation: true,
      animationDuration: 220,
      animationEasing: "cubicOut",
      // 慢速变化数据使用更慢的动画
      animationDurationUpdate: 300,
      animationEasingUpdate: "cubicOut",
      tooltip: {
        trigger: "item",
        borderRadius: 6,
        padding: 8,
        backgroundColor: "rgba(15,23,42,0.88)",
        borderColor: "rgba(148,163,184,0.15)",
        borderWidth: 1,
        textStyle: {
          fontSize: 11,
        },
        formatter: (params) => {
          const point = (
            Array.isArray(params) ? params[0] : params
          ) as {
            seriesName?: string
            color?: string
          } | undefined;
          if (!point) return ""
          const isRam = point.seriesName === "RAM";
          const mem = isRam ? data.ram : data.swap;
          return `
            <div style="font-size:11px;">
              <div style="margin-bottom:4px;">${isRam ? "RAM" : "Swap"}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${point.color};"></span>
                <span>${memoryTooltipUsedLabel}</span>
                <span style="font-family:var(--font-jetbrains-mono),ui-monospace;font-weight:600;">
                  ${mem.value} ${mem.unit}
                </span>
              </div>
              <div style="padding-left:14px;font-weight:600;">
                ${mem.percent}%
              </div>
            </div>
          `;
        },
      },
      series: [
        {
          name: "RAM",
          type: "pie",
          // 外圈：RAM
          radius: ["62%", "80%"],
          center: ["50%", "50%"],
          silent: false,
          // 为避免悬浮时颜色丢失，完全关闭高亮，只保留 tooltip
          emphasis: {
            disabled: true,
          },
          // 圆角环形效果（添加微妙阴影）
          itemStyle: {
            borderRadius: 8,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            shadowBlur: 8,
            shadowOffsetY: 2,
          },
          label: { show: false },
          labelLine: { show: false },
          data: [
            {
              value: ramPercent,
              name: "used",
              itemStyle: { color: ramColor },
            },
            {
              value: ramRest,
              name: "rest",
              itemStyle: { color: ramBgColor },
              tooltip: { show: false },
            },
          ],
        },
        {
          name: "Swap",
          type: "pie",
          // 内圈：Swap
          radius: ["40%", "56%"],
          center: ["50%", "50%"],
          silent: false,
          emphasis: {
            disabled: true,
          },
          itemStyle: {
            borderRadius: 8,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
            shadowBlur: 8,
            shadowOffsetY: 2,
          },
          label: { show: false },
          labelLine: { show: false },
          data: [
            {
              value: swapPercent,
              name: "used",
              itemStyle: { color: swapColor },
            },
            {
              value: swapRest,
              name: "rest",
              itemStyle: { color: swapBgColor },
              tooltip: { show: false },
            },
          ],
        },
      ],
    };
  }, [chartData, ramColor, swapColor, data, memoryTooltipUsedLabel]);

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-semibold">{t("memoryLabel")}</span>
      </div>

      {/* 图表区域 - 固定高度 106px,左文右图 */}
      <div className="h-[106px] flex items-center gap-3">
        {/* 左侧:文字信息 */}
        <div className="flex-1 space-y-3 text-xs min-w-0">
          {/* RAM 信息 */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: ramColor }}
              />
              <span
                className="font-medium"
                style={{ color: ramColor }}
              >
                RAM
              </span>
              <span
                className="text-xs font-mono font-semibold tabular-nums"
                style={{ color: ramColor }}
              >
                {data.ram.percent}%
              </span>
            </div>
            <div className="text-muted-foreground font-mono tabular-nums text-[11px] pl-3.5">
              {data.ram.value} {data.ram.unit} / {data.ram.total} {data.ram.totalUnit}
            </div>
          </div>

          {/* Swap 信息 */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: swapColor }}
              />
              <span
                className="font-medium"
                style={{ color: swapColor }}
              >
                Swap
              </span>
              <span
                className="text-xs font-mono font-semibold tabular-nums"
                style={{ color: swapColor }}
              >
                {data.swap.percent}%
              </span>
            </div>
            <div className="text-muted-foreground font-mono tabular-nums text-[11px] pl-3.5">
              {data.swap.value} {data.swap.unit} / {data.swap.total} {data.swap.totalUnit}
            </div>
          </div>
        </div>

        {/* 右侧:径向条形图 */}
        <div className="w-[100px] h-[100px] relative flex-shrink-0">
          <ChartContainer config={chartConfig} className="w-full h-full">
            {() => (
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
    </div>
  );
});

MemoryChart.displayName = 'MemoryChart';
