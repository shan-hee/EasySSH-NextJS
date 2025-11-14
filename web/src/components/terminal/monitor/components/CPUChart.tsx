"use client"

import React from 'react';
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { CPUData } from '../types/metrics';
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { useEchartsColors } from "@/lib/echarts-theme";

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
 * 使用 ECharts 折线面积图显示最近 20 个数据点的 CPU 使用率
 * 固定高度 142px
 */
export const CPUChart: React.FC<CPUChartProps> = React.memo(({ data, currentUsage }) => {
  // 转换数据格式为图表需要的格式
  const chartData = React.useMemo(
    () =>
      data.map((item) => ({
        // 显示用的时间（mm:ss），保持与网络图一致
        time: item.time.slice(3, 8),
        usage: item.usage,
      })),
    [data]
  );

  const colors = useEchartsColors(chartConfig);
  const usageColor = colors.usage || "#4b9cff";

  // 动态 Y 轴上限：根据当前数据的最大值自适应
  const dataMax = chartData.length > 0
    ? Math.max(...chartData.map((item) => item.usage))
    : 0;

  // 为 Y 轴添加适当的上方留白，并限制在 [20, 100] 区间内
  const maxValue = React.useMemo(() => {
    if (dataMax <= 0) return 100;
    const padded = dataMax * 1.2;
    const stepped = Math.ceil(padded / 5) * 5; // 向上取 5 的倍数，刻度更整齐
    return Math.min(100, Math.max(20, stepped));
  }, [dataMax]);

  // 根据动态上限生成左侧内嵌刻度
  const yAxisTicks = React.useMemo(() => {
    const top = maxValue || 100;
    return [
      0,
      Math.round(top * 0.25),
      Math.round(top * 0.5),
      Math.round(top * 0.75),
      Math.round(top),
    ];
  }, [maxValue]);

  const option: EChartsOption = React.useMemo(() => {
    const times = chartData.map((item) => item.time);
    const values = chartData.map((item) => item.usage);

    return {
      animation: true,
      // 快速变化数据使用更快的动画
      animationDuration: 200,
      animationEasing: "cubicOut",
      animationDurationUpdate: 150,
      animationEasingUpdate: "cubicOut",
      grid: {
        left: 28,
        right: 8,
        top: 8,
        bottom: 16,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          animation: false,
        },
        borderRadius: 6,
        padding: 8,
        backgroundColor: "rgba(15,23,42,0.95)",
        borderColor: "rgba(148,163,184,0.2)",
        borderWidth: 1,
        textStyle: {
          fontSize: 11,
        },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const raw = p.data;
          const value =
            typeof raw === "number"
              ? raw
              : typeof p.value === "number"
              ? p.value
              : raw?.usage ?? 0;
          const label = p.axisValue ?? "";
          return `
            <div style="font-size:11px;">
              <div style="margin-bottom:4px;">时间: ${label}</div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span
                  style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${usageColor};"
                ></span>
                <span>CPU: </span>
                <span style="font-family:var(--font-geist-mono,ui-monospace);font-weight:600;">
                  ${value}%
                </span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: times,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "rgba(148,163,184,0.9)",
          fontSize: 10,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: maxValue,
        splitNumber: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: {
          show: true,
          lineStyle: {
            color: "rgba(148,163,184,0.3)",
            opacity: 0.3,
            type: "dashed",
          },
        },
      },
      series: [
        {
          name: "CPU",
          type: "line",
          // 使用 ECharts 内置平滑曲线
          smooth: true,
          smoothMonotone: "x",
          showSymbol: false,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: {
            width: 2,
            color: usageColor,
          },
          areaStyle: {
            opacity: 0.25,
            color: usageColor,
          },
          emphasis: {
            // 悬浮时仅在当前点显示小圆点，线条和面积保持原有颜色
            focus: "none",
            scale: false,
            lineStyle: {
              width: 2,
              color: usageColor,
            },
            // 明确指定与正常状态一致的面积样式，避免 ECharts 默认高亮修改填充
            areaStyle: {
              opacity: 0.25,
              color: usageColor,
            },
            itemStyle: {
              borderWidth: 2,
              borderColor: usageColor,
              color: "rgba(15,23,42,1)", // 空心圆效果
            },
          },
          data: values,
        },
      ],
    };
  }, [chartData, usageColor, maxValue]);

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-semibold">CPU</span>
        <span className={`text-xs font-mono font-semibold tabular-nums transition-colors duration-500 ${
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
            {(_size) => (
              <ReactECharts
                option={option}
                style={{ width: "100%", height: "100%" }}
                notMerge={false}
                lazyUpdate={true}
              />
            )}
          </ChartContainer>
        )}
      </div>
    </div>
  );
});

CPUChart.displayName = 'CPUChart';
