/**
 * Docker 资源页签组件
 */

'use client'

import { Cpu, HardDrive, Server, Database, RefreshCw } from 'lucide-react'
import type { DockerSystemInfo, ContainerStats } from '../types'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'

interface DockerOverviewProps {
  systemInfo: DockerSystemInfo | null
  stats: ContainerStats[]
  onRefresh: () => void
  isLoading?: boolean
}

export function DockerOverview({
  systemInfo,
  stats,
  onRefresh,
  isLoading = false,
}: DockerOverviewProps) {
  const t = useTranslations('terminal')

  // 格式化内存
  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  // 计算总资源使用
  const resourceUsage = useMemo(() => {
    let totalCpu = 0
    let totalMemory = 0
    stats.forEach((s) => {
      totalCpu += s.cpuPercent
      totalMemory += s.memoryUsage
    })
    return { cpu: totalCpu, memory: totalMemory }
  }, [stats])

  // 获取运行中容器资源使用（直接从 stats 获取，stats 仅包含运行中容器）
  const containersWithStats = useMemo(() => {
    return stats
      .map((s) => ({
        id: s.containerId,
        name: s.name || s.containerId.slice(0, 12),
        cpu: s.cpuPercent,
        memory: s.memoryUsage,
      }))
      .sort((a, b) => b.cpu - a.cpu) // 按 CPU 使用率排序
  }, [stats])

  // 顶部 4 个指标卡片
  const statCards = [
    {
      icon: Cpu,
      label: t('dockerTotalCpu'),
      value: `${resourceUsage.cpu.toFixed(1)}%`,
      color: 'text-blue-500',
    },
    {
      icon: HardDrive,
      label: t('dockerTotalMemory'),
      value: formatMemory(resourceUsage.memory),
      color: 'text-green-500',
    },
    {
      icon: Server,
      label: t('dockerVersion'),
      value: systemInfo?.serverVersion ?? '-',
      color: 'text-purple-500',
    },
    {
      icon: Database,
      label: t('dockerStorageDriver'),
      value: systemInfo?.storageDriver ?? '-',
      color: 'text-orange-500',
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* 顶部 4 个指标卡片 */}
      <div className="grid grid-cols-4 gap-2">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="rounded-lg border border-border p-2 text-center"
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <card.icon className={cn('h-3.5 w-3.5', card.color)} />
            </div>
            <div className="text-xs font-semibold tabular-nums truncate" title={card.value}>
              {card.value}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* 容器资源占用列表 */}
      <div className="rounded-lg border border-border p-2.5">
        <div className="flex items-center mb-2">
          <h3 className="text-sm font-medium">{t('dockerResourcesTitle')}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')}
            />
          </Button>
        </div>

        {containersWithStats.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            {t('dockerNoRunningContainers')}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {containersWithStats.map((container) => (
              <div
                key={container.id}
                className="flex items-center gap-3 text-xs"
              >
                {/* 容器名称 */}
                <span
                  className="w-24 truncate font-medium"
                  title={container.name}
                >
                  {container.name}
                </span>

                {/* CPU 进度条 */}
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.min(container.cpu, 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">
                    {container.cpu.toFixed(1)}%
                  </span>
                </div>

                {/* 内存 */}
                <span className="w-16 text-right tabular-nums text-muted-foreground">
                  {formatMemory(container.memory)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
