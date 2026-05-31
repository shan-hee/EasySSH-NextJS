"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  Activity,
  Terminal,
  LogIn,
  LogOut,
  Upload,
  Download,
  Trash2,
  Plus,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Server as ServerIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { OverviewActivityItem } from "@/lib/api/dashboard"

interface RecentActivityProps {
  items: OverviewActivityItem[]
  loading?: boolean
}

// action → 图标 + 色调
const ACTION_META: Record<string, { icon: React.ElementType; tone: string }> = {
  login: { icon: LogIn, tone: "text-emerald-500 bg-emerald-500/10" },
  logout: { icon: LogOut, tone: "text-muted-foreground bg-muted" },
  ssh_connect: { icon: Terminal, tone: "text-blue-500 bg-blue-500/10" },
  ssh_disconnect: { icon: Terminal, tone: "text-muted-foreground bg-muted" },
  sftp_upload: { icon: Upload, tone: "text-violet-500 bg-violet-500/10" },
  sftp_download: { icon: Download, tone: "text-cyan-500 bg-cyan-500/10" },
  sftp_delete: { icon: Trash2, tone: "text-rose-500 bg-rose-500/10" },
  server_create: { icon: Plus, tone: "text-emerald-500 bg-emerald-500/10" },
  server_update: { icon: Pencil, tone: "text-amber-500 bg-amber-500/10" },
  server_delete: { icon: Trash2, tone: "text-rose-500 bg-rose-500/10" },
  server_test: { icon: ServerIcon, tone: "text-blue-500 bg-blue-500/10" },
  user_create: { icon: Plus, tone: "text-emerald-500 bg-emerald-500/10" },
  user_update: { icon: Pencil, tone: "text-amber-500 bg-amber-500/10" },
  user_delete: { icon: Trash2, tone: "text-rose-500 bg-rose-500/10" },
  monitoring_query: { icon: Activity, tone: "text-blue-500 bg-blue-500/10" },
}

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { icon: KeyRound, tone: "text-muted-foreground bg-muted" }
}

/**
 * 把 ISO 时间格式化为 HH:MM:SS
 */
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

/**
 * 最近活动时间线
 * 每条：图标 + 主标题（用户/动作）+ 副标题（动作类别）+ 时间
 */
export function RecentActivity({ items, loading }: RecentActivityProps) {
  const t = useTranslations("dashboard")

  const actionLabel = (action: string): string => {
    // 动作类别 → i18n 键（静态映射，避免动态探测键导致缺键报错）
    const labelMap: Record<string, string> = {
      login: t("actionLogin"),
      logout: t("actionLogout"),
      ssh_connect: t("actionConnect"),
      ssh_disconnect: t("actionDisconnect"),
      sftp_upload: t("actionUpload"),
      sftp_download: t("actionDownload"),
      sftp_delete: t("actionDelete"),
      server_create: t("actionServerCreate"),
      server_update: t("actionServerUpdate"),
      server_delete: t("actionServerDelete"),
      server_test: t("actionServerTest"),
      user_create: t("actionUserCreate"),
      user_update: t("actionUserUpdate"),
      user_delete: t("actionUserDelete"),
      monitoring_query: t("actionMonitoringQuery"),
    }
    return labelMap[action] ?? action
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("recentActivity")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-primary/10" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-primary/10" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-primary/5" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noActivity")}</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const meta = getActionMeta(item.action)
              const Icon = meta.icon
              const isFailure = item.status === "failure"
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-md px-1.5 py-2 transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      meta.tone
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{item.username || t("systemActor")}</span>{" "}
                      <span className="text-muted-foreground">{actionLabel(item.action)}</span>
                      {item.resource && (
                        <span className="text-muted-foreground"> · {item.resource}</span>
                      )}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {isFailure ? (
                        <ShieldAlert className="h-3 w-3 text-rose-500" />
                      ) : (
                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                      )}
                      {item.ip || "-"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatTime(item.created_at)}
                  </time>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
