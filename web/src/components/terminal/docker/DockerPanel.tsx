/**
 * Docker 管理主面板
 */

'use client'

import { RefreshCw, AlertCircle, X } from 'lucide-react'
import { DockerIcon } from './components/DockerIcon'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { useDockerData } from './hooks/useDockerData'
import { DockerSkeleton } from './components/DockerSkeleton'
import { ContainerList } from './components/ContainerList'
import { ImageList } from './components/ImageList'
import { DockerOverview } from './components/DockerOverview'
import { cn } from '@/lib/utils'

interface DockerPanelProps {
  serverId: string
  onClose?: () => void
}

export function DockerPanel({ serverId, onClose }: DockerPanelProps) {
  const t = useTranslations('terminal')
  const { data, loading, error, refresh } = useDockerData({
    serverId,
    enabled: true,
    refreshInterval: 10000,
  })

  // Docker 未安装
  if (data && !data.dockerInstalled) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader
          title={t('dockerPanelTitle')}
          onRefresh={refresh}
          loading={loading}
          onClose={onClose}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {t('dockerNotInstalled')}
          </p>
        </div>
      </div>
    )
  }

  // 加载中
  if (loading && !data) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader
          title={t('dockerPanelTitle')}
          onRefresh={refresh}
          loading={loading}
          onClose={onClose}
        />
        <DockerSkeleton />
      </div>
    )
  }

  // 错误状态
  if (error && !data) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader
          title={t('dockerPanelTitle')}
          onRefresh={refresh}
          loading={loading}
          onClose={onClose}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            {t('retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title={t('dockerPanelTitle')}
        onRefresh={refresh}
        loading={loading}
        onClose={onClose}
      />

      <Tabs defaultValue="containers" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-2 justify-start bg-transparent border-b border-zinc-200 dark:border-zinc-800 rounded-none h-auto p-0">
          <TabsTrigger
            value="containers"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
          >
            {t('dockerTabContainers')} ({data?.containers.length ?? 0})
          </TabsTrigger>
          <TabsTrigger
            value="images"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
          >
            {t('dockerTabImages')} ({data?.images.length ?? 0})
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
          >
            {t('dockerTabOverview')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="flex-1 min-h-0 mt-0">
          <ContainerList
            containers={data?.containers ?? []}
            stats={data?.stats ?? []}
            serverId={serverId}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="images" className="flex-1 min-h-0 mt-0">
          <ImageList images={data?.images ?? []} />
        </TabsContent>

        <TabsContent value="overview" className="flex-1 min-h-0 mt-0">
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

// 面板头部
function PanelHeader({
  title,
  onRefresh,
  loading,
  onClose,
}: {
  title: string
  onRefresh: () => void
  loading: boolean
  onClose?: () => void
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <DockerIcon className="h-4 w-4" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
          />
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
