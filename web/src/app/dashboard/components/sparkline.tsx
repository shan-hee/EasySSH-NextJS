"use client"

import * as React from "react"

interface SparklineProps {
  data: number[]
  /** 线条颜色，默认 currentColor，可传 CSS 变量如 var(--chart-1) */
  color?: string
  width?: number
  height?: number
  /** 是否填充曲线下方的淡色区域 */
  fill?: boolean
  className?: string
}

/**
 * 轻量迷你趋势线（纯 SVG，无坐标轴/tooltip/交互）
 * 用于统计卡片角落展示近 N 天走势，避免为每张卡实例化 ECharts。
 */
export function Sparkline({
  data,
  color = "currentColor",
  width = 96,
  height = 32,
  fill = true,
  className,
}: SparklineProps) {
  const gradientId = React.useId()

  const { line, area } = React.useMemo(() => {
    if (!data || data.length === 0) {
      return { line: "", area: "" }
    }

    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const stepX = data.length > 1 ? width / (data.length - 1) : 0
    // 上下各留 2px 余白，避免线条贴边被裁切
    const pad = 2
    const usableH = height - pad * 2

    const points = data.map((v, i) => {
      const x = i * stepX
      const y = pad + usableH - ((v - min) / range) * usableH
      return [x, y] as const
    })

    const linePath = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ")

    const areaPath =
      `${linePath} L${(points[points.length - 1]?.[0] ?? 0).toFixed(2)},${height} ` +
      `L0,${height} Z`

    return { line: linePath, area: areaPath }
  }, [data, width, height])

  if (!line) {
    return <div style={{ width, height }} className={className} aria-hidden />
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ color }}
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} stroke="none" />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
