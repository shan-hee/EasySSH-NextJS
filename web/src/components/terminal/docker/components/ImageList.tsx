/**
 * 镜像列表组件
 */

'use client'

import { useMemo } from 'react'
import { Package, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { DockerContainer, DockerImage } from '../types'
import { getComposeInfo } from '../types'

interface ImageListProps {
  images: DockerImage[]
  containers?: DockerContainer[]
  onRefresh: () => void
  isLoading?: boolean
}

interface ComposeMapping {
  project: string
  service: string
}

interface ComposeProjectMeta {
  project: string
  services: string[]
  configFiles: string[]
}

interface ImageComposeMeta {
  projects: ComposeProjectMeta[]
}

interface ComposeProjectGroup {
  project: string
  images: DockerImage[]
}

const COMPOSE_CONFIG_FILES_LABEL = 'com.docker.compose.project.config_files'
const MAX_VISIBLE_MAPPINGS = 2

function getImageRowKey(image: DockerImage) {
  return `${image.id}:${image.repository}:${image.tag}`
}

function sortImages(images: DockerImage[]): DockerImage[] {
  return images.slice().sort((a, b) => {
    const repoA = (a.repository || '').toLowerCase()
    const repoB = (b.repository || '').toLowerCase()
    const repoCmp = repoA.localeCompare(repoB)
    if (repoCmp !== 0) return repoCmp

    const tagA = (a.tag || '').toLowerCase()
    const tagB = (b.tag || '').toLowerCase()
    const tagCmp = tagA.localeCompare(tagB)
    if (tagCmp !== 0) return tagCmp

    return (a.id || '').localeCompare(b.id || '')
  })
}

function parseComposeConfigFiles(rawValue?: string): string[] {
  if (!rawValue) return []
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeImageID(imageID?: string): string {
  if (!imageID) return ''
  return imageID.trim().replace(/^sha256:/, '')
}

function isContainerUsingImage(container: DockerContainer, image: DockerImage): boolean {
  const containerImage = container.image?.trim()
  if (!containerImage) {
    return false
  }

  const repository = image.repository?.trim()
  const tag = image.tag?.trim()

  if (repository && repository !== '<none>') {
    const expectedWithTag = tag && tag !== '<none>' ? `${repository}:${tag}` : repository

    if (containerImage === expectedWithTag) {
      return true
    }

    // Docker 默认 tag 为 latest，容器配置里可能只写仓库名
    if (tag === 'latest' && containerImage === repository) {
      return true
    }

    // 容器使用 digest 引用时，形如 repo@sha256:...
    if (containerImage.startsWith(`${repository}@`)) {
      return true
    }
  }

  const containerImageID = normalizeImageID(container.imageId)
  const imageID = normalizeImageID(image.id)
  if (containerImageID && imageID) {
    return (
      containerImageID === imageID
      || containerImageID.startsWith(imageID)
      || imageID.startsWith(containerImageID)
    )
  }

  return false
}

export function ImageList({
  images,
  containers = [],
  onRefresh,
  isLoading = false,
}: ImageListProps) {
  const t = useTranslations('terminal')

  // 格式化大小
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  // 格式化时间
  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-'
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString()
  }

  // 建立镜像到 Compose 项目/服务/配置文件的映射
  const composeMappingByImage = useMemo(() => {
    const result = new Map<string, ImageComposeMeta>()

    images.forEach((image) => {
      const projectMap = new Map<string, { services: Set<string>; configFiles: Set<string> }>()

      containers.forEach((container) => {
        if (!isContainerUsingImage(container, image)) {
          return
        }

        const composeInfo = getComposeInfo(container.labels || {})
        if (!composeInfo.isCompose || !composeInfo.project || !composeInfo.service) {
          return
        }

        let projectMeta = projectMap.get(composeInfo.project)
        if (!projectMeta) {
          projectMeta = {
            services: new Set<string>(),
            configFiles: new Set<string>(),
          }
          projectMap.set(composeInfo.project, projectMeta)
        }
        projectMeta.services.add(composeInfo.service)

        const configFiles = parseComposeConfigFiles(container.labels?.[COMPOSE_CONFIG_FILES_LABEL])
        configFiles.forEach((filePath) => projectMeta.configFiles.add(filePath))
      })

      const projects = Array.from(projectMap.entries()).map(([project, meta]) => {
        return {
          project,
          services: Array.from(meta.services).sort((a, b) => a.localeCompare(b)),
          configFiles: Array.from(meta.configFiles).sort((a, b) => a.localeCompare(b)),
        }
      })
      projects.sort((a, b) => a.project.localeCompare(b.project))

      result.set(getImageRowKey(image), {
        projects,
      })
    })

    return result
  }, [images, containers])

  // Compose 项目分组
  const composeProjectGroups = useMemo(() => {
    const groupMap = new Map<string, DockerImage[]>()

    images.forEach((image) => {
      const imageMeta = composeMappingByImage.get(getImageRowKey(image))
      const projects = imageMeta?.projects ?? []

      projects.forEach((projectMeta) => {
        const groupImages = groupMap.get(projectMeta.project) ?? []
        groupImages.push(image)
        groupMap.set(projectMeta.project, groupImages)
      })
    })

    const groups: ComposeProjectGroup[] = Array.from(groupMap.entries()).map(([project, groupImages]) => ({
      project,
      images: sortImages(groupImages),
    }))
    groups.sort((a, b) => a.project.localeCompare(b.project))

    return groups
  }, [images, composeMappingByImage])

  // 未归属任何 Compose 项目的镜像
  const ungroupedImages = useMemo(() => {
    return sortImages(images.filter((image) => {
      const imageMeta = composeMappingByImage.get(getImageRowKey(image))
      return !imageMeta || imageMeta.projects.length === 0
    }))
  }, [images, composeMappingByImage])

  const renderImageCard = (image: DockerImage, project?: string) => {
    const imageRowKey = getImageRowKey(image)
    const composeMeta = composeMappingByImage.get(imageRowKey)

    let mappings: ComposeMapping[] = []
    let composeFiles: string[] = []

    if (project) {
      const projectMeta = composeMeta?.projects.find((item) => item.project === project)
      if (projectMeta) {
        mappings = projectMeta.services.map((service) => ({ project: projectMeta.project, service }))
        composeFiles = projectMeta.configFiles
      }
    } else if (composeMeta) {
      composeMeta.projects.forEach((projectMeta) => {
        projectMeta.services.forEach((service) => {
          mappings.push({ project: projectMeta.project, service })
        })
        projectMeta.configFiles.forEach((filePath) => {
          if (!composeFiles.includes(filePath)) {
            composeFiles.push(filePath)
          }
        })
      })
    }

    const visibleMappings = mappings.slice(0, MAX_VISIBLE_MAPPINGS)
    const hiddenMappings = mappings.length - visibleMappings.length
    const firstComposeFile = composeFiles[0]
    const hiddenComposeFiles = composeFiles.length - (firstComposeFile ? 1 : 0)

    return (
      <div
        key={`${project || 'plain'}:${imageRowKey}`}
        className={cn(
          'rounded-lg border border-border',
          'p-2 transition-colors',
          'hover:bg-muted/50'
        )}
      >
        {/* 仓库:标签 */}
        <div className="flex items-center gap-2 mb-1">
          <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-sm truncate">
            {image.repository || '<none>'}
          </span>
          {image.tag && image.tag !== '<none>' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {image.tag}
            </span>
          )}
        </div>

        {/* 详情 */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground pl-5">
          <span className="tabular-nums" title={image.id}>{image.id.slice(0, 12)}</span>
          <span className="tabular-nums">{formatSize(image.size)}</span>
          <span>{formatDate(image.created)}</span>
        </div>

        {/* Compose 映射 */}
        {mappings.length > 0 && (
          <div className="mt-1.5 pl-5 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
              <span className="opacity-70">{t('dockerImageComposeMapping')}:</span>
              {visibleMappings.map((mapping) => (
                <span
                  key={`${mapping.project}:${mapping.service}`}
                  className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px]"
                >
                  {mapping.project}/{mapping.service}
                </span>
              ))}
              {hiddenMappings > 0 && (
                <span className="text-[11px]">
                  {t('dockerImageComposeMore', { count: hiddenMappings })}
                </span>
              )}
            </div>

            {firstComposeFile && (
              <div
                className="text-[11px] text-muted-foreground truncate"
                title={composeFiles.join(', ')}
              >
                <span className="opacity-70">{t('dockerImageComposeFiles')}:</span>{' '}
                <span className="font-mono">{firstComposeFile}</span>
                {hiddenComposeFiles > 0 && (
                  <span className="ml-1">
                    {t('dockerImageComposeMore', { count: hiddenComposeFiles })}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <Package className="h-8 w-8 mb-2 opacity-50" />
        <span className="text-sm">{t('dockerNoImages')}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* 统计 + 刷新按钮 */}
      <div className="flex items-center pb-2 mb-2 border-b border-border">
        <span className="text-xs text-muted-foreground">
          {t('dockerImagesCount', { count: images.length })}
        </span>
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

      {/* 镜像列表 */}
      <div className="flex flex-col gap-3">
        {composeProjectGroups.map((group) => (
          <section key={group.project} className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-medium">
                {t('dockerImageGroupComposeProject', { project: group.project })}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t('dockerImageGroupImagesCount', { count: group.images.length })}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {group.images.map((image) => renderImageCard(image, group.project))}
            </div>
          </section>
        ))}

        {ungroupedImages.length > 0 && (
          <section className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t('dockerImageGroupUnassigned')}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t('dockerImageGroupImagesCount', { count: ungroupedImages.length })}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {ungroupedImages.map((image) => renderImageCard(image))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
