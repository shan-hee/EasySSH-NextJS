/**
 * 网络流量图表组件
 * 使用自定义 SVG 堆叠面积图显示上行和下行流量
 * 固定高度 142px
 */

import React, { useMemo } from 'react';
import type { NetworkData } from '../types/metrics';

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
 * 网络流量图表组件
 */
export const NetworkChart: React.FC<NetworkChartProps> = React.memo(({
  data,
  currentDownload,
  currentUpload,
}) => {
  // 计算 SVG 路径 - 使用平滑曲线
  const { downloadPath, uploadPath, maxValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { downloadPath: '', uploadPath: '', maxValue: 0 };
    }

    const width = 230;
    const height = 100;
    const padding = { left: 0, right: 0, top: 10, bottom: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 找到最大值
    const max = Math.max(...data.map(d => Math.max(d.download, d.upload)));
    const calculatedMaxValue = max > 0 ? max : 1000;

    // 生成平滑曲线的辅助函数 (使用 Catmull-Rom 样条)
    const createSmoothPath = (values: number[]) => {
      const points = values.map((val, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - (val / calculatedMaxValue) * chartHeight;
        return { x, y };
      });

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

      return `${smoothPath} L ${chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;
    };

    return {
      downloadPath: createSmoothPath(data.map(d => d.download)),
      uploadPath: createSmoothPath(data.map(d => d.upload)),
      maxValue: calculatedMaxValue
    };
  }, [data]);

  return (
    <div className="space-y-1">
      {/* 标题栏 - 高度 28px */}
      <div className="flex justify-between items-center h-7">
        <span className="text-xs font-medium">网络</span>
        <div className="text-xs font-mono tabular-nums flex items-center gap-2">
          <span className="text-green-500">↓ {formatSpeed(currentDownload)}</span>
          <span className="text-orange-500">↑ {formatSpeed(currentUpload)}</span>
        </div>
      </div>

      {/* 图表区域 - 固定高度 142px */}
      <div className="h-[142px] w-full relative">
        <svg width="230" height="120" className="absolute inset-0">
          {/* 渐变定义 */}
          <defs>
            <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {/* 网格线 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = 10 + 70 - ratio * 70;
            const value = maxValue * ratio;
            return (
              <g key={i}>
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
                  fontSize="8"
                  fill="hsl(var(--muted-foreground))"
                  opacity="0.6"
                >
                  {value >= 1024 ? `${(value / 1024).toFixed(0)}M` : `${value.toFixed(0)}K`}
                </text>
              </g>
            );
          })}

          {/* 下载面积 */}
          {downloadPath && (
            <path
              d={downloadPath}
              fill="url(#downloadGradient)"
              stroke="hsl(var(--chart-3))"
              strokeWidth="1.5"
              style={{
                transition: 'd 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          )}

          {/* 上传面积 */}
          {uploadPath && (
            <path
              d={uploadPath}
              fill="url(#uploadGradient)"
              stroke="hsl(var(--chart-5))"
              strokeWidth="1.5"
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

NetworkChart.displayName = 'NetworkChart';
