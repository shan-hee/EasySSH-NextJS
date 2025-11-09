import { SkeletonCard } from "@/components/ui/loading"

/**
 * 仪表盘加载骨架屏组件
 * 在服务端数据加载时显示
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* 统计卡片骨架屏 */}
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
      </div>
      {/* 快速操作骨架屏 */}
      <SkeletonCard showHeader lines={4} className="flex-1" />
    </div>
  )
}
