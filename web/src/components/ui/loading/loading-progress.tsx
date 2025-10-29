import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export interface LoadingProgressProps {
  /**
   * 进度值 (0-100)
   */
  value: number
  /**
   * 显示的标签文本
   */
  label?: string
  /**
   * 显示百分比
   * @default false
   */
  showPercentage?: boolean
  /**
   * 显示预计剩余时间
   */
  estimatedTime?: string
  /**
   * 显示取消按钮
   * @default false
   */
  showCancel?: boolean
  /**
   * 取消按钮点击回调
   */
  onCancel?: () => void
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 进度条类名
   */
  progressClassName?: string
}

/**
 * LoadingProgress - 带进度的加载指示器
 *
 * 基于 shadcn/ui Progress 组件封装,用于显示可追踪的长时间操作进度
 *
 * @example
 * // 基础进度条
 * <LoadingProgress value={progress} label="上传中..." />
 *
 * @example
 * // 显示百分比和预计时间
 * <LoadingProgress
 *   value={progress}
 *   label="上传文件"
 *   showPercentage
 *   estimatedTime="剩余 2 分钟"
 * />
 *
 * @example
 * // 可取消的进度
 * <LoadingProgress
 *   value={progress}
 *   label="批量任务执行中"
 *   showCancel
 *   onCancel={() => cancelTask()}
 * />
 */
export function LoadingProgress({
  value,
  label,
  showPercentage = false,
  estimatedTime,
  showCancel = false,
  onCancel,
  className,
  progressClassName,
}: LoadingProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* 标签和百分比 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {showPercentage && (
          <span className="font-medium text-foreground">
            {Math.round(clampedValue)}%
          </span>
        )}
      </div>

      {/* 进度条 */}
      <Progress value={clampedValue} className={progressClassName} />

      {/* 预计时间和取消按钮 */}
      {(estimatedTime || showCancel) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{estimatedTime}</span>
          {showCancel && onCancel && (
            <button
              onClick={onCancel}
              className="hover:text-foreground transition-colors"
              type="button"
            >
              取消
            </button>
          )}
        </div>
      )}
    </div>
  )
}
