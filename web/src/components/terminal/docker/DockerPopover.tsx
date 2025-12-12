/**
 * Docker 管理弹窗组件
 * - 工具栏统计：来自监控 WebSocket（实时）
 * - 弹窗详情：按需加载，使用 API 获取数据
 * - 数据缓存：关闭弹窗后保留数据，再次打开显示缓存
 */

'use client'

import { useState, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
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
import { dockerApi } from '@/lib/api/docker'
import type {
  DockerContainer,
  DockerImage,
  ContainerStats,
  DockerSystemInfo,
} from './types'

// 页签类型
type TabValue = 'containers' | 'images' | 'resources'

// 容器页签数据
interface ContainersTabData {
  containers: DockerContainer[]
  dockerInstalled: boolean
  error?: string
}

// 镜像页签数据
interface ImagesTabData {
  images: DockerImage[]
  dockerInstalled: boolean
  error?: string
}

// 资源页签数据
interface ResourcesTabData {
  stats: ContainerStats[]
  systemInfo: DockerSystemInfo | null
  dockerInstalled: boolean
  error?: string
}

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

  // 当前页签
  const [activeTab, setActiveTab] = useState<TabValue>('containers')

  // 各页签数据状态（缓存）
  const [containersData, setContainersData] = useState<ContainersTabData | null>(null)
  const [imagesData, setImagesData] = useState<ImagesTabData | null>(null)
  const [resourcesData, setResourcesData] = useState<ResourcesTabData | null>(null)

  // 各页签加载状态
  const [containersLoading, setContainersLoading] = useState(false)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [resourcesLoading, setResourcesLoading] = useState(false)

  // 各页签错误状态
  const [containersError, setContainersError] = useState<string | null>(null)
  const [imagesError, setImagesError] = useState<string | null>(null)
  const [resourcesError, setResourcesError] = useState<string | null>(null)

  // 获取容器数据
  const fetchContainersData = useCallback(async () => {
    setContainersLoading(true)
    setContainersError(null)
    try {
      const res = await dockerApi.listContainers(serverId)
      setContainersData({
        containers: res.data,
        dockerInstalled: true,
      })
    } catch (err) {
      const errMsg = String(err)
      if (errMsg.includes('not installed') || errMsg.includes('not found')) {
        setContainersData({ containers: [], dockerInstalled: false, error: errMsg })
      } else {
        setContainersError(errMsg)
      }
    } finally {
      setContainersLoading(false)
    }
  }, [serverId])

  // 获取镜像数据
  const fetchImagesData = useCallback(async () => {
    setImagesLoading(true)
    setImagesError(null)
    try {
      const res = await dockerApi.listImages(serverId)
      setImagesData({
        images: res.data,
        dockerInstalled: true,
      })
    } catch (err) {
      const errMsg = String(err)
      if (errMsg.includes('not installed') || errMsg.includes('not found')) {
        setImagesData({ images: [], dockerInstalled: false, error: errMsg })
      } else {
        setImagesError(errMsg)
      }
    } finally {
      setImagesLoading(false)
    }
  }, [serverId])

  // 获取资源数据
  const fetchResourcesData = useCallback(async () => {
    setResourcesLoading(true)
    setResourcesError(null)
    try {
      const res = await dockerApi.getResources(serverId)
      setResourcesData({
        stats: res.stats,
        systemInfo: res.systemInfo,
        dockerInstalled: res.dockerInstalled,
      })
    } catch (err) {
      const errMsg = String(err)
      if (errMsg.includes('not installed') || errMsg.includes('not found')) {
        setResourcesData({
          stats: [],
          systemInfo: null,
          dockerInstalled: false,
          error: errMsg,
        })
      } else {
        setResourcesError(errMsg)
      }
    } finally {
      setResourcesLoading(false)
    }
  }, [serverId])

  // 页签切换处理 - 按需加载（只在首次加载）
  const handleTabChange = useCallback((value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)

    // 按需加载：只有在数据不存在时才获取
    if (tab === 'containers' && !containersData && !containersLoading) {
      fetchContainersData()
    } else if (tab === 'images' && !imagesData && !imagesLoading) {
      fetchImagesData()
    } else if (tab === 'resources' && !resourcesData && !resourcesLoading) {
      fetchResourcesData()
    }
  }, [
    containersData, containersLoading, fetchContainersData,
    imagesData, imagesLoading, fetchImagesData,
    resourcesData, resourcesLoading, fetchResourcesData,
  ])

  // 弹窗打开时首次加载容器数据
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && !containersData && !containersLoading) {
      fetchContainersData()
    }
  }, [containersData, containersLoading, fetchContainersData])

  // 工具栏显示
  const runningCount = dockerStats?.containersRunning ?? 0
  const totalCount = dockerStats?.containersTotal ?? 0
  const dockerInstalled = dockerStats?.dockerInstalled ?? false

  const getStatusColor = () => {
    if (!isConnected || !dockerStats) return 'text-muted-foreground'
    if (!dockerInstalled) return 'text-muted-foreground'
    if (runningCount > 0) return 'text-status-connected'
    return 'text-muted-foreground'
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
          activeTab={activeTab}
          onTabChange={handleTabChange}
          containersData={containersData}
          imagesData={imagesData}
          resourcesData={resourcesData}
          containersLoading={containersLoading}
          imagesLoading={imagesLoading}
          resourcesLoading={resourcesLoading}
          containersError={containersError}
          imagesError={imagesError}
          resourcesError={resourcesError}
          fetchContainersData={fetchContainersData}
          fetchImagesData={fetchImagesData}
          fetchResourcesData={fetchResourcesData}
          serverId={serverId}
        />
      </PopoverContent>
    </Popover>
  )
}

