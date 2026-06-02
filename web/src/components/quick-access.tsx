"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"

export function QuickAccess() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const tDashboard = useTranslations("dashboard")

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
        {tDashboard("quickAccessLabel")}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {/* 全局搜索 */}
        <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tDashboard("quickAccessSearchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
