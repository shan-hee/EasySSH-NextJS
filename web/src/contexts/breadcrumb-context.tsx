"use client"

import React, { createContext, useContext, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { generateBreadcrumbs, type BreadcrumbItem } from '@/config/breadcrumb-config'

/**
 * 面包屑上下文接口
 */
interface BreadcrumbContextValue {
  /**
   * 获取指定路径和标题的面包屑
   */
  getBreadcrumbs: (pathname: string, pageTitle: string) => BreadcrumbItem[]

  /**
   * 当前路径的面包屑（基于 usePathname）
   * 注意：此值需要页面传入 title 才能完整显示
   */
  currentPathname: string
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | undefined>(undefined)

/**
 * 面包屑 Provider 组件
 *
 * 提供全局的面包屑计算和缓存功能
 * 使用 Context 避免每个页面重复计算
 */
export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // 缓存面包屑生成函数
  const getBreadcrumbs = useCallback(
    (pathname: string, pageTitle: string) => {
      return generateBreadcrumbs(pathname, pageTitle)
    },
    []
  )

  // Context 值（仅在 pathname 变化时更新）
  const value = useMemo(
    () => ({
      getBreadcrumbs,
      currentPathname: pathname,
    }),
    [pathname, getBreadcrumbs]
  )

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

/**
 * 使用面包屑的 Hook（激进优化版）
 *
 * 特性：
 * 1. 自动读取当前路由路径
 * 2. 基于配置文件生成面包屑
 * 3. 细粒度缓存，仅在路径或标题变化时重新计算
 * 4. 返回增量更新的数据结构
 *
 * @param pageTitle - 当前页面标题
 * @returns 面包屑数组
 */
export function useBreadcrumbs(pageTitle: string): BreadcrumbItem[] {
  const context = useContext(BreadcrumbContext)

  if (!context) {
    throw new Error('useBreadcrumbs must be used within BreadcrumbProvider')
  }

  const { getBreadcrumbs, currentPathname } = context

  // 使用 useMemo 缓存计算结果
  // 依赖项：路径和标题
  const breadcrumbs = useMemo(
    () => getBreadcrumbs(currentPathname, pageTitle),
    [getBreadcrumbs, currentPathname, pageTitle]
  )

  return breadcrumbs
}

/**
 * 导出 Context 供高级用户使用
 */
export { BreadcrumbContext }
