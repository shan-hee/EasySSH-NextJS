import { cn } from "@/lib/utils"
import { LoadingSpinner, LoadingSpinnerProps } from "./loading-spinner"

export interface LoadingScreenProps extends LoadingSpinnerProps {
  /**
   * 是否使用固定定位(覆盖整个视口)
   * @default false
   */
  fixed?: boolean
  /**
   * 是否显示半透明背景
   * @default false
   */
  overlay?: boolean
}

/**
 * LoadingScreen - 全屏/区域加载指示器
 *
 * 用于页面级或容器级的加载状态展示
 *
 * @example
 * // 基础页面加载
 * <LoadingScreen label="正在加载数据..." />
 *
 * @example
 * // 固定定位的全屏加载(覆盖整个视口)
 * <LoadingScreen fixed overlay label="正在处理..." />
 *
 * @example
 * // 在容器内使用
 * <div className="relative h-96">
 *   <LoadingScreen label="加载中..." />
 * </div>
 */
export function LoadingScreen({
  fixed = false,
  overlay = false,
  size = "lg",
  label,
  className,
  ...props
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center",
        fixed ? "fixed inset-0 z-50" : "w-full",
        overlay && "bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <LoadingSpinner size={size} label={label} {...props} />
    </div>
  )
}