// 弹窗内容组件
function DockerPopoverContent({
  activeTab,
  onTabChange,
  containersData,
  imagesData,
  resourcesData,
  containersLoading,
  imagesLoading,
  resourcesLoading,
  containersError,
  imagesError,
  resourcesError,
  fetchContainersData,
  fetchImagesData,
  fetchResourcesData,
  serverId,
}: {
  activeTab: TabValue
  onTabChange: (value: string) => void
  containersData: ContainersTabData | null
  imagesData: ImagesTabData | null
  resourcesData: ResourcesTabData | null
  containersLoading: boolean
  imagesLoading: boolean
  resourcesLoading: boolean
  containersError: string | null
  imagesError: string | null
  resourcesError: string | null
  fetchContainersData: () => Promise<void>
  fetchImagesData: () => Promise<void>
  fetchResourcesData: () => Promise<void>
  serverId: string
}) {
  const t = useTranslations('terminal')

  // 检查 Docker 是否安装
  const anyData = containersData || imagesData || resourcesData
  if (anyData && !anyData.dockerInstalled) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          {t('dockerNotInstalled')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <DockerIcon className="h-4 w-4" />
          {t('dockerPanelTitle')}
        </h4>
      </div>

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 p-0.5 h-8">
          <TabsTrigger
            value="containers"
            className="text-xs px-3 py-1 h-7 data-[state=active]:bg-background"
          >
            {t('dockerTabContainers')} ({containersData?.containers.length ?? 0})
          </TabsTrigger>
          <TabsTrigger
            value="images"
            className="text-xs px-3 py-1 h-7 data-[state=active]:bg-background"
          >
            {t('dockerTabImages')} ({imagesData?.images.length ?? 0})
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="text-xs px-3 py-1 h-7 data-[state=active]:bg-background"
          >
            {t('dockerTabResources')}
          </TabsTrigger>
        </TabsList>

        {/* 容器页签 */}
        <TabsContent value="containers" className="mt-3 max-h-[320px] overflow-y-auto scrollbar-custom">
          {containersLoading && !containersData ? (
            <DockerSkeleton />
          ) : containersError && !containersData ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{containersError}</p>
              <Button variant="outline" size="sm" onClick={fetchContainersData}>
                {t('retry')}
              </Button>
            </div>
          ) : (
            <ContainerList
              containers={containersData?.containers ?? []}
              serverId={serverId}
              onRefresh={fetchContainersData}
              isLoading={containersLoading}
            />
          )}
        </TabsContent>

        {/* 镜像页签 */}
        <TabsContent value="images" className="mt-3 max-h-[320px] overflow-y-auto scrollbar-custom">
          {imagesLoading && !imagesData ? (
            <DockerSkeleton />
          ) : imagesError && !imagesData ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{imagesError}</p>
              <Button variant="outline" size="sm" onClick={fetchImagesData}>
                {t('retry')}
              </Button>
            </div>
          ) : (
            <ImageList
              images={imagesData?.images ?? []}
              onRefresh={fetchImagesData}
              isLoading={imagesLoading}
            />
          )}
        </TabsContent>

        {/* 资源页签 */}
        <TabsContent value="resources" className="mt-3 max-h-[320px] overflow-y-auto scrollbar-custom">
          {resourcesLoading && !resourcesData ? (
            <DockerSkeleton />
          ) : resourcesError && !resourcesData ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{resourcesError}</p>
              <Button variant="outline" size="sm" onClick={fetchResourcesData}>
                {t('retry')}
              </Button>
            </div>
          ) : (
            <DockerOverview
              systemInfo={resourcesData?.systemInfo ?? null}
              stats={resourcesData?.stats ?? []}
              onRefresh={fetchResourcesData}
              isLoading={resourcesLoading}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
