import { useVirtualizer } from '@tanstack/react-virtual'
import { RefObject, useMemo } from 'react'

interface UseFileListVirtualizerOptions {
  /**
   * 滚动容器的 ref
   */
  scrollElementRef: RefObject<HTMLElement | null>

  /**
   * 文件总数
   */
  count: number

  /**
   * 视图模式
   */
  viewMode: 'list' | 'grid'

  /**
   * 网格视图的列数（仅在 grid 模式下使用）
   */
  gridColumns?: number

  /**
   * 是否启用虚拟滚动（默认：文件数 > 100 时启用）
   */
  enabled?: boolean
}

/**
 * 文件列表虚拟滚动 Hook
 *
 * 根据视图模式自动配置虚拟滚动参数：
 * - 列表视图：按行虚拟化，每行一个文件
 * - 网格视图：按行虚拟化，每行多个文件
 */
export function useFileListVirtualizer({
  scrollElementRef,
  count,
  viewMode,
  gridColumns = 6,
  enabled = true,
}: UseFileListVirtualizerOptions) {
  // 计算虚拟化的项数
  const virtualCount = useMemo(() => {
    if (viewMode === 'grid') {
      // 网格视图：按行计算
      return Math.ceil(count / gridColumns)
    }
    // 列表视图：按文件数计算
    return count
  }, [count, viewMode, gridColumns])

  // 估算每项的高度
  const estimateSize = useMemo(() => {
    if (viewMode === 'grid') {
      // 网格视图：每行高度约 120px (图标 64px + padding + 文字)
      return () => 120
    }
    // 列表视图：每行高度约 40px
    return () => 40
  }, [viewMode])

  // TanStack Virtual 需要返回命令式 virtualizer 实例，这里按官方推荐方式使用。
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize,
    overscan: viewMode === 'grid' ? 2 : 5, // 网格视图缓冲2行，列表视图缓冲5行
    enabled,
  })

  return {
    virtualizer,
    virtualCount,
    // 辅助方法：获取虚拟行对应的实际文件索引范围
    getFileIndicesForRow: (rowIndex: number) => {
      if (viewMode === 'grid') {
        const start = rowIndex * gridColumns
        const end = Math.min(start + gridColumns, count)
        return { start, end }
      }
      return { start: rowIndex, end: rowIndex + 1 }
    },
  }
}
