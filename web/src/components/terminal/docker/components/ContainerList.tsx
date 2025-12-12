/**
 * 容器列表组件
 * - 数据由父组件管理，本组件只负责展示和筛选
 */

'use client'

import { useState, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { DockerIcon } from './DockerIcon'
import { Button } from '@/components/ui/button'
import type { DockerContainer, ContainerFilter } from '../types'
import { ContainerItem } from './ContainerItem'
import { ContainerLogs } from './ContainerLogs'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface ContainerListProps {
  containers: DockerContainer[]
  serverId: string
  onRefresh: () => void
  isLoading?: boolean
}

export function ContainerList({
  containers,
  serverId,
  onRefresh,
  isLoading = false,
}: ContainerListProps) {
  const t = useTranslations('terminal')
  const [filter, setFilter] = useState<ContainerFilter>('all')
  const [logsOpen, setLogsOpen] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<{
    id: string
    name: string
  } | null>(null)

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

  const filters: { key: ContainerFilter; label: string; count: number }[] = [
    { key: 'all', label: t('dockerFilterAll'), count: counts.all },
    { key: 'running', label: t('dockerFilterRunning'), count: counts.running },
    { key: 'stopped', label: t('dockerFilterStopped'), count: counts.stopped },
  ]

  return (
    <div className="flex flex-col">
      {/* 过滤器 + 刷新按钮 */}
      <div className="flex items-center gap-1 pb-2 mb-2 border-b border-border">
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
