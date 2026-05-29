"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { DashboardHeaderActions } from "@/components/dashboard-header-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface PageHeaderProps {
  title: string
  titleActions?: React.ReactNode
  children?: React.ReactNode
}

export function PageHeader({ title, titleActions, children }: PageHeaderProps) {
  const tNav = useTranslations("nav")

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:duration-200 group-data-[ready=true]/sidebar-wrapper:ease-in-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <SidebarTrigger
          className="-ml-1 md:hidden"
          aria-label={tNav("openSidebar")}
          title={tNav("openSidebar")}
        />
        <h1 className="truncate text-sm font-semibold text-foreground md:text-base">
          {title}
        </h1>
        {titleActions && (
          <div className="flex shrink-0 items-center gap-1">
            {titleActions}
          </div>
        )}
      </div>
      <div className="flex min-w-0 max-w-[72vw] items-center justify-end gap-2 px-4 md:max-w-none">
        {children && (
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-none">
            {children}
          </div>
        )}
        <DashboardHeaderActions />
      </div>
    </header>
  )
}
