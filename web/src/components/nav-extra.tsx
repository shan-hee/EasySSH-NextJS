"use client"

import * as React from "react"
import { Github, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export const NavExtra = React.memo(function NavExtra() {
  const { setTheme } = useTheme()
  const tCommon = useTranslations("common")

  const handleThemeToggle = React.useCallback(() => {
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark")
    setTheme(isDark ? "light" : "dark")
  }, [setTheme])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={tCommon("githubTooltip")}
        >
          <a href="https://github.com/shan-hee/EasySSH-NextJS" target="_blank" rel="noopener noreferrer">
            <Github />
            <span>{tCommon("githubLabel")}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleThemeToggle}
          tooltip={tCommon("themeToggleTooltip")}
        >
          {/* 基于 CSS 的无闪烁切换：在暗色下显示 Moon，亮色下显示 Sun */}
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
          <span>{tCommon("themeToggleLabel")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
})
