import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export interface LoadingSpinnerProps {
  /**
   * 尺寸变体
   * - sm: 16px (用于按钮内)
   * - md: 24px (用于卡片内)
   * - lg: 32px (用于页面级)
   * - xl: 48px (用于全屏)
   */
  size?: "sm" | "md" | "lg" | "xl"
  /**
   * 显示在加载指示器下方的文本
   */
  label?: string
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 文本类名
   */
  labelClassName?: string
}

const sizeMap = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
  xl: "size-12",
}

/**
 * LoadingSpinner - 统一的转圈加载指示器
 *
 * 基于 shadcn/ui Spinner 组件封装,提供统一的尺寸和样式
 *
 * @example
 * // 按钮内使用
 * <LoadingSpinner size="sm" />
 *
 * @example
 * // 页面级加载
 * <LoadingSpinner size="lg" label="正在加载数据..." />
 *
 * @example
 * // 全屏加载
 * <div className="flex items-center justify-center min-h-screen">
 *   <LoadingSpinner size="xl" label="正在加载..." />
 * </div>
 */
export function LoadingSpinner({
  size = "md",
  label,
  className,
  labelClassName,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <Spinner className={cn(sizeMap[size], "text-muted-foreground")} />
      {label && (
        <p
          className={cn(
            "text-sm text-muted-foreground animate-pulse",
            labelClassName
          )}
        >
          {label}
        </p>
      )}
    </div>
  )
}
