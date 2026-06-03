"use client"

import * as React from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Sparkline } from "./sparkline"

export interface StatCardProps {
  /** 卡片标题 */
  title: string
  /** 主数值（已格式化的字符串或数字） */
  value: string | number
  /** 图标 */
  icon: React.ElementType
  /** 图标主题色 key，对应不同的浅色底/图标色 */
  tone?: "emerald" | "blue" | "violet" | "cyan" | "amber"
  /** 环比变化百分比（正负），不传则不显示徽章 */
  changePct?: number
  /** 环比对比文案，如「较上周」「较昨日」 */
  changeLabel?: string
  /** 迷你趋势序列 */
  spark?: number[]
  /** 加载态 */
  loading?: boolean
}

// 不同色调对应的浅底 + 图标色 + sparkline 色（全部走 CSS 变量，明暗自适应）
const TONE_STYLES: Record<
  NonNullable<StatCardProps["tone"]>,
  { wrap: string; icon: string; spark: string }
> = {
  emerald: {
    wrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
    spark: "text-emerald-500",
  },
  blue: {
    wrap: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: "text-blue-600 dark:text-blue-400",
    spark: "text-blue-500",
  },
  violet: {
    wrap: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    icon: "text-violet-600 dark:text-violet-400",
    spark: "text-violet-500",
  },
  cyan: {
    wrap: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    icon: "text-cyan-600 dark:text-cyan-400",
    spark: "text-cyan-500",
  },
  amber: {
    wrap: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    spark: "text-amber-500",
  },
}

/**
 * 仪表盘统计卡片
 * 布局：左上图标块 + 标题 + 大数值 + 左下环比徽章 + 右下迷你趋势线
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  tone = "blue",
  changePct,
  changeLabel,
  spark,
  loading,
}: StatCardProps) {
  const toneStyle = TONE_STYLES[tone]

  if (loading) {
    return (
      <Card className="gap-0 p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-primary/10" />
          <div className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-primary/10" />
            <div className="h-6 w-12 animate-pulse rounded bg-primary/10" />
          </div>
        </div>
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-primary/10" />
      </Card>
    )
  }

  const hasChange = typeof changePct === "number"
  const isUp = (changePct ?? 0) >= 0
  const changeColor = isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
  const ChangeIcon = isUp ? ArrowUp : ArrowDown
  const hasFooter = hasChange || (spark && spark.length > 0)

  return (
    <Card className="gap-0 p-4 transition-shadow hover:shadow-md">
      {/* 顶部：图标 + 标题 + 数值 */}
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneStyle.wrap)}>
          <Icon className={cn("h-5 w-5", toneStyle.icon)} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
        </div>
      </div>

      {/* 底部：环比 + 迷你趋势 */}
      {hasFooter && (
        <div className="mt-2 flex items-end justify-between gap-2">
          {hasChange ? (
            <div className="flex items-center gap-1 text-xs">
              <span className={cn("flex items-center gap-0.5 font-medium tabular-nums", changeColor)}>
                <ChangeIcon className="h-3 w-3" />
                {Math.abs(changePct ?? 0).toFixed(0)}%
              </span>
              {changeLabel && <span className="text-muted-foreground">{changeLabel}</span>}
            </div>
          ) : (
            <span />
          )}
          {spark && spark.length > 0 && (
            <Sparkline data={spark} className={toneStyle.spark} width={80} height={24} />
          )}
        </div>
      )}
    </Card>
  )
}
