/**
 * 容器卡片组件
 */

'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type {
  DockerContainer,
  DockerAction,
  ContainerState,
} from '../types'
import { STATE_COLORS, STATE_TEXT_COLORS } from '../types'
import { ContainerActions } from './ContainerActions'
import { dockerApi } from '@/lib/api/docker'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface ContainerItemProps {
  container: DockerContainer
  serverId: string
  onRefresh: () => void
  onViewLogs: (containerId: string, name: string) => void
}

export function ContainerItem({
  container,
  serverId,
  onRefresh,
  onViewLogs,
}: ContainerItemProps) {
  const t = useTranslations('terminal')
  const [loading, setLoading] = useState<DockerAction | null>(null)

  // 获取显示名称（去掉前导斜杠）
  const displayName = useMemo(() => {
    const name = container.names?.[0] || container.id.slice(0, 12)
    return name.startsWith('/') ? name.slice(1) : name
  }, [container.names, container.id])

  // 格式化端口
  const formatPorts = () => {
    if (!container.ports?.length) return null
    return container.ports
      .filter((p) => p.publicPort)
      .map((p) => `${p.publicPort}:${p.privatePort}`)
      .join(', ')
  }

  // 处理操作
  const handleAction = async (action: DockerAction) => {
    setLoading(action)
    try {
      switch (action) {
        case 'start':
          await dockerApi.startContainer(serverId, container.id)
          toast.success(t('dockerToastStartSuccess'))
          break
        case 'stop':
          await dockerApi.stopContainer(serverId, container.id)
          toast.success(t('dockerToastStopSuccess'))
          break
        case 'restart':
          await dockerApi.restartContainer(serverId, container.id)
          toast.success(t('dockerToastRestartSuccess'))
          break
        case 'pause':
          await dockerApi.pauseContainer(serverId, container.id)
          toast.success(t('dockerToastPauseSuccess'))
          break
        case 'unpause':
          await dockerApi.unpauseContainer(serverId, container.id)
          toast.success(t('dockerToastUnpauseSuccess'))
          break
        case 'remove':
          await dockerApi.removeContainer(serverId, container.id)
          toast.success(t('dockerToastRemoveSuccess'))
          break
      }
      onRefresh()
    } catch (error) {
      toast.error(t('dockerToastError', { error: String(error) }))
    } finally {
      setLoading(null)
    }
  }

  const ports = formatPorts()
  const state = container.state as ContainerState

  return (
    <div
      className={cn(
        'rounded-lg border border-border',
        'p-2.5 transition-colors',
        'hover:bg-muted/50'
      )}
    >
      {/* 头部：状态 + 名称 + 状态文本 */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn('h-2 w-2 rounded-full flex-shrink-0', STATE_COLORS[state])}
        />
        <span className="font-medium text-sm truncate flex-1" title={displayName}>
          {displayName}
        </span>
        <span
          className={cn(
            'text-xs flex-shrink-0',
            STATE_TEXT_COLORS[state]
          )}
        >
          {container.status}
        </span>
      </div>

      {/* 镜像名称 */}
      <div className="text-xs text-muted-foreground mb-1.5 truncate pl-4" title={container.image}>
        {container.image}
      </div>

      {/* 端口映射 */}
      {ports && (
        <div className="text-xs text-muted-foreground mb-1.5 pl-4">
          <span className="opacity-60">Ports: </span>
          {ports}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end -mr-1 -mb-0.5">
        <ContainerActions
          state={state}
          onAction={handleAction}
          onViewLogs={() => onViewLogs(container.id, displayName)}
          loading={loading}
        />
      </div>
    </div>
  )
}
