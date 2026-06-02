"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DashboardTone = "emerald" | "blue" | "violet" | "amber" | "rose" | "cyan" | "slate"

const TONE_STYLES: Record<
  DashboardTone,
  {
    icon: string
    spark: string
    change: string
    soft: string
  }
> = {
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    spark: "text-emerald-500",
    change: "text-emerald-600 dark:text-emerald-400",
    soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  blue: {
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    spark: "text-blue-500",
    change: "text-blue-600 dark:text-blue-400",
    soft: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    spark: "text-violet-500",
    change: "text-violet-600 dark:text-violet-400",
    soft: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    spark: "text-amber-500",
    change: "text-amber-600 dark:text-amber-400",
    soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    spark: "text-rose-500",
    change: "text-rose-600 dark:text-rose-400",
    soft: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  cyan: {
    icon: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    spark: "text-cyan-500",
    change: "text-cyan-600 dark:text-cyan-400",
    soft: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  slate: {
    icon: "bg-muted text-muted-foreground",
    spark: "text-muted-foreground",
    change: "text-muted-foreground",
    soft: "bg-muted text-muted-foreground",
  },
}

const DONUT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function buildSparkPath(data: number[], width: number, height: number) {
  if (data.length === 0) return ""
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : width

  return data
    .map((value, index) => {
      const x = index * step
      const y = height - ((value - min) / range) * (height - 4) - 2
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

function buildAreaPath(linePath: string, width: number, height: number) {
  if (!linePath) return ""
  return `${linePath} L ${width} ${height} L 0 ${height} Z`
}

function formatPercent(value: number) {
  return `${Math.abs(Math.round(value))}%`
}

function toReactId(id: string) {
  return id.replace(/:/g, "")
}

export function DashboardStatusLine({
  label,
  timestamp,
}: {
  label: string
  timestamp: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
        <span>{label}</span>
      </div>
      <time className="tabular-nums">{timestamp}</time>
    </div>
  )
}

export function DashboardMetricCard({
  title,
  value,
  icon: Icon,
  tone = "blue",
  change,
  changeLabel,
  spark = [],
  loading,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  tone?: DashboardTone
  change?: number
  changeLabel?: string
  spark?: number[]
  loading?: boolean
}) {
  const toneStyle = TONE_STYLES[tone]
  const linePath = buildSparkPath(spark, 96, 30)
  const hasChange = typeof change === "number"
  const TrendIcon = (change ?? 0) >= 0 ? ArrowUp : ArrowDown

  return (
    <Card className="gap-0 p-5 transition-shadow hover:shadow-md">
      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-lg bg-primary/10" />
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-primary/10" />
              <div className="h-7 w-16 animate-pulse rounded bg-primary/10" />
            </div>
          </div>
          <div className="h-8 w-full animate-pulse rounded bg-primary/10" />
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", toneStyle.icon)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold leading-tight tabular-nums">{value}</p>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            {hasChange ? (
              <div className="flex items-center gap-1 text-xs">
                <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", toneStyle.change)}>
                  <TrendIcon className="h-3 w-3" />
                  {formatPercent(change ?? 0)}
                </span>
                {changeLabel && <span className="text-muted-foreground">{changeLabel}</span>}
              </div>
            ) : (
              <span />
            )}
            {linePath && (
              <svg viewBox="0 0 96 30" className={cn("h-8 w-24", toneStyle.spark)} aria-hidden="true">
                <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

export function DashboardTrendCard({
  title,
  label,
  data,
  tone = "emerald",
  emptyLabel = "—",
  loading,
}: {
  title: string
  label: string
  data: number[]
  tone?: DashboardTone
  emptyLabel?: string
  loading?: boolean
}) {
  const width = 520
  const height = 180
  const linePath = buildSparkPath(data, width, height)
  const areaPath = buildAreaPath(linePath, width, height)
  const toneStyle = TONE_STYLES[tone]
  const reactId = React.useId()
  const gradientId = `trend-fill-${tone}-${toReactId(reactId)}`

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-4 h-[220px]">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-primary/10" />
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-full w-full", toneStyle.spark)} aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((line) => (
              <line
                key={line}
                x1="0"
                x2={width}
                y1={(height / 4) * line}
                y2={(height / 4) * line}
                stroke="currentColor"
                strokeDasharray="4 6"
                strokeOpacity="0.16"
              />
            ))}
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </Card>
  )
}

export interface DonutItem {
  label: string
  value: number
  color?: string
  meta?: string
}

export function DashboardDonutCard({
  title,
  totalLabel,
  totalValue,
  items,
  loading,
}: {
  title: string
  totalLabel: string
  totalValue: string | number
  items: DonutItem[]
  loading?: boolean
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  let cursor = 0
  const gradient = total > 0
    ? items
        .map((item, index) => {
          const start = cursor
          const end = cursor + (item.value / total) * 100
          cursor = end
          const color = item.color || DONUT_COLORS[index % DONUT_COLORS.length]
          return `${color} ${start}% ${end}%`
        })
        .join(", ")
    : "var(--muted) 0% 100%"

  return (
    <Card className="gap-0 p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {loading ? (
        <div className="mt-4 h-[210px] animate-pulse rounded-lg bg-primary/10" />
      ) : (
        <div className="mt-4 flex items-center gap-5">
          <div
            className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-background shadow-inner">
              <span className="text-xs text-muted-foreground">{totalLabel}</span>
              <span className="text-2xl font-bold tabular-nums">{totalValue}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {items.slice(0, 5).map((item, index) => {
              const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
              const color = item.color || DONUT_COLORS[index % DONUT_COLORS.length]
              return (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="tabular-nums">{item.value}</span>
                  <span className="w-11 text-right text-muted-foreground tabular-nums">{percent}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

export function InlineStatusBadge({
  label,
  tone = "slate",
}: {
  label: string
  tone?: DashboardTone
}) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", TONE_STYLES[tone].soft)}>
      {label}
    </span>
  )
}

export function DashboardSideList({
  title,
  items,
  empty,
}: {
  title: string
  empty: string
  items: Array<{
    id: string
    icon: LucideIcon
    title: string
    description?: string
    time?: string
    tone?: DashboardTone
  }>
}) {
  return (
    <Card className="gap-0 p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{empty}</div>
        ) : (
          items.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-md px-1 py-2 transition-colors hover:bg-accent">
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE_STYLES[item.tone || "slate"].icon)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  {item.description && <div className="truncate text-xs text-muted-foreground">{item.description}</div>}
                </div>
                {item.time && <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.time}</time>}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
