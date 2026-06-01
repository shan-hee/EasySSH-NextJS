"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import ReactECharts from "echarts-for-react"
import * as echarts from "echarts"
import type { EChartsOption } from "echarts"
import { Minus, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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

const DEFAULT_MAP_ZOOM = 1.2
const MAP_CENTER: [number, number] = [60, 20]
const MIN_MAP_ZOOM = 0.85
const MAX_MAP_ZOOM = 5
const MAP_ZOOM_STEP = 0.35

type Coordinate = [number, number]
type DotMatrixPoint = { value: Coordinate }
type GeoJsonGeometry = {
  type?: string
  coordinates?: unknown
}
type WorldGeoJson = {
  features?: Array<{
    geometry?: GeoJsonGeometry | null
  }>
}

type LandPolygon = {
  rings: Coordinate[][]
  bounds: {
    minLng: number
    maxLng: number
    minLat: number
    maxLat: number
  }
}

let worldDotMatrixData: DotMatrixPoint[] | null = null

function toCoordinate(value: unknown): Coordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const lng = Number(value[0])
  const lat = Number(value[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

function normalizeRing(value: unknown): Coordinate[] {
  if (!Array.isArray(value)) return []
  return value.map(toCoordinate).filter((coord): coord is Coordinate => coord !== null)
}

function normalizePolygon(value: unknown): Coordinate[][] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeRing).filter((ring) => ring.length >= 3)
}

function getPolygonBounds(exterior: Coordinate[]): LandPolygon["bounds"] {
  return exterior.reduce(
    (bounds, [lng, lat]) => ({
      minLng: Math.min(bounds.minLng, lng),
      maxLng: Math.max(bounds.maxLng, lng),
      minLat: Math.min(bounds.minLat, lat),
      maxLat: Math.max(bounds.maxLat, lat),
    }),
    { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
  )
}

function flattenLandPolygons(geoJson: WorldGeoJson): LandPolygon[] {
  const polygons: LandPolygon[] = []

  for (const feature of geoJson.features ?? []) {
    const geometry = feature.geometry
    if (!geometry) continue

    if (geometry.type === "Polygon") {
      const rings = normalizePolygon(geometry.coordinates)
      if (rings.length > 0) {
        polygons.push({ rings, bounds: getPolygonBounds(rings[0]) })
      }
      continue
    }

    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      for (const polygon of geometry.coordinates) {
        const rings = normalizePolygon(polygon)
        if (rings.length > 0) {
          polygons.push({ rings, bounds: getPolygonBounds(rings[0]) })
        }
      }
    }
  }

  return polygons
}

function isPointInRing([lng, lat]: Coordinate, ring: Coordinate[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lngI, latI] = ring[i]
    const [lngJ, latJ] = ring[j]
    const intersects =
      (latI > lat) !== (latJ > lat) &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI
    if (intersects) inside = !inside
  }
  return inside
}

function isPointInPolygon(point: Coordinate, polygon: LandPolygon): boolean {
  const [lng, lat] = point
  const { bounds, rings } = polygon
  if (lng < bounds.minLng || lng > bounds.maxLng || lat < bounds.minLat || lat > bounds.maxLat) {
    return false
  }
  if (!isPointInRing(point, rings[0])) {
    return false
  }
  return !rings.slice(1).some((hole) => isPointInRing(point, hole))
}

function buildWorldDotMatrixData(geoJson: WorldGeoJson): DotMatrixPoint[] {
  const polygons = flattenLandPolygons(geoJson)
  const dots: DotMatrixPoint[] = []
  const lngStep = 4
  const latStep = 3

  for (let lat = -55; lat <= 82; lat += latStep) {
    const rowOffset = Math.round((lat + 55) / latStep) % 2 === 0 ? 0 : lngStep / 2
    for (let lng = -180 + rowOffset; lng <= 180; lng += lngStep) {
      const point: Coordinate = [Number(lng.toFixed(2)), Number(lat.toFixed(2))]
      if (polygons.some((polygon) => isPointInPolygon(point, polygon))) {
        dots.push({ value: point })
      }
    }
  }

  return dots
}

/**
 * 服务器分布
 * 左：ECharts world 点阵地图 + effectScatter 按国家打点
 * 右：区域统计列表（真实聚合数据）
 */
