import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface SkeletonListProps {
  /**
   * 列表项数量
   * @default 5
   */
  items?: number
  /**
   * 是否显示图标/头像
   * @default true
   */
  showIcon?: boolean
  /**
   * 图标形状
   * @default "square"
   */
  iconShape?: "square" | "circle"
  /**
   * 是否显示副标题/描述
   * @default true
   */
  showSubtitle?: boolean
  /**
   * 是否显示右侧元素(如箭头、按钮等)
   * @default false
   */
  showTrailing?: boolean
  /**
   * 自定义类名
   */
  className?: string
}

/**
 * SkeletonList - 列表骨架屏
 *
 * 基于 shadcn/ui Skeleton 组件,用于展示列表数据的加载状态
 *
 * @example
 * // 基础列表骨架屏
 * <SkeletonList items={5} />
 *
 * @example
 * // 带圆形头像和副标题
 * <SkeletonList items={8} iconShape="circle" showSubtitle />
 *
 * @example
 * // 文件列表(带图标和右侧元素)
 * <SkeletonList items={10} showIcon showTrailing />
 */
export function SkeletonList({
  items = 5,
  showIcon = true,
  iconShape = "square",
  showSubtitle = true,
  showTrailing = false,
  className,
}: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {/* 图标/头像 */}
          {showIcon && (
            <Skeleton
              className={cn(
                "h-10 w-10 flex-shrink-0",
                iconShape === "circle" ? "rounded-full" : "rounded-md"
              )}
            />
          )}

          {/* 主要内容 */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            {showSubtitle && <Skeleton className="h-3 w-1/2" />}
          </div>

          {/* 右侧元素 */}
          {showTrailing && (
            <Skeleton className="h-8 w-8 flex-shrink-0 rounded" />
          )}
        </div>
      ))}
    </div>
  )
}
