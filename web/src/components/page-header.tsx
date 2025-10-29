"use client"

import * as React from "react"
import { memo } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Link from "next/link"
import { useBreadcrumbs } from "@/contexts/breadcrumb-context"

interface PageHeaderProps {
  title: string
  children?: React.ReactNode
}

/**
 * 面包屑项渲染器（细粒度优化）
 *
 * 使用 React.memo 确保仅在 item 变化时重新渲染
 */
const BreadcrumbItemRenderer = memo<{
  item: { title: string; href?: string }
  isLast: boolean
}>(
  ({ item, isLast }) => (
    <>
      <BreadcrumbItem>
        {item.href ? (
          <BreadcrumbLink asChild>
            <Link href={item.href}>{item.title}</Link>
          </BreadcrumbLink>
        ) : (
          <BreadcrumbPage>{item.title}</BreadcrumbPage>
        )}
      </BreadcrumbItem>
      {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
    </>
  ),
  // 自定义比较函数：仅在 title、href 或 isLast 变化时重新渲染
  (prev, next) =>
    prev.item.title === next.item.title &&
    prev.item.href === next.item.href &&
    prev.isLast === next.isLast
)

BreadcrumbItemRenderer.displayName = 'BreadcrumbItemRenderer'

/**
 * PageHeader 组件（v2 - 自动面包屑版本）
 *
 * 特性：
 * 1. 自动从配置文件生成面包屑，无需手动传入 breadcrumbs
 * 2. 使用 Context + useMemo 实现增量更新和缓存
 * 3. 细粒度渲染优化，仅更新变化的面包屑项
 * 4. 强制使用配置文件，移除 customBreadcrumbs 支持以保持一致性
 *
 * 使用方式：
 * ```tsx
 * <PageHeader title="页面标题" />
 * ```
 *
 * @param title - 页面标题（用于生成面包屑最后一级）
 * @param children - 右侧操作区内容（可选）
 */
export function PageHeader({ title, children }: PageHeaderProps) {
  // 从 Context 自动获取面包屑
  const breadcrumbs = useBreadcrumbs(title)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:duration-200 group-data-[ready=true]/sidebar-wrapper:ease-in-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 flex-1">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <BreadcrumbItemRenderer
                key={item.href || item.title}
                item={item}
                isLast={index === breadcrumbs.length - 1}
              />
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {children && (
        <div className="flex items-center gap-2 px-4">
          {children}
        </div>
      )}
    </header>
  )
}
