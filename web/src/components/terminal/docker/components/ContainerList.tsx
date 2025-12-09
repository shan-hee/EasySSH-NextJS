/**
 * 容器列表组件
 */

'use client'

import { useState, useMemo } from 'react'
import { DockerIcon } from './DockerIcon'
import type { DockerContainer, ContainerStats, ContainerFilter } from '../types'
import { ContainerItem } from './ContainerItem'
import { ContainerLogs } from './ContainerLogs'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface ContainerListProps {
  containers: DockerContainer[]
  stats: ContainerStats[]
  serverId: string
  onRefresh: () => void
}

export function ContainerList({
  containers,
  stats,
  serverId,
  onRefresh,
}: ContainerListProps) {
  const t = useTranslations('terminal')
  const [filter, setFilter] = useState<ContainerFilter>('all')
  const [logsOpen, setLogsOpen] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<{
    id: string
    name: string
  } | null>(null)

  // 创建 stats 映射表
  const statsMap = useMemo(() => {
    const map = new Map<string, ContainerStats>()
    stats.forEach((s) => {
      map.set(s.containerId, s)
      // 也用名称作为 key（有些情况下 ID 可能是短 ID）
      if (s.name) {
        map.set(s.name, s)
      }
    })
    return map
  }, [stats])

  // 根据过滤条件筛选容器
  const filteredContainers = useMemo(() => {
    if (filter === 'all') return containers
    if (filter === 'running') {
      return containers.filter((c) => c.state === 'running')
    }
    return containers.filter((c) => c.state !== 'running')
  }, [containers, filter])

  // 统计数量
  const counts = useMemo(() => {
    const running = containers.filter((c) => c.state === 'running').length
    return {
      all: containers.length,
      running,
      stopped: containers.length - running,
    }
  }, [containers])

  // 查看日志
  const handleViewLogs = (containerId: string, name: string) => {
    setSelectedContainer({ id: containerId, name })
    setLogsOpen(true)
  }

  // 获取容器的统计数据
  const getContainerStats = (container: DockerContainer) => {
    // 先尝试用完整 ID
    let stat = statsMap.get(container.id)
    if (stat) return stat

    // 尝试用短 ID（前 12 位）
    stat = statsMap.get(container.id.slice(0, 12))
    if (stat) return stat

    // 尝试用名称
    const name = container.names?.[0]?.replace(/^\//, '')
    if (name) {
      stat = statsMap.get(name)
    }
    return stat
  }

  const filters: { key: ContainerFilter; label: string; count: number }[] = [
    { key: 'all', label: t('dockerFilterAll'), count: counts.all },
    { key: 'running', label: t('dockerFilterRunning'), count: counts.running },
    { key: 'stopped', label: t('dockerFilterStopped'), count: counts.stopped },
  ]

  return (
    <div className="flex flex-col">
      {/* 过滤器 */}
      <div className="flex gap-1 pb-2 mb-2 border-b border-border">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors',
              filter === f.key
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/50'
            )}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* 容器列表 */}
      <div className="flex flex-col gap-2">
        {filteredContainers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <DockerIcon className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-sm">{t('dockerNoContainers')}</span>
          </div>
        ) : (
          filteredContainers.map((container) => (
            <ContainerItem
              key={container.id}
              container={container}
              stats={getContainerStats(container)}
              serverId={serverId}
              onRefresh={onRefresh}
              onViewLogs={handleViewLogs}
            />
          ))
        )}
      </div>

      {/* 日志对话框 */}
      {selectedContainer && (
        <ContainerLogs
          open={logsOpen}
          onOpenChange={setLogsOpen}
          serverId={serverId}
          containerId={selectedContainer.id}
          containerName={selectedContainer.name}
        />
      )}
    </div>
  )
}
