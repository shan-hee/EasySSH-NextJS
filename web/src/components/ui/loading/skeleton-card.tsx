import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface SkeletonCardProps {
  /**
   * 是否显示头部
   * @default true
   */
  showHeader?: boolean
  /**
   * 是否显示图标/头像
   * @default false
   */
  showIcon?: boolean
  /**
   * 内容行数
   * @default 3
   */
  lines?: number
  /**
   * 是否显示底部操作区
   * @default false
   */
  showFooter?: boolean
  /**
   * 自定义类名
   */
  className?: string
}

/**
 * SkeletonCard - 卡片骨架屏
 *
 * 基于 shadcn/ui Skeleton 组件,用于展示卡片内容的加载状态
 *
 * @example
 * // 基础卡片骨架屏
 * <SkeletonCard />
 *
 * @example
 * // 带图标和底部操作的卡片
 * <SkeletonCard showIcon showFooter lines={2} />
 *
 * @example
 * // 多个卡片网格
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 *   {Array.from({ length: 6 }).map((_, i) => (
 *     <SkeletonCard key={i} showIcon showFooter />
 *   ))}
 * </div>
 */
export function SkeletonCard({
  showHeader = true,
  showIcon = false,
  lines = 3,
  showFooter = false,
  className,
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-6 space-y-4",
        className
      )}
    >
      {/* 头部 */}
      {showHeader && (
        <div className="flex items-center gap-4">
          {showIcon && <Skeleton className="h-12 w-12 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-4",
              i === lines - 1 ? "w-2/3" : "w-full"
            )}
          />
        ))}
      </div>

      {/* 底部操作区 */}
      {showFooter && (
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      )}
    </div>
  )
}
