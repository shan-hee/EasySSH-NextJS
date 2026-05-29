/**
 * Docker 面板加载骨架屏
 */

import { Skeleton } from '@/components/ui/skeleton'

export function DockerSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* 标题骨架 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border p-2">
            <Skeleton className="h-3 w-12 mb-1" />
            <Skeleton className="h-5 w-8" />
          </div>
        ))}
      </div>

      {/* 容器列表骨架 */}
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <ContainerSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function ContainerSkeleton() {
  return (
    <div className="rounded-lg border border-border p-3">
      {/* 头部 */}
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      {/* 镜像 */}
      <Skeleton className="h-3 w-32 mb-2" />
      {/* 资源 */}
      <div className="flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}
