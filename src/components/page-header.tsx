"use client"
import * as React from "react"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Link from "next/link"

interface BreadcrumbItem {
  title: string
  href?: string
}

interface PageHeaderProps {
  title: string
  breadcrumbs?: BreadcrumbItem[]
  children?: React.ReactNode
  // 当未提供 breadcrumbs 时，是否将 title 显示为面包屑最后一级
  // 默认为 true（保持现有行为）；在控制台首页可设为 false 以避免出现“仪表盘”额外层级
  showTitleInBreadcrumb?: boolean
}

export function PageHeader({ title, breadcrumbs = [], children, showTitleInBreadcrumb = true }: PageHeaderProps) {
  const pathname = usePathname()
  const disableRootLink = pathname === "/dashboard"
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:duration-200 group-data-[ready=true]/sidebar-wrapper:ease-in-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 flex-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              {disableRootLink ? (
                <BreadcrumbPage>EasySSH 控制台</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href="/dashboard">EasySSH 控制台</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {breadcrumbs.length > 0 && <BreadcrumbSeparator className="hidden md:block" />}
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.title}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.title}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator className="hidden md:block" />}
              </React.Fragment>
            ))}
            {breadcrumbs.length === 0 && showTitleInBreadcrumb && (
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            )}
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
