import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface SkeletonTableProps {
  /**
   * 表格行数
   * @default 5
   */
  rows?: number
  /**
   * 表格列数
   * @default 4
   */
  columns?: number
  /**
   * 是否显示表头
   * @default true
   */
  showHeader?: boolean
  /**
   * 是否显示复选框列
   * @default false
   */
  showCheckbox?: boolean
  /**
   * 是否显示操作列
   * @default true
   */
  showActions?: boolean
  /**
   * 自定义类名
   */
  className?: string
}

/**
 * SkeletonTable - 表格骨架屏
 *
 * 基于 shadcn/ui Skeleton 组件,用于展示表格数据的加载状态
 *
 * @example
 * // 基础表格骨架屏 (5行4列)
 * <SkeletonTable />
 *
 * @example
 * // 自定义行列数
 * <SkeletonTable rows={10} columns={6} />
 *
 * @example
 * // 带复选框和操作列
 * <SkeletonTable rows={8} showCheckbox showActions />
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  showCheckbox = false,
  showActions = true,
  className,
}: SkeletonTableProps) {
  const totalColumns =
    columns + (showCheckbox ? 1 : 0) + (showActions ? 1 : 0)

  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* 表头 */}
      {showHeader && (
        <div className="flex items-center gap-4 pb-3 border-b">
          {showCheckbox && <Skeleton className="h-4 w-4 rounded" />}
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-4",
                i === 0 ? "w-32" : i === columns - 1 ? "flex-1" : "w-24"
              )}
            />
          ))}
          {showActions && <Skeleton className="h-4 w-16 ml-auto" />}
        </div>
      )}

      {/* 表格行 */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 py-2">
            {showCheckbox && <Skeleton className="h-4 w-4 rounded" />}
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  "h-5",
                  colIndex === 0
                    ? "w-32"
                    : colIndex === columns - 1
                      ? "flex-1"
                      : "w-24"
                )}
              />
            ))}
            {showActions && (
              <div className="flex items-center gap-2 ml-auto">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
