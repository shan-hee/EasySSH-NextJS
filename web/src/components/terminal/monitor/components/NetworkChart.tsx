"use client"

import React from 'react';
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { NetworkData } from '../types/metrics';
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { useEchartsColors } from "@/lib/echarts-theme";

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
 * 使用 ECharts 双折线图显示上行和下行流量
 * 固定高度 142px
 */
export const NetworkChart: React.FC<NetworkChartProps> = React.memo(({
  data,
  currentDownload,
  currentUpload,
}) => {
  // 转换数据格式为图表需要的格式
  const chartData = React.useMemo(
    () =>
      data.map((item) => ({
        time: item.time.slice(3, 8), // 只显示时间部分
        download: item.download,
        upload: item.upload,
      })),
    [data]
  );

  const colors = useEchartsColors(chartConfig);
  const downloadColor = colors.download || "#22c55e";
  const uploadColor = colors.upload || "#f97316";

  // 计算Y轴的最大值用于显示刻度
  // 找出实际数据的最大值
  const dataMax = chartData.length > 0
    ? Math.max(...chartData.map(d => Math.max(d.download, d.upload)))
    : 0;

  // 为 Y 轴添加一些上方留白（增加 20%），最小值为 1（避免除零）
  const maxValue = Math.max(Math.ceil(dataMax * 1.2), 1);

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

  const option: EChartsOption = React.useMemo(() => {
    const times = chartData.map((item) => item.time);
    const downloadValues = chartData.map((item) => item.download);
    const uploadValues = chartData.map((item) => item.upload);

    return {
      color: [downloadColor, uploadColor],
      animation: true,
      animationDuration: 220,
      animationEasing: "cubicOut",
      // 快速变化数据使用更快的动画
      animationDurationUpdate: 150,
      animationEasingUpdate: "cubicOut",
      grid: {
        left: 28,
        right: 8,
        top: 8,
        bottom: 16,
      },
      legend: {
        show: false,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          // 恢复为简单的直线指示，不使用十字准星
          type: "line",
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
          const list = Array.isArray(params) ? params : [params];
          const label = list[0]?.axisValue ?? "";
          const lines = list
            .map((p: any) => {
              const value = typeof p.data === "number" ? p.data : p.data?.value ?? 0;
              const name = p.seriesName === "download" ? "下载" : "上传";
              const color = p.color || (p.seriesName === "download" ? downloadColor : uploadColor);
              return `
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color};"></span>
                  <span>${name}:</span>
                  <span style="font-family:var(--font-geist-mono,ui-monospace);font-weight:600;">
                    ${formatSpeed(value)}
                  </span>
                </div>
              `;
            })
            .join("");
          return `
            <div style="font-size:11px;">
              <div style="margin-bottom:4px;">时间: ${label}</div>
              ${lines}
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
          name: "下载",
          type: "line",
          smooth: true,
          smoothMonotone: "x",
          showSymbol: false,
          symbol: "circle",
          symbolSize: 3,
          lineStyle: {
            width: 2,
            color: downloadColor,
          },
          // 悬浮时仅在当前点显示小圆点，线条保持原有颜色
          emphasis: {
            focus: "none",
            scale: false,
            lineStyle: {
              width: 2,
              color: downloadColor,
            },
            itemStyle: {
              borderWidth: 2,
              borderColor: downloadColor,
              // 填充用背景色，形成「空心圆」效果
              color: "rgba(15,23,42,1)",
            },
          },
          data: downloadValues,
        },
        {
          name: "上传",
          type: "line",
          smooth: true,
          smoothMonotone: "x",
          showSymbol: false,
          symbol: "circle",
          symbolSize: 3,
          lineStyle: {
            width: 2,
            color: uploadColor,
          },
          emphasis: {
            focus: "none",
            scale: false,
            lineStyle: {
              width: 2,
              color: uploadColor,
            },
            itemStyle: {
              borderWidth: 2,
              borderColor: uploadColor,
              color: "rgba(15,23,42,1)",
            },
          },
          data: uploadValues,
        },
      ],
    };
  }, [chartData, downloadColor, uploadColor, maxValue]);

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-semibold">网络</span>
        <div className="text-xs font-mono font-semibold tabular-nums flex items-center gap-2">
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

NetworkChart.displayName = 'NetworkChart';
