import { SkeletonCard } from "@/components/ui/loading"

/**
 * 仪表盘加载骨架屏组件
 * 在服务端数据加载时显示
 */
export function DashboardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pt-0 sm:gap-4 sm:p-4 sm:pt-0 xl:overflow-hidden">
      {/* 统计卡片骨架屏 */}
      <div className="grid shrink-0 auto-rows-min gap-3 md:grid-cols-3">
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
      </div>
      {/* 快速操作骨架屏 */}
      <SkeletonCard showHeader lines={4} className="min-h-0 flex-1" />
    </div>
  )
}