export function ServerDistribution({ distribution, loading }: ServerDistributionProps) {
  const t = useTranslations("dashboard")
  const chartTheme = useMonitorChartTheme()
  const zoomInLabel = t("mapZoomIn")
  const zoomOutLabel = t("mapZoomOut")
  const chartRef = React.useRef<ReactECharts>(null)
  const [mapReady, setMapReady] = React.useState(worldMapRegistered)
  const [dotMatrixData, setDotMatrixData] = React.useState<DotMatrixPoint[]>(() => worldDotMatrixData ?? [])

  // 客户端加载并注册 world 地图（仅一次，避免进首屏 bundle）
  React.useEffect(() => {
    if (worldMapRegistered && worldDotMatrixData) {
      setDotMatrixData(worldDotMatrixData)
      setMapReady(true)
      return
    }
    let cancelled = false
    fetch("/maps/world.json")
      .then((res) => res.json())
      .then((geoJson) => {
        if (cancelled) return
        if (!worldMapRegistered) {
          echarts.registerMap("world", geoJson)
          worldMapRegistered = true
        }
        worldDotMatrixData = buildWorldDotMatrixData(geoJson)
        setDotMatrixData(worldDotMatrixData)
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

  const dotColor = React.useMemo(
    () => chartTheme.gridLine.replace(/[\d.]+\)$/u, "0.58)"),
    [chartTheme.gridLine]
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
        roam: true,
        roamTrigger: "global",
        silent: false,
        scaleLimit: {
          min: MIN_MAP_ZOOM,
          max: MAX_MAP_ZOOM,
        },
        itemStyle: {
          areaColor: "rgba(0, 0, 0, 0)",
          borderColor: "rgba(0, 0, 0, 0)",
          borderWidth: 0,
        },
        emphasis: {
          disabled: true,
          itemStyle: {
            areaColor: "rgba(0, 0, 0, 0)",
          },
          label: { show: false },
        },
        // 聚焦人口稠密区域，弱化两极空白
        zoom: DEFAULT_MAP_ZOOM,
        center: MAP_CENTER,
      },
      series: [
        {
          name: "world-dot-matrix",
          type: "scatter",
          coordinateSystem: "geo",
          data: dotMatrixData,
          symbol: "circle",
          symbolSize: 1.6,
          silent: true,
          tooltip: { show: false },
          animation: false,
          itemStyle: {
            color: dotColor,
            opacity: 0.78,
          },
          emphasis: {
            disabled: true,
          },
          zlevel: 0,
        },
        {
          name: "servers",
          type: "effectScatter",
          coordinateSystem: "geo",
          data: scatterData,
          symbolSize: (val: number[]) => {
            const count = val[2] ?? 1
            return 4 + (count / maxCount) * 8
          },
          showEffectOn: "render",
          rippleEffect: { brushType: "stroke", scale: 2.15 },
          itemStyle: {
            color: chartTheme.upload,
            shadowBlur: 6,
            shadowColor: chartTheme.upload,
          },
          zlevel: 1,
        },
      ],
    }
  }, [dotMatrixData, scatterData, maxCount, chartTheme, dotColor])

  const handleZoom = React.useCallback(
    (direction: "in" | "out") => {
      const instance = chartRef.current?.getEchartsInstance()
      if (!instance) return
      instance.dispatchAction({
        type: "geoRoam",
        componentType: "geo",
        geoIndex: 0,
        zoom: direction === "in" ? 1 + MAP_ZOOM_STEP : 1 / (1 + MAP_ZOOM_STEP),
        originX: instance.getWidth() / 2,
        originY: instance.getHeight() / 2,
      })
    },
    []
  )

  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("serverDistribution")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-col gap-3 xl:flex-row">
          {/* 地图 */}
          <div className="relative h-[180px] min-w-0 flex-1 overflow-hidden rounded-md sm:h-[210px] xl:h-[220px]">
            {loading || !mapReady ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-primary/5" />
            ) : (
              <>
                <ReactECharts
                  ref={chartRef}
                  option={option}
                  style={{ width: "100%", height: "100%" }}
                  notMerge
                  lazyUpdate
                />
                <div className="absolute right-1.5 top-1.5 z-10 flex overflow-hidden rounded-md border bg-background/85 shadow-sm backdrop-blur sm:right-2 sm:top-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-none sm:h-7 sm:w-7"
                        onClick={() => handleZoom("in")}
                        aria-label={zoomInLabel}
                      >
                        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{zoomInLabel}</TooltipContent>
                  </Tooltip>
                  <div className="w-px bg-border" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-none sm:h-7 sm:w-7"
                        onClick={() => handleZoom("out")}
                        aria-label={zoomOutLabel}
                      >
                        <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{zoomOutLabel}</TooltipContent>
                  </Tooltip>
                </div>
              </>
            )}
          </div>

          {/* 区域统计列表 */}
          <div className="grid w-full shrink-0 grid-cols-1 gap-1 sm:grid-cols-2 xl:block xl:w-40 xl:space-y-1 2xl:w-44">
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
