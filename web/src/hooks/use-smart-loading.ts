"use client"

import { useEffect, useState } from "react"

export type LoadingStrategy = "skeleton" | "spinner" | "none"

export interface UseSmartLoadingOptions {
  /**
   * 资源类型(用于缓存键)
   */
  resourceType: string
  /**
   * 延迟显示加载指示器的时间(ms)
   * @default 300
   */
  delay?: number
  /**
   * 是否检查缓存
   * @default true
   */
  checkCache?: boolean
}

/**
 * useSmartLoading - 智能加载策略 Hook
 *
 * 根据缓存状态和延迟时间自动选择最佳的加载指示器
 *
 * ## 策略规则
 * 1. 有缓存数据 → 显示骨架屏 (提升感知性能)
 * 2. 无缓存数据 → 显示转圈指示器 (避免骨架屏闪烁)
 * 3. 加载时间 < delay → 不显示加载指示器 (避免闪烁)
 *
 * @example
 * const strategy = useSmartLoading({ resourceType: "servers" })
 *
 * if (loading) {
 *   if (strategy === "skeleton") return <SkeletonTable />
 *   if (strategy === "spinner") return <LoadingScreen />
 * }
 *
 * @example
 * // 禁用缓存检查,始终显示转圈
 * const strategy = useSmartLoading({
 *   resourceType: "search-results",
 *   checkCache: false
 * })
 */
export function useSmartLoading({
  resourceType,
  delay = 300,
  checkCache = true,
}: UseSmartLoadingOptions): LoadingStrategy {
  const [strategy, setStrategy] = useState<LoadingStrategy>("none")

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    // 延迟显示加载指示器
    timeoutId = setTimeout(() => {
      if (!checkCache) {
        setStrategy("spinner")
        return
      }

      // 检查缓存
      const hasCache = checkCachedData(resourceType)
      setStrategy(hasCache ? "skeleton" : "spinner")
    }, delay)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [resourceType, delay, checkCache])

  return strategy
}

/**
 * 检查是否有缓存数据
 */
function checkCachedData(resourceType: string): boolean {
  try {
    // 检查 localStorage 缓存
    const cacheKey = `easyssh_cache_${resourceType}`
    const cached = localStorage.getItem(cacheKey)

    if (!cached) return false

    const data = JSON.parse(cached)

    // 检查缓存是否过期 (24小时)
    if (data.timestamp && Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(cacheKey)
      return false
    }

    // 检查是否有数据
    return !!data.data && Array.isArray(data.data) && data.data.length > 0
  } catch {
    return false
  }
}

/**
 * 保存缓存数据
 */
export function setCachedData(resourceType: string, data: unknown): void {
  try {
    const cacheKey = `easyssh_cache_${resourceType}`
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    )
  } catch (error) {
    console.warn(`Failed to cache data for ${resourceType}:`, error)
  }
}

/**
 * 清除缓存数据
 */
export function clearCachedData(resourceType: string): void {
  try {
    const cacheKey = `easyssh_cache_${resourceType}`
    localStorage.removeItem(cacheKey)
  } catch (error) {
    console.warn(`Failed to clear cache for ${resourceType}:`, error)
  }
}
