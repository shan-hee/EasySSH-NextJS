/**
 * CPU 使用率图表组件
 * 使用自定义 SVG 折线图显示最近 20 个数据点的 CPU 使用率
 * 固定高度 142px
 */

import React, { useMemo } from 'react';
import type { CPUData } from '../types/metrics';

interface CPUChartProps {
  data: CPUData[];
  currentUsage: number;
}

/**
 * CPU 使用率图表组件
 */
export const CPUChart: React.FC<CPUChartProps> = React.memo(({ data, currentUsage }) => {
  // 计算 SVG 路径 - 使用平滑曲线
  const { pathData, linePath } = useMemo(() => {
    if (!data || data.length === 0) {
      return { pathData: '', linePath: '' };
    }

    const width = 230;
    const height = 100;
    const padding = { left: 0, right: 0, top: 10, bottom: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 计算点的坐标
    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - (d.usage / 100) * chartHeight;
      return { x, y };
    });

    // 生成平滑曲线路径 (使用三次贝塞尔曲线 - Catmull-Rom样条)
    let smoothPath = '';
    if (points.length > 0) {
      smoothPath = `M ${points[0].x} ${points[0].y}`;

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i > 0 ? i - 1 : i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;

        // 使用Catmull-Rom样条计算控制点 (张力系数0.3使曲线更平缓)
        const tension = 0.3;
        const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
        const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
        const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
        const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;

        smoothPath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
    }

    // 填充区域路径
    const fillPath = `${smoothPath} L ${chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

    return { pathData: fillPath, linePath: smoothPath };
  }, [data]);

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-medium">CPU</span>
        <span className={`text-xs font-mono tabular-nums ${
          currentUsage > 80 ? 'text-red-500' : currentUsage > 60 ? 'text-yellow-500' : 'text-muted-foreground'
        }`}>
          {currentUsage}%
        </span>
      </div>

      {/* 图表区域 - 固定高度 142px */}
      <div className="h-[142px] w-full relative">
        <svg width="230" height="120" className="absolute inset-0">
          {/* 渐变定义 */}
          <defs>
            <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {/* 网格线 */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = 10 + 70 - (tick / 100) * 70;
            return (
              <g key={tick}>
                <line
                  x1="0"
                  y1={y}
                  x2="230"
                  y2={y}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                  opacity="0.2"
                  strokeDasharray="3 3"
                />
                <text
                  x="5"
                  y={y - 2}
                  fontSize="9"
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.6"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* 填充区域 */}
          {pathData && (
            <path
              d={pathData}
              fill="url(#cpuGradient)"
              stroke="none"
              style={{
                transition: 'd 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          )}

          {/* 折线 */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="hsl(var(--chart-1))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: 'd 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          )}

          {/* 时间标签 - 显示5个时间点 */}
          {data.length >= 5 && (
            <>
              {[0, 2, 4, 6, 9].map((index) => {
                if (index >= data.length) return null;
                const x = (index / (data.length - 1)) * 230;
                return (
                  <text
                    key={index}
                    x={x}
                    y="110"
                    fontSize="8"
                    fill="hsl(var(--muted-foreground))"
                    opacity="0.6"
                    textAnchor={index === 0 ? 'start' : index === 9 ? 'end' : 'middle'}
                  >
                    {data[index]?.time.slice(3, 8)}
                  </text>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
});

CPUChart.displayName = 'CPUChart';
