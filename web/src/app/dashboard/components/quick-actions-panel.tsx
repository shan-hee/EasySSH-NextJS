"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Zap, Plus, FolderOpen, FileCode, Workflow } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface QuickAction {
  href: string
  icon: React.ElementType
  titleKey: string
  descKey: string
  tone: string
}

const ACTIONS: QuickAction[] = [
  {
    href: "/dashboard/terminal",
    icon: Zap,
    titleKey: "quickNewConnection",
    descKey: "quickNewConnectionDesc",
    tone: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  },
  {
    href: "/dashboard/servers",
    icon: Plus,
    titleKey: "quickAddServer",
    descKey: "quickAddServerDesc",
    tone: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
  },
  {
    href: "/dashboard/scripts",
    icon: FileCode,
    titleKey: "quickScripts",
    descKey: "quickScriptsDesc",
    tone: "text-violet-600 bg-violet-500/10 dark:text-violet-400",
  },
  {
    href: "/dashboard/automation",
    icon: Workflow,
    titleKey: "quickAutomation",
    descKey: "quickAutomationDesc",
    tone: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  },
  {
    href: "/dashboard/sftp",
    icon: FolderOpen,
    titleKey: "quickFileManager",
    descKey: "quickFileManagerDesc",
    tone: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-400",
  },
]

/**
 * 快捷操作面板
 * 每个入口：浅底图标 + 标题 + 描述，跳转到对应功能页。
 */
export function QuickActionsPanel() {
  const t = useTranslations("dashboard")

  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("quickActions")}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 pt-2">
        {ACTIONS.map((action, i) => {
          const Icon = action.icon
          // 第 5 项（文件管理）跨整行
          const isLast = i === ACTIONS.length - 1 && ACTIONS.length % 2 === 1
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent",
                isLast && "col-span-2"
              )}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", action.tone)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{t(action.titleKey as never)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t(action.descKey as never)}
                </span>
              </span>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
