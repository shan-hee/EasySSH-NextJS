export type FloatingPlacement = "bottom" | "top" | "right" | "left"

interface FloatingPositionOptions {
  anchor: { x: number; y: number }
  rect: DOMRect
  /**
   * 优先尝试的方向顺序
   * 默认：先下、再上、再右、最后左
   */
  preferredPlacements?: FloatingPlacement[]
  /**
   * 与视窗边缘的安全间距
   */
  margin?: number
  /**
   * 需要尽量避开的区域（例如：当前输入行）
   * 如果无法在不遮挡该区域的情况下摆放，则会尝试其他方向
   */
  avoidArea?: {
    top: number
    bottom: number
  }
}

interface FloatingPositionResult {
  left: number
  top: number
  placement: FloatingPlacement
}

/**
 * 计算浮动弹窗在视窗内的最佳位置
 * - 根据可视区域自动在下/上/左/右之间切换
 * - 尽量避免遮挡 avoidArea（例如当前行）
 * - 始终保证整个弹窗在视窗内
 * - 找不到合适位置时返回 null（调用方可选择不展示）
 */
export function computeFloatingPosition(options: FloatingPositionOptions): FloatingPositionResult | null {
  const { anchor, rect, avoidArea } = options
  const margin = options.margin ?? 8
  const placements: FloatingPlacement[] = options.preferredPlacements ?? [
    "bottom",
    "top",
    "right",
    "left",
  ]

  if (typeof window === "undefined") {
    return null
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const clamp = (value: number, min: number, max: number) => {
    if (value < min) return min
    if (value > max) return max
    return value
  }

  const fitsInViewport = (coords: FloatingPositionResult): boolean => {
    const { left, top } = coords
    const right = left + rect.width
    const bottom = top + rect.height

    return (
      left >= margin &&
      top >= margin &&
      right <= viewportWidth - margin &&
      bottom <= viewportHeight - margin
    )
  }

  const overlapsAvoidArea = (coords: FloatingPositionResult): boolean => {
    if (!avoidArea) return false
    const top = coords.top
    const bottom = top + rect.height
    return !(bottom <= avoidArea.top || top >= avoidArea.bottom)
  }

  const computeCoords = (placement: FloatingPlacement): FloatingPositionResult | null => {
    const gap = 4

    if (placement === "bottom") {
      // 默认显示在锚点下方；如果提供了 avoidArea，则按 avoidArea.bottom 作为基准，
      // 这样上下两种布局到当前行的间距完全一致
      const baseY = avoidArea ? avoidArea.bottom : anchor.y
      let left = anchor.x
      const top = baseY + gap

      left = clamp(left, margin, viewportWidth - rect.width - margin)

      const coords: FloatingPositionResult = { left, top, placement: "bottom" }
      return coords
    }

    if (placement === "top") {
      // 默认显示在 avoidArea.top 之上，保证不会遮挡当前行，并且与 bottom 布局的间距一致
      const baseY = avoidArea ? avoidArea.top : anchor.y
      let left = anchor.x
      const top = baseY - rect.height - gap

      left = clamp(left, margin, viewportWidth - rect.width - margin)

      const coords: FloatingPositionResult = { left, top, placement: "top" }
      return coords
    }

    // 左右方向：优先尝试「行下方」和「行上方」两种垂直布局，避免遮挡当前行
    const candidateTops: number[] = []
    if (avoidArea) {
      candidateTops.push(avoidArea.bottom + gap) // 行下方
      candidateTops.push(avoidArea.top - rect.height - gap) // 行上方
    } else {
      candidateTops.push(anchor.y - rect.height / 2) // 回退到以锚点为中心
    }

    for (const candidate of candidateTops) {
      let left = placement === "right" ? anchor.x + gap : anchor.x - rect.width - gap
      let top = candidate

      left = clamp(left, margin, viewportWidth - rect.width - margin)
      top = clamp(top, margin, viewportHeight - rect.height - margin)

      const coords: FloatingPositionResult = { left, top, placement }
      if (!overlapsAvoidArea(coords)) {
        return coords
      }
    }

    // 没有找到既不遮挡 avoidArea 又在视窗内的布局
    return null
  }

  for (const placement of placements) {
    const coords = computeCoords(placement)
    if (coords && fitsInViewport(coords)) {
      return coords
    }
  }

  // 所有方向都无法完全放下
  return null
}
