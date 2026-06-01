"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { useEchartsColors } from "@/lib/echarts-theme"
import { useMonitorChartTheme } from "@/components/terminal/monitor/hooks/useMonitorChartTheme"

/** 资源分布项（每台服务器的内存容量与占用，GB） */
export interface ResourceShare {
  name: string
  used: number // 已用内存 GB
  total: number // 总内存 GB
}

type ResourceSlice = {
  name: string
  value: number
  kind?: "used" | "unused"
}

interface ResourceDistributionChartProps {
  items: ResourceShare[]
  loading?: boolean
}

const chartConfig = {
  s0: { label: "s0", color: "var(--chart-1)" },
  s1: { label: "s1", color: "var(--chart-2)" },
  s2: { label: "s2", color: "var(--chart-3)" },
  s3: { label: "s3", color: "var(--chart-4)" },
  s4: { label: "s4", color: "var(--chart-5)" },
} satisfies ChartConfig

/**
 * 资源分布环形图
 * 展示各服务器内存占用比例与剩余内存，中心显示已用 / 总内存。
 * 超过 5 台时合并尾部为「其他」。
 */
export function ResourceDistributionChart({ items, loading }: ResourceDistributionChartProps) {
  const t = useTranslations("dashboard")
  const colors = useEchartsColors(chartConfig)
  const chartTheme = useMonitorChartTheme()

  const palette = React.useMemo(
    () => [colors.s0, colors.s1, colors.s2, colors.s3, colors.s4].filter(Boolean) as string[],
    [colors]
  )
  const fallbackPalette = chartTheme.diskPalette

  // 取前 4 台 + 合并其余为「其他」
  const { legendSlices, chartSlices, totalMemory, totalUsed } = React.useMemo(() => {
    const sorted = [...items].filter((i) => i.used > 0).sort((a, b) => b.used - a.used)
    const totalUsed = sorted.reduce((acc, i) => acc + i.used, 0)
    const totalMemory = items.reduce((acc, i) => acc + i.total, 0)
    const head = sorted.slice(0, 4)
    const rest = sorted.slice(4)
    const result: ResourceSlice[] = head.map((i) => ({ name: i.name, value: Number(i.used.toFixed(1)) }))
    if (rest.length > 0) {
      const restSum = rest.reduce((acc, i) => acc + i.used, 0)
      result.push({ name: t("othersLabel"), value: Number(restSum.toFixed(1)) })
    }
    const unused = Math.max(totalMemory - totalUsed, 0)
    const chartResult = unused > 0
      ? [...result, { name: t("unusedMemory"), value: Number(unused.toFixed(1)), kind: "unused" as const }]
      : result
    return { legendSlices: result, chartSlices: chartResult, totalMemory, totalUsed }
  }, [items, t])

  const option: EChartsOption = React.useMemo(() => {
    const usePalette = palette.length > 0 ? palette : fallbackPalette
    return {
      color: usePalette,
      tooltip: {
        trigger: "item",
        confine: true,
        borderRadius: 6,
        padding: 8,
        backgroundColor: chartTheme.tooltipBackground,
        borderColor: chartTheme.tooltipBorder,
        borderWidth: 1,
        extraCssText: `background-color: ${chartTheme.tooltipBackground}; color: ${chartTheme.tooltipText}; border: 1px solid ${chartTheme.tooltipBorder}; box-shadow: 0 8px 20px ${chartTheme.shadow};`,
        textStyle: { fontSize: 12, color: chartTheme.tooltipText },
        formatter: (params: unknown) => {
          const p = params as { name?: string; value?: number; percent?: number }
          return `${p.name}: ${p.value}GB (${p.percent}%)`
        },
      },
      series: [
        {
          name: "memory",
          type: "pie",
          radius: ["62%", "85%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderColor: chartTheme.freeSegmentStrong,
            borderWidth: 1,
            borderRadius: 3,
          },
          label: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 2,
            label: { show: false },
          },
          labelLine: { show: false },
          data: chartSlices.map((slice) => ({
            ...slice,
            itemStyle: slice.kind === "unused" ? { color: chartTheme.freeSegment } : undefined,
            emphasis: slice.kind === "unused" ? { disabled: true } : undefined,
          })),
        },
      ],
    }
  }, [chartSlices, palette, fallbackPalette, chartTheme])

  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("resourceDistribution")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative h-[180px] w-full sm:h-[200px]">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-lg bg-primary/5" />
          ) : chartSlices.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("noData")}
            </div>
          ) : (
            <>
              <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
                {() => (
                  <ReactECharts
                    option={option}
                    style={{ width: "100%", height: "100%" }}
                    notMerge
                    lazyUpdate
                  />
                )}
              </ChartContainer>
              {/* 中心总量 */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] text-muted-foreground sm:text-xs">{t("totalMemory")}</span>
                <span className="text-xl font-bold tabular-nums sm:text-2xl">{totalUsed.toFixed(1)} GB</span>
                <span className="text-xs text-muted-foreground">/ {totalMemory.toFixed(1)} GB</span>
              </div>
            </>
          )}
        </div>

        {/* 图例 */}
        {!loading && legendSlices.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t pt-3">
            {legendSlices.map((s, i) => {
              const usePalette = palette.length > 0 ? palette : fallbackPalette
              const color = usePalette[i % usePalette.length]
              const pct = totalUsed > 0 ? Math.round((s.value / totalUsed) * 100) : 0
              return (
                <li key={`${s.name}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 pt-0.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="truncate text-muted-foreground">{s.name}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums leading-5 sm:text-sm">
                    {s.value}GB · {pct}%
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
