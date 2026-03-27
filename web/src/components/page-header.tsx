"use client"

import * as React from "react"
import { memo } from "react"
import { useTranslations } from "next-intl"
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
  /**
   * 为最后一级面包屑添加下拉菜单（可选）
   * 传入一个渲染函数，接收 trigger 元素作为参数
   */
  titleDropdown?: (trigger: React.ReactNode) => React.ReactNode
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
  ({ item, isLast }) => {
    const tNav = useTranslations("nav")

    const getTitle = () => {
      // 约定：以 "nav." 开头的 title 表示导航命名空间的 key
      if (item.title.startsWith("nav.")) {
        const key = item.title.slice(4) as Parameters<typeof tNav>[0]
        try {
          return tNav(key)
        } catch {
          return item.title
        }
      }
      return item.title
    }

    const title = getTitle()

    return (
      <>
        <BreadcrumbItem>
          {item.href ? (
            <BreadcrumbLink asChild>
              <Link href={item.href}>{title}</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{title}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
      </>
    )
  },
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
 * 5. 支持为最后一级面包屑添加下拉菜单
 *
 * 使用方式：
 * ```tsx
 * <PageHeader title="页面标题" />
 * // 或带下拉菜单
 * <PageHeader
 *   title="页面标题"
 *   titleDropdown={(trigger) => (
 *     <DropdownMenu>
 *       <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
 *       <DropdownMenuContent>...</DropdownMenuContent>
 *     </DropdownMenu>
 *   )}
 * />
 * ```
 *
 * @param title - 页面标题（用于生成面包屑最后一级）
 * @param children - 右侧操作区内容（可选）
 * @param titleDropdown - 为最后一级面包屑添加下拉菜单的渲染函数（可选）
 */
export function PageHeader({ title, children, titleDropdown }: PageHeaderProps) {
  // 从 Context 自动获取面包屑
  const breadcrumbs = useBreadcrumbs(title)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:duration-200 group-data-[ready=true]/sidebar-wrapper:ease-in-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 flex-1">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1

              // 如果是最后一项且提供了下拉菜单，使用特殊渲染
              if (isLast && titleDropdown) {
                return (
                  <React.Fragment key={item.href || item.title}>
                    <BreadcrumbItem>
                      {titleDropdown(
                        <BreadcrumbPage className="cursor-pointer hover:text-foreground/80 transition-colors flex items-center gap-1">
                          {item.title.startsWith("nav.") ? item.title.slice(4) : item.title}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                )
              }

              return (
                <BreadcrumbItemRenderer
                  key={item.href || item.title}
                  item={item}
                  isLast={isLast}
                />
              )
            })}
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
