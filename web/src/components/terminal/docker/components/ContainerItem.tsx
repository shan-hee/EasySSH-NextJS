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
import { STATE_COLORS, STATE_TEXT_COLORS, getComposeInfo, generateUpdateRestartCommand } from '../types'
import { ContainerActions } from './ContainerActions'
import { UpdateDialog, type UpdateInfo } from './UpdateDialog'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useTerminalStore } from '@/stores/terminal-store'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Download, RefreshCw } from 'lucide-react'
import { dockerApi } from '@/lib/api/docker'

interface ContainerItemProps {
  container: DockerContainer
  serverId: string
  sessionId: string
  onRefresh: () => void
  onViewLogs: (containerId: string, name: string) => void
}

export function ContainerItem({
  container,
  serverId,
  sessionId,
  onRefresh,
  onViewLogs,
}: ContainerItemProps) {
  const t = useTranslations('terminal')
  const [loading, setLoading] = useState<DockerAction | null>(null)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  const getTerminal = useTerminalStore((state) => state.getTerminal)

  // 获取显示名称（去掉前导斜杠）
  const displayName = useMemo(() => {
    const name = container.names?.[0] || container.id.slice(0, 12)
    return name.startsWith('/') ? name.slice(1) : name
  }, [container.names, container.id])

  // 获取 Compose 信息
  const composeInfo = useMemo(() => {
    return getComposeInfo(container.labels || {})
  }, [container.labels])

  // 格式化端口（仅显示第一条，其余省略；完整列表放到 title）
  const portsInfo = useMemo(() => {
    if (!container.ports?.length) return null

    const formatted = container.ports
      .filter((p) => typeof p.publicPort === 'number')
      .slice()
      .sort((a, b) => {
        const publicA = a.publicPort ?? 0
        const publicB = b.publicPort ?? 0
        if (publicA !== publicB) return publicA - publicB
        if (a.privatePort !== b.privatePort) return a.privatePort - b.privatePort
        return a.type.localeCompare(b.type)
      })
      .map((p) => {
        const suffix = p.type && p.type !== 'tcp' ? `/${p.type}` : ''
        return `${p.publicPort}:${p.privatePort}${suffix}`
      })

    const unique = Array.from(new Set(formatted))
    if (!unique.length) return null

    const title = unique.join(', ')
    const text = unique.length > 1 ? `${unique[0]} …` : unique[0]
    return { text, title }
  }, [container.ports])

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

  // 更新镜像 - 仅拉取
  const handlePullUpdate = () => {
    setUpdateInfo({
      imageName: container.image,
      containerName: displayName,
      updateCommand: `docker pull ${container.image}`,
      mode: 'pull',
    })
    setUpdateDialogOpen(true)
  }

  // 更新并重启
  const handlePullAndRestart = () => {
    const command = generateUpdateRestartCommand(container, composeInfo)
    setUpdateInfo({
      imageName: container.image,
      containerName: displayName,
      updateCommand: command,
      mode: 'pull-restart',
      composeInfo,
    })
    setUpdateDialogOpen(true)
  }

  // 确认更新 - 发送命令到终端
  const handleConfirmUpdate = (command: string) => {
    const terminalInstance = getTerminal(sessionId)

    if (terminalInstance?.wsConnection) {
      // 发送更新命令到终端
      terminalInstance.wsConnection.sendInput(command + '\r')
      toast.success(t('dockerUpdateCommandSent'))
    } else {
      toast.error(t('dockerTerminalNotConnected'))
    }
  }

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
      {portsInfo && (
        <div className="text-xs text-muted-foreground mb-1.5 pl-4" title={portsInfo.title}>
          <span className="opacity-60">Ports: </span>
          {portsInfo.text}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end items-center gap-1 -mr-1 -mb-0.5">
        {/* 更新镜像按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handlePullUpdate}
            >
              <Download className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('dockerCheckUpdate')}</TooltipContent>
        </Tooltip>
        {/* 更新并重启按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handlePullAndRestart}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('dockerUpdateRestart')}</TooltipContent>
        </Tooltip>
        <ContainerActions
          state={state}
          onAction={handleAction}
          onViewLogs={() => onViewLogs(container.id, displayName)}
          loading={loading}
        />
      </div>

      {/* 更新弹窗 */}
      <UpdateDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        updateInfo={updateInfo}
        onConfirmUpdate={handleConfirmUpdate}
      />
    </div>
  )
}
