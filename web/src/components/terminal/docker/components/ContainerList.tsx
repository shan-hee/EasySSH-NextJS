/**
 * 容器列表组件
 * - 数据由父组件管理，本组件只负责展示和筛选
 */

'use client'

import { useState, useMemo } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { DockerIcon } from './DockerIcon'
import { Button } from '@/components/ui/button'
import type { DockerContainer, ContainerFilter } from '../types'
import { getComposeInfo } from '../types'
import { ContainerItem } from './ContainerItem'
import { ContainerLogs } from './ContainerLogs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useTerminalStore } from '@/stores/terminal-store'
import { toast } from 'sonner'

interface ContainerListProps {
  containers: DockerContainer[]
  serverId: string
  sessionId: string
  onRefresh: () => void
  isLoading?: boolean
}

interface ContainerGroup {
  project: string
  containers: DockerContainer[]
  workDir?: string
}

function getContainerDisplayName(container: DockerContainer): string {
  const name = container.names?.[0] || container.id.slice(0, 12)
  return name.startsWith('/') ? name.slice(1) : name
}

type GroupActionMode = 'pull' | 'pull-restart'

interface GroupActionInfo {
  mode: GroupActionMode
  project: string
  workDir: string
  command: string
}

function escapeForDoubleQuotes(value: string): string {
  return value.replace(/([\\$"`])/g, '\\$1')
}

function buildComposeProjectCommand(workDir: string, mode: GroupActionMode): string {
  const safeWorkDir = escapeForDoubleQuotes(workDir)
  const pullCommand = `cd "${safeWorkDir}" && docker compose pull`

  if (mode === 'pull') {
    return pullCommand
  }

  return `${pullCommand} && docker compose up -d`
}

function sortContainers(containers: DockerContainer[]): DockerContainer[] {
  return containers.slice().sort((a, b) => {
    const nameA = getContainerDisplayName(a).toLowerCase()
    const nameB = getContainerDisplayName(b).toLowerCase()
    const nameCmp = nameA.localeCompare(nameB)
    if (nameCmp !== 0) return nameCmp
    return a.id.localeCompare(b.id)
  })
}

export function ContainerList({
  containers,
  serverId,
  sessionId,
  onRefresh,
  isLoading = false,
}: ContainerListProps) {
  const t = useTranslations('terminal')
  const getTerminal = useTerminalStore((state) => state.getTerminal)

  const [filter, setFilter] = useState<ContainerFilter>('all')
  const [logsOpen, setLogsOpen] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<{
    id: string
    name: string
  } | null>(null)
  const [groupActionDialogOpen, setGroupActionDialogOpen] = useState(false)
  const [groupActionInfo, setGroupActionInfo] = useState<GroupActionInfo | null>(null)

  // 根据过滤条件筛选容器
  const filteredContainers = useMemo(() => {
    if (filter === 'all') return containers
    if (filter === 'running') {
      return containers.filter((c) => c.state === 'running')
    }
    return containers.filter((c) => c.state !== 'running')
  }, [containers, filter])

  // 按 Compose Project 分组
  const groupedContainers = useMemo(() => {
    const composeMap = new Map<string, ContainerGroup>()
    const unassigned: DockerContainer[] = []

    filteredContainers.forEach((container) => {
      const composeInfo = getComposeInfo(container.labels || {})
      if (composeInfo.isCompose && composeInfo.project) {
        const existingGroup = composeMap.get(composeInfo.project)
        if (existingGroup) {
          existingGroup.containers.push(container)
          if (!existingGroup.workDir && composeInfo.workDir) {
            existingGroup.workDir = composeInfo.workDir
          }
        } else {
          composeMap.set(composeInfo.project, {
            project: composeInfo.project,
            containers: [container],
            workDir: composeInfo.workDir,
          })
        }
        return
      }
      unassigned.push(container)
    })

    const composeGroups: ContainerGroup[] = Array.from(composeMap.values())
      .map((group) => ({
        ...group,
        containers: sortContainers(group.containers),
      }))
      .sort((a, b) => a.project.localeCompare(b.project))

    return {
      composeGroups,
      unassigned: sortContainers(unassigned),
    }
  }, [filteredContainers])

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

  const openGroupActionDialog = (group: ContainerGroup, mode: GroupActionMode) => {
    if (!group.workDir) {
      toast.error(t('dockerContainerGroupWorkDirMissing', { project: group.project }))
      return
    }

    setGroupActionInfo({
      mode,
      project: group.project,
      workDir: group.workDir,
      command: buildComposeProjectCommand(group.workDir, mode),
    })
    setGroupActionDialogOpen(true)
  }

  const handleConfirmGroupAction = () => {
    if (!groupActionInfo) return

    const terminalInstance = getTerminal(sessionId)
    if (!terminalInstance?.wsConnection) {
      toast.error(t('dockerTerminalNotConnected'))
      return
    }

    terminalInstance.wsConnection.sendInput(groupActionInfo.command + '\r')
    toast.success(t('dockerUpdateCommandSent'))
    setGroupActionDialogOpen(false)
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
          <div className="flex flex-col gap-3">
            {groupedContainers.composeGroups.map((group) => (
              <section key={group.project} className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-medium">
                    {t('dockerContainerGroupComposeProject', { project: group.project })}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground mr-0.5">
                      {t('dockerContainerGroupContainersCount', { count: group.containers.length })}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openGroupActionDialog(group, 'pull')}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {t('dockerContainerGroupPull')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openGroupActionDialog(group, 'pull-restart')}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {t('dockerContainerGroupPullRestart')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {group.containers.map((container) => (
                    <ContainerItem
                      key={container.id}
                      container={container}
                      serverId={serverId}
                      sessionId={sessionId}
                      onRefresh={onRefresh}
                      onViewLogs={handleViewLogs}
                    />
                  ))}
                </div>
              </section>
            ))}

            {groupedContainers.unassigned.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dockerContainerGroupUnassigned')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t('dockerContainerGroupContainersCount', { count: groupedContainers.unassigned.length })}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {groupedContainers.unassigned.map((container) => (
                    <ContainerItem
                      key={container.id}
                      container={container}
                      serverId={serverId}
                      sessionId={sessionId}
                      onRefresh={onRefresh}
                      onViewLogs={handleViewLogs}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
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

      <Dialog open={groupActionDialogOpen} onOpenChange={setGroupActionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {groupActionInfo?.mode === 'pull'
                ? t('dockerContainerGroupPullTitle')
                : t('dockerContainerGroupPullRestartTitle')}
            </DialogTitle>
            <DialogDescription>
              {groupActionInfo && (
                groupActionInfo.mode === 'pull'
                  ? t('dockerContainerGroupPullDesc', { project: groupActionInfo.project })
                  : t('dockerContainerGroupPullRestartDesc', { project: groupActionInfo.project })
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {groupActionInfo && (
              <>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t('dockerContainerGroupProjectLabel')}:</span>
                    <span className="font-mono text-xs">{groupActionInfo.project}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t('dockerComposeWorkDir')}:</span>
                    <span
                      className="font-mono text-xs truncate max-w-[280px]"
                      title={groupActionInfo.workDir}
                    >
                      {groupActionInfo.workDir}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">{t('dockerUpdateCommandPreview')}:</p>
                  <div className="rounded-md border bg-muted/50 p-3">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {groupActionInfo.command}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupActionDialogOpen(false)}>
              {t('dockerUpdateCancel')}
            </Button>
            <Button onClick={handleConfirmGroupAction}>
              {groupActionInfo?.mode === 'pull'
                ? t('dockerUpdateConfirm')
                : t('dockerUpdateRestartConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
