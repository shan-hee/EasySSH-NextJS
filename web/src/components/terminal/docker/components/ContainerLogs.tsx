/**
 * 容器日志查看对话框
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { dockerApi } from '@/lib/api/docker'
import { useTranslations } from 'next-intl'
import { FileEditor } from '@/components/sftp/file-editor'

interface ContainerLogsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  containerId: string
  containerName: string
}

export function ContainerLogs({
  open,
  onOpenChange,
  serverId,
  containerId,
  containerName,
}: ContainerLogsProps) {
  const t = useTranslations('terminal')
  const [logs, setLogs] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [tailLines, setTailLines] = useState(200)
  const [encoding, setEncoding] = useState("utf-8")

  // 加载日志
  const fetchLogs = useCallback(async () => {
    if (!containerId) return
    setLoading(true)
    try {
      const res = await dockerApi.getContainerLogs(serverId, containerId, tailLines, encoding)
      setLogs(res.data)
    } catch (error) {
      setLogs(`Error loading logs: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [containerId, encoding, serverId, tailLines])

  // 下载日志
  const downloadLogs = () => {
    const blob = new Blob([logs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${containerName}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 打开时加载
  useEffect(() => {
    if (open && containerId) {
      fetchLogs()
    }
  }, [open, containerId, fetchLogs])

  const displayContent = logs || (loading ? t('dockerLogsLoading') : t('dockerNoLogs'))
  const fileName = `${containerName}-logs.log`
  const optionClassName = "bg-popover text-popover-foreground dark:bg-zinc-900 dark:text-zinc-100"

  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[80vh] max-h-[720px] max-w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-[1100px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('dockerLogsTitle', { name: containerName })}</DialogTitle>
          <DialogDescription>{t('dockerLogsEditorDescription')}</DialogDescription>
        </DialogHeader>

        <FileEditor
          fileName={fileName}
          filePath={`/docker/containers/${containerId}/${fileName}`}
          fileContent={displayContent}
          isOpen={open}
          onClose={() => onOpenChange(false)}
          onSave={() => undefined}
          onDownload={logs ? downloadLogs : undefined}
          readOnly
          closeButtonLabel={t('dockerLogsClose')}
          scrollToBottomOnContentChange
          encoding={encoding}
          onEncodingChange={setEncoding}
          toolbarActions={
            <>
              <select
                value={tailLines}
                onChange={(event) => setTailLines(Number(event.target.value))}
                className="h-7 rounded border border-zinc-200 bg-background px-2 text-xs text-foreground dark:border-zinc-700 [&_option]:bg-popover [&_option]:text-popover-foreground dark:[&_option]:bg-zinc-900 dark:[&_option]:text-zinc-100"
                aria-label={t('dockerLogsTailLines')}
              >
                <option value={100} className={optionClassName}>100 lines</option>
                <option value={200} className={optionClassName}>200 lines</option>
                <option value={500} className={optionClassName}>500 lines</option>
                <option value={1000} className={optionClassName}>1000 lines</option>
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                onClick={fetchLogs}
                disabled={loading}
                title={t('dockerLogsRefresh')}
                aria-label={t('dockerLogsRefresh')}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
