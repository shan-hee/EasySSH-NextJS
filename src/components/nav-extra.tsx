"use client"

import * as React from "react"
import { Github, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavExtra() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip="GitHub"
        >
          <a href="https://github.com/shan-hee/EasySSH-NextJS" target="_blank" rel="noopener noreferrer">
            <Github />
            <span>GitHub</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleThemeToggle}
          tooltip={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
          <span>主题切换</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}