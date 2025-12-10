/**
 * Docker 管理弹窗组件
 * - 工具栏统计：来自监控 WebSocket（实时）
 * - 弹窗详情：当检测到容器数量 > 0 时自动获取一次，后续仅手动刷新
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { DockerIcon } from './components/DockerIcon'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { useMonitorStore } from '@/stores/monitor-store'
import { DockerSkeleton } from './components/DockerSkeleton'
import { ContainerList } from './components/ContainerList'
import { ImageList } from './components/ImageList'
import { DockerOverview } from './components/DockerOverview'
import { cn } from '@/lib/utils'
import type { DockerDataResponse } from './types'

interface DockerPopoverProps {
  serverId: string
  isConnected: boolean
}

export function DockerPopover({ serverId, isConnected }: DockerPopoverProps) {
  const t = useTranslations('terminal')
  const [open, setOpen] = useState(false)

  // 从监控 Store 获取 Docker 统计（实时数据，用于工具栏显示）
  const dockerStats = useMonitorStore(
    (state) => state.connections.get(serverId)?.metrics?.docker
  )

  // 弹窗详细数据状态
  const [detailData, setDetailData] = useState<DockerDataResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const hasFetchedRef = useRef(false)

  const requestDockerData = useMonitorStore((state) => state.requestDockerData)

  // 获取详细数据
  const fetchDetailData = useCallback(async () => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const data = await requestDockerData(serverId)
      setDetailData(data)
      setDetailError(data.error || null)
    } catch (err) {
      setDetailError(String(err))
    } finally {
      setDetailLoading(false)
    }
  }, [serverId, requestDockerData])

  // 监听 Docker 容器数量，当数量 > 0 且尚未获取过详情时自动获取
  useEffect(() => {
    if (
      isConnected &&
      dockerStats?.dockerInstalled &&
      dockerStats.containersTotal > 0 &&
      !hasFetchedRef.current
    ) {
      hasFetchedRef.current = true
      fetchDetailData()
    }
  }, [isConnected, dockerStats, fetchDetailData])

  // 工具栏显示：优先使用监控数据，否则显示 --/--
  const runningCount = dockerStats?.containersRunning ?? 0
  const totalCount = dockerStats?.containersTotal ?? 0
  const dockerInstalled = dockerStats?.dockerInstalled ?? false

  // 状态颜色
  const getStatusColor = () => {
    if (!isConnected || !dockerStats) return 'text-muted-foreground'
    if (!dockerInstalled) return 'text-muted-foreground'
    if (runningCount > 0) return 'text-status-connected'
    return 'text-muted-foreground'
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-md transition-colors flex items-center gap-2 px-2.5 text-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label={t('ariaDocker')}
        >
          <DockerIcon className="shrink-0" />
          <div className="flex flex-col items-start leading-none text-left min-w-[3rem]">
            <span className="text-[9px] uppercase font-semibold text-muted-foreground">
              DOCKER
            </span>
            <span className={cn('text-xs tabular-nums font-medium', getStatusColor())}>
              {isConnected && dockerStats
                ? (dockerInstalled ? `${runningCount}/${totalCount}` : 'N/A')
                : '--/--'}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[400px] p-4"
        align="center"
        sideOffset={8}
      >
        <DockerPopoverContent
          data={detailData}
          loading={detailLoading}
          error={detailError}
          refresh={fetchDetailData}
          serverId={serverId}
        />
      </PopoverContent>
    </Popover>
  )
}

// 弹窗内容组件
function DockerPopoverContent({
  data,
  loading,
  error,
  refresh,
  serverId,
}: {
  data: DockerDataResponse | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  serverId: string
}) {
  const t = useTranslations('terminal')

  // Docker 未安装
  if (data && !data.dockerInstalled) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          {t('dockerNotInstalled')}
        </p>
      </div>
    )
  }

  // 加载中
  if (loading && !data) {
    return <DockerSkeleton />
  }

  // 错误状态
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  const runningCount = data?.containers.filter(c => c.state === 'running').length ?? 0

  return (
    <div className="space-y-4">
      {/* 标题 - 居中对齐，与网络延迟弹窗一致 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <DockerIcon className="h-4 w-4" />
          {t('dockerPanelTitle')}:
          <span className={cn(
            'inline-block min-w-[3rem] text-center tabular-nums',
            runningCount > 0 ? 'text-status-connected' : 'text-muted-foreground'
          )}>
            {runningCount} {t('dockerOverviewRunning')}
          </span>
        </h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
          />
        </Button>
      </div>

      {/* 标签页内容 */}
      <Tabs defaultValue="containers" className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 p-0.5 h-8">
          <TabsTrigger
            value="containers"
            className="text-xs px-3 py-1 h-7 data-[state=active]:bg-background"
          >
            {t('dockerTabContainers')} ({data?.containers.length ?? 0})
          </TabsTrigger>
          <TabsTrigger
            value="images"
            className="text-xs px-3 py-1 h-7 data-[state=active]:bg-background"
          >
            {t('dockerTabImages')} ({data?.images.length ?? 0})
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="text-xs px-3 py-1 h-7 data-[state=active]:bg-background"
          >
            {t('dockerTabOverview')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="mt-3 max-h-[320px] overflow-y-auto scrollbar-custom">
          <ContainerList
            containers={data?.containers ?? []}
            stats={data?.stats ?? []}
            serverId={serverId}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="images" className="mt-3 max-h-[320px] overflow-y-auto scrollbar-custom">
          <ImageList images={data?.images ?? []} />
        </TabsContent>

        <TabsContent value="overview" className="mt-3 max-h-[320px] overflow-y-auto scrollbar-custom">
          <DockerOverview
            systemInfo={data?.systemInfo ?? null}
            containers={data?.containers ?? []}
            stats={data?.stats ?? []}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
