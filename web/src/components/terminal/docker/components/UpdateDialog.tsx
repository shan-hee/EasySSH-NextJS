/**
 * 容器镜像更新弹窗组件
 * 支持两种更新模式：
 * 1. 仅更新镜像 (docker pull)
 * 2. 更新并重启 (Compose: docker compose pull && up -d, 非Compose: 仅pull并提示)
 */

'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ComposeInfo } from '../types'

// 更新模式
export type UpdateMode = 'pull' | 'pull-restart'

// 更新信息
export interface UpdateInfo {
  imageName: string
  containerName: string
  updateCommand: string
  mode: UpdateMode
  composeInfo?: ComposeInfo
}

interface UpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  updateInfo: UpdateInfo | null
  onConfirmUpdate: (command: string) => void
}

export function UpdateDialog({
  open,
  onOpenChange,
  updateInfo,
  onConfirmUpdate,
}: UpdateDialogProps) {
  const t = useTranslations('terminal')

  const handleConfirm = () => {
    if (updateInfo?.updateCommand) {
      onConfirmUpdate(updateInfo.updateCommand)
      onOpenChange(false)
    }
  }

  const isPullOnly = updateInfo?.mode === 'pull'
  const isCompose = updateInfo?.composeInfo?.isCompose ?? false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isPullOnly ? t('dockerUpdateTitle') : t('dockerUpdateRestartTitle')}
          </DialogTitle>
          <DialogDescription>
            {updateInfo?.containerName && (
              isPullOnly
                ? t('dockerUpdateDesc', { name: updateInfo.containerName })
                : t('dockerUpdateRestartDesc', { name: updateInfo.containerName })
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-4">
            {/* 模式提示 */}
            <div className={`flex items-center ${isPullOnly ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
              {isPullOnly ? (
                <Download className="h-5 w-5 mr-2 flex-shrink-0" />
              ) : (
                <RefreshCw className="h-5 w-5 mr-2 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">
                {isPullOnly ? t('dockerUpdateHint') : t('dockerUpdateRestartHint')}
              </span>
            </div>

            {/* Compose 检测结果 */}
            {!isPullOnly && (
              <div className={`flex items-start gap-2 p-3 rounded-md ${
                isCompose
                  ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
              }`}>
                {isCompose ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-sm">
                  {isCompose ? (
                    <>
                      <p className="font-medium text-green-700 dark:text-green-300">
                        {t('dockerComposeDetected')}
                      </p>
                      <p className="text-green-600 dark:text-green-400 mt-1">
                        {t('dockerComposeInfo', {
                          project: updateInfo?.composeInfo?.project ?? "",
                          service: updateInfo?.composeInfo?.service ?? "",
                        })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-amber-700 dark:text-amber-300">
                        {t('dockerNotComposeWarning')}
                      </p>
                      <p className="text-amber-600 dark:text-amber-400 mt-1">
                        {t('dockerNotComposeHint')}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 镜像信息 */}
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('dockerImageName')}:</span>
                <span className="font-mono text-xs">{updateInfo?.imageName}</span>
              </div>
              {!isPullOnly && isCompose && updateInfo?.composeInfo?.workDir && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('dockerComposeWorkDir')}:</span>
                  <span className="font-mono text-xs truncate max-w-[250px]" title={updateInfo.composeInfo.workDir}>
                    {updateInfo.composeInfo.workDir}
                  </span>
                </div>
              )}
            </div>

            {/* 命令预览 */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('dockerUpdateCommandPreview')}:</p>
              <div className="rounded-md border bg-muted/50 p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {updateInfo?.updateCommand}
                </pre>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('dockerUpdateCancel')}
          </Button>
          <Button onClick={handleConfirm}>
            {isPullOnly ? t('dockerUpdateConfirm') : t('dockerUpdateRestartConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
