import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * 统计卡片骨架屏 - 精确匹配真实卡片的高度和布局
 * 策略：使用透明文本占位，而不是固定高度的 span，确保行高完全一致
 *
 * @example
 * // 单个骨架屏
 * <SkeletonStatsCard />
 *
 * @example
 * // 4列网格
 * <div className="grid gap-4 md:grid-cols-4">
 *   <SkeletonStatsCard />
 *   <SkeletonStatsCard />
 *   <SkeletonStatsCard />
 *   <SkeletonStatsCard />
 * </div>
 */
export function SkeletonStatsCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <span className="inline-block w-20 animate-pulse rounded bg-primary/10 text-transparent">
            占位
          </span>
        </CardTitle>
        <div className="h-4 w-4 animate-pulse rounded bg-primary/10" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <span className="inline-block w-16 animate-pulse rounded bg-primary/10 text-transparent">
            0
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="inline-block w-24 animate-pulse rounded bg-primary/10 text-transparent">
            占位文字
          </span>
        </p>
      </CardContent>
    </Card>
  )
}
