"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import ReactECharts from "echarts-for-react"
import * as echarts from "echarts"
import type { EChartsOption } from "echarts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMonitorChartTheme } from "@/components/terminal/monitor/hooks/useMonitorChartTheme"
import { getCountryCoord } from "@/lib/country-coords"
import type { OverviewRegionCount } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"

interface ServerDistributionProps {
  distribution: OverviewRegionCount[]
  loading?: boolean
}

// 模块级标记：world 地图只需注册一次
let worldMapRegistered = false

/**
 * 服务器分布
 * 左：ECharts world 地图 + effectScatter 按国家打点
 * 右：区域统计列表（真实聚合数据）
 */
export function ServerDistribution({ distribution, loading }: ServerDistributionProps) {
  const t = useTranslations("dashboard")
  const chartTheme = useMonitorChartTheme()
  const [mapReady, setMapReady] = React.useState(worldMapRegistered)

  // 客户端加载并注册 world 地图（仅一次，避免进首屏 bundle）
  React.useEffect(() => {
    if (worldMapRegistered) {
      setMapReady(true)
      return
    }
    let cancelled = false
    fetch("/maps/world.json")
      .then((res) => res.json())
      .then((geoJson) => {
        if (cancelled) return
        echarts.registerMap("world", geoJson)
        worldMapRegistered = true
        setMapReady(true)
      })
      .catch(() => {
        // 地图加载失败时仅展示右侧列表
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 把分布数据转为地图打点
  const scatterData = React.useMemo(() => {
    return distribution
      .map((item) => {
        const coord = getCountryCoord(item.country_code)
        if (!coord) return null
        return { name: item.region, value: [...coord, item.count] }
      })
      .filter((v): v is { name: string; value: number[] } => v !== null)
  }, [distribution])

  const maxCount = React.useMemo(
    () => Math.max(1, ...distribution.map((d) => d.count)),
    [distribution]
  )

  const option: EChartsOption = React.useMemo(() => {
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        borderRadius: 6,
        padding: 8,
        backgroundColor: chartTheme.tooltipBackground,
        borderColor: chartTheme.tooltipBorder,
        borderWidth: 1,
        textStyle: { fontSize: 12, color: chartTheme.tooltipText },
        formatter: (params: unknown) => {
          const p = params as { name?: string; value?: number[]; seriesType?: string }
          if (p.seriesType === "effectScatter" && Array.isArray(p.value)) {
            return `${p.name}: ${p.value[2]}`
          }
          return p.name ?? ""
        },
      },
      geo: {
        map: "world",
        roam: false,
        silent: false,
        itemStyle: {
          areaColor: chartTheme.freeSegment,
          borderColor: chartTheme.gridLine,
          borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: { areaColor: chartTheme.freeSegmentStrong },
          label: { show: false },
        },
        // 聚焦人口稠密区域，弱化两极空白
        zoom: 1.2,
        center: [60, 20],
      },
      series: [
        {
          name: "servers",
          type: "effectScatter",
          coordinateSystem: "geo",
          data: scatterData,
          symbolSize: (val: number[]) => {
            const count = val[2] ?? 1
            return 6 + (count / maxCount) * 14
          },
          showEffectOn: "render",
          rippleEffect: { brushType: "stroke", scale: 2.6 },
          itemStyle: {
            color: chartTheme.upload,
            shadowBlur: 6,
            shadowColor: chartTheme.upload,
          },
          zlevel: 1,
        },
      ],
    }
  }, [scatterData, maxCount, chartTheme])

  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("serverDistribution")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* 地图 */}
          <div className="h-[220px] min-w-0 flex-1">
            {loading || !mapReady ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-primary/5" />
            ) : (
              <ReactECharts
                option={option}
                style={{ width: "100%", height: "100%" }}
                notMerge
                lazyUpdate
              />
            )}
          </div>

          {/* 区域统计列表 */}
          <div className="w-full shrink-0 space-y-1 sm:w-44">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 w-full animate-pulse rounded bg-primary/5" />
              ))
            ) : distribution.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noData")}</p>
            ) : (
              distribution.slice(0, 6).map((item, i) => (
                <div
                  key={`${item.country_code}-${i}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        item.count > 0 ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )}
                    />
                    <span className="truncate text-muted-foreground">{item.region || t("unknownRegion")}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
