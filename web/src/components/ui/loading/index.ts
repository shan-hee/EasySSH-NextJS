/**
 * Loading Components
 *
 * 统一的加载指示器组件库,基于 shadcn/ui 构建
 *
 * ## 组件分类
 *
 * ### 转圈指示器
 * - LoadingSpinner: 基础转圈指示器(4种尺寸)
 * - LoadingScreen: 全屏/区域加载指示器
 *
 * ### 进度指示器
 * - LoadingProgress: 带进度的加载指示器
 *
 * ### 骨架屏
 * - SkeletonCard: 卡片骨架屏
 * - SkeletonTable: 表格骨架屏
 * - SkeletonList: 列表骨架屏
 */

export { LoadingSpinner } from "./loading-spinner"
export type { LoadingSpinnerProps } from "./loading-spinner"

export { LoadingScreen } from "./loading-screen"
export type { LoadingScreenProps } from "./loading-screen"

export { LoadingProgress } from "./loading-progress"
export type { LoadingProgressProps } from "./loading-progress"

export { SkeletonCard } from "./skeleton-card"
export type { SkeletonCardProps } from "./skeleton-card"

export { SkeletonTable } from "./skeleton-table"
export type { SkeletonTableProps } from "./skeleton-table"

export { SkeletonList } from "./skeleton-list"
export type { SkeletonListProps } from "./skeleton-list"
