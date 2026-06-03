"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { useEchartsColors } from "@/lib/echarts-theme"
import { useMonitorChartTheme } from "@/components/terminal/monitor/hooks/useMonitorChartTheme"

interface ConnectionTrendChartProps {
  dates: string[]
  series: Record<string, number[]>
  loading?: boolean
}

// 可切换的指标维度（与后端 series key 对应）
const METRIC_KEYS = ["total", "connections", "commands", "uploads"] as const
type MetricKey = (typeof METRIC_KEYS)[number]

const chartConfig = {
  value: { label: "trend", color: "var(--chart-2)" },
} satisfies ChartConfig

/**
 * 连接趋势图（近 7 天平滑面积折线 + 指标切换下拉）
 * 复用监控图表的主题接入方式，明暗自适应。
 */
export function ConnectionTrendChart({ dates, series, loading }: ConnectionTrendChartProps) {
  const t = useTranslations("dashboard")
  const [metric, setMetric] = React.useState<MetricKey>("total")

  const colors = useEchartsColors(chartConfig)
  const chartTheme = useMonitorChartTheme()
  const lineColor = colors.value || chartTheme.upload

  const metricLabel = (key: MetricKey) => {
    switch (key) {
      case "connections":
        return t("trendMetricConnections")
      case "commands":
        return t("trendMetricCommands")
      case "uploads":
        return t("trendMetricUploads")
      default:
        return t("trendMetricTotal")
    }
  }

  // 把后端日期 YYYY-MM-DD 转为 MM-DD 展示
  const xLabels = React.useMemo(
    () => dates.map((d) => (d.length >= 10 ? d.slice(5) : d)),
    [dates]
  )
  const values = React.useMemo(() => series[metric] ?? [], [series, metric])

  const option: EChartsOption = React.useMemo(() => {
    return {
      animationDuration: 320,
      animationEasing: "cubicOut",
      grid: { left: 36, right: 16, top: 16, bottom: 28 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", animation: false },
        borderRadius: 6,
        padding: 8,
        backgroundColor: chartTheme.tooltipBackground,
        borderColor: chartTheme.tooltipBorder,
        borderWidth: 1,
        textStyle: { fontSize: 12, color: chartTheme.tooltipText },
        valueFormatter: (v) => `${v}`,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xLabels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: chartTheme.axisLabel, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: chartTheme.axisLabel, fontSize: 11 },
        splitLine: { show: true, lineStyle: { color: chartTheme.gridLine, type: "dashed" } },
      },
      series: [
        {
          name: metricLabel(metric),
          type: "line",
          smooth: true,
          smoothMonotone: "x",
          showSymbol: false,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2.4, color: lineColor },
          itemStyle: { color: lineColor },
          areaStyle: {
            opacity: 0.18,
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: lineColor },
                { offset: 1, color: "transparent" },
              ],
            },
          },
          emphasis: {
            focus: "none",
            scale: false,
            itemStyle: { borderWidth: 2, borderColor: lineColor, color: chartTheme.pointFill },
          },
          // 高亮最后一个数据点
          markPoint:
            values.length > 0
              ? {
                  symbol: "circle",
                  symbolSize: 8,
                  itemStyle: { color: lineColor, borderColor: chartTheme.pointFill, borderWidth: 2 },
                  data: [{ name: "latest", coord: [xLabels.length - 1, values[values.length - 1]] }],
                  label: { show: false },
                }
              : undefined,
        },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xLabels, values, lineColor, chartTheme, metric])

  return (
    <Card className="h-full gap-0 py-4">
      <CardHeader className="flex shrink-0 flex-col items-start gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base leading-6">{t("connectionTrend")}</CardTitle>
        <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
          <SelectTrigger size="sm" className="w-full sm:w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {metricLabel(key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pt-2">
        <div className="h-[170px] w-full 2xl:h-[210px]">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-lg bg-primary/5" />
          ) : (
            <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
              {() => (
                <ReactECharts
                  option={option}
                  style={{ width: "100%", height: "100%" }}
                  notMerge={false}
                  lazyUpdate
                />
              )}
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
