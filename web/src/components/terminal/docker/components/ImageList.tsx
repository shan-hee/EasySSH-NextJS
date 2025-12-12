/**
 * 镜像列表组件
 */

'use client'

import { useMemo } from 'react'
import { Package, RefreshCw } from 'lucide-react'
import type { DockerImage } from '../types'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ImageListProps {
  images: DockerImage[]
  onRefresh: () => void
  isLoading?: boolean
}

export function ImageList({ images, onRefresh, isLoading = false }: ImageListProps) {
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

  // 按仓库分组
  const groupedImages = useMemo(() => {
    const groups = new Map<string, DockerImage[]>()
    images.forEach((img) => {
      const repo = img.repository || '<none>'
      if (!groups.has(repo)) {
        groups.set(repo, [])
      }
      groups.get(repo)!.push(img)
    })
    return groups
  }, [images])

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
      <div className="flex flex-col gap-1.5">
        {images.map((image) => (
          <div
            key={image.id}
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
          </div>
        ))}
      </div>
    </div>
  )
}
