/**
 * 容器操作按钮组件
 */

'use client'

import { Play, Square, RotateCcw, Pause, PlayCircle, Trash2, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ContainerState, DockerAction } from '../types'
import { useTranslations } from 'next-intl'

interface ContainerActionsProps {
  state: ContainerState
  onAction: (action: DockerAction) => void
  onViewLogs: () => void
  loading?: DockerAction | null
  size?: 'sm' | 'default'
}

export function ContainerActions({
  state,
  onAction,
  onViewLogs,
  loading,
  size = 'sm',
}: ContainerActionsProps) {
  const t = useTranslations('terminal')
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'

  const isLoading = (action: DockerAction) => loading === action

  return (
    <div className="flex items-center gap-1">
      {/* 启动/恢复 */}
      {(state === 'exited' || state === 'created' || state === 'dead') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={buttonSize}
              onClick={() => onAction('start')}
              disabled={!!loading}
            >
              {isLoading('start') ? (
                <Loader2 className={`${iconSize} animate-spin`} />
              ) : (
                <Play className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('dockerActionStart')}</TooltipContent>
        </Tooltip>
      )}

      {/* 恢复（暂停状态） */}
      {state === 'paused' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={buttonSize}
              onClick={() => onAction('unpause')}
              disabled={!!loading}
            >
              {isLoading('unpause') ? (
                <Loader2 className={`${iconSize} animate-spin`} />
              ) : (
                <PlayCircle className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('dockerActionUnpause')}</TooltipContent>
        </Tooltip>
      )}

      {/* 暂停 */}
      {state === 'running' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={buttonSize}
              onClick={() => onAction('pause')}
              disabled={!!loading}
            >
              {isLoading('pause') ? (
                <Loader2 className={`${iconSize} animate-spin`} />
              ) : (
                <Pause className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('dockerActionPause')}</TooltipContent>
        </Tooltip>
      )}

      {/* 停止 */}
      {(state === 'running' || state === 'paused' || state === 'restarting') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={buttonSize}
              onClick={() => onAction('stop')}
              disabled={!!loading}
            >
              {isLoading('stop') ? (
                <Loader2 className={`${iconSize} animate-spin`} />
              ) : (
                <Square className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('dockerActionStop')}</TooltipContent>
        </Tooltip>
      )}

      {/* 重启 */}
      {(state === 'running' || state === 'paused') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={buttonSize}
              onClick={() => onAction('restart')}
              disabled={!!loading}
            >
              {isLoading('restart') ? (
                <Loader2 className={`${iconSize} animate-spin`} />
              ) : (
                <RotateCcw className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('dockerActionRestart')}</TooltipContent>
        </Tooltip>
      )}

      {/* 日志 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={buttonSize}
            onClick={onViewLogs}
            disabled={!!loading}
          >
            <FileText className={iconSize} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('dockerActionLogs')}</TooltipContent>
      </Tooltip>

      {/* 删除 */}
      {(state === 'exited' || state === 'created' || state === 'dead') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`${buttonSize} text-destructive hover:text-destructive`}
              onClick={() => onAction('remove')}
              disabled={!!loading}
            >
              {isLoading('remove') ? (
                <Loader2 className={`${iconSize} animate-spin`} />
              ) : (
                <Trash2 className={iconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('dockerActionRemove')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
