"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})

  const isSubActive = React.useCallback(
    (url?: string) => {
      if (!url) return false
      return pathname === url || pathname.startsWith(`${url}/`)
    },
    [pathname]
  )

  const isGroupActive = React.useCallback(
    (groupItems?: { url: string }[]) => {
      if (!groupItems || groupItems.length === 0) return false
      return groupItems.some((si) => isSubActive(si.url))
    },
    [isSubActive]
  )

  const handleOpenChange = React.useCallback((key: string, next: boolean) => {
    setOpenGroups((prev) => ({ ...prev, [key]: next }))
  }, [])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>核心功能</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const groupActive = isGroupActive(item.items)
          const open = openGroups[item.title] ?? (item.isActive || groupActive)
          return (
            <Collapsible
              key={item.title}
              asChild
              open={open}
              onOpenChange={(next) => handleOpenChange(item.title, next)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={groupActive}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const active = isSubActive(subItem.url)
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={active}>
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
