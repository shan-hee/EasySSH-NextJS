/**
 * 容器日志查看对话框
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download, Loader2 } from 'lucide-react'
import { dockerApi } from '@/lib/api/docker'
import { useTranslations } from 'next-intl'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  const scrollRef = useRef<HTMLDivElement>(null)

  // 加载日志
  const fetchLogs = async () => {
    if (!containerId) return
    setLoading(true)
    try {
      const res = await dockerApi.getContainerLogs(serverId, containerId, tailLines)
      setLogs(res.data)
      // 滚动到底部
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }, 100)
    } catch (error) {
      setLogs(`Error loading logs: ${error}`)
    } finally {
      setLoading(false)
    }
  }

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
  }, [open, containerId, tailLines])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>
              {t('dockerLogsTitle', { name: containerName })}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <select
                value={tailLines}
                onChange={(e) => setTailLines(Number(e.target.value))}
                className="h-8 px-2 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-background"
              >
                <option value={100}>100 lines</option>
                <option value={200}>200 lines</option>
                <option value={500}>500 lines</option>
                <option value={1000}>1000 lines</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadLogs}
                disabled={!logs}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div
            ref={scrollRef}
            className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs whitespace-pre-wrap overflow-auto"
            style={{ minHeight: '400px', maxHeight: '60vh' }}
          >
            {loading && !logs ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : logs ? (
              logs
            ) : (
              <span className="text-zinc-500">{t('dockerNoLogs')}</span>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
