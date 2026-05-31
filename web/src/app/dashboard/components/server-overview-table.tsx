"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowRight, ServerOff } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** 服务器概览行数据（由 page.tsx 从 SSE 流转换得到） */
export interface ServerOverviewRow {
  id: string
  name: string
  location?: string
  status: "online" | "warning" | "offline" | "error"
  cpu: number // 使用率 %
  memory: { used: number; total: number; usage: number }
  disk: { used: number; total: number; usage: number }
  uptime: string
  tag?: string
}

interface ServerOverviewTableProps {
  servers: ServerOverviewRow[]
  loading?: boolean
}

function usageColor(usage: number): string {
  if (usage >= 90) return "bg-rose-500"
  if (usage >= 70) return "bg-amber-500"
  return "bg-emerald-500"
}

/**
 * 服务器概览表格
 * 列：服务器 / 状态 / CPU / 内存 / 磁盘 / 运行时间 / 标签
 */
export function ServerOverviewTable({ servers, loading }: ServerOverviewTableProps) {
  const t = useTranslations("dashboard")

  const statusConfig: Record<
    ServerOverviewRow["status"],
    { label: string; className: string; dot: string }
  > = {
    online: {
      label: t("statusOnline"),
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    warning: {
      label: t("statusWarning"),
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    offline: {
      label: t("statusOffline"),
      className: "bg-muted text-muted-foreground border-border",
      dot: "bg-muted-foreground/40",
    },
    error: {
      label: t("statusError"),
      className: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
      dot: "bg-rose-500",
    },
  }

  return (
    <Card className="gap-0">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t("serverOverview")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="scrollbar-custom max-h-[340px] overflow-y-auto overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("thServer")}</TableHead>
                <TableHead className="w-20">{t("thStatus")}</TableHead>
                <TableHead className="w-32">{t("thCpu")}</TableHead>
                <TableHead className="w-40">{t("thMemory")}</TableHead>
                <TableHead className="w-40">{t("thDisk")}</TableHead>
                <TableHead className="w-24">{t("thUptime")}</TableHead>
                <TableHead className="w-20">{t("thTags")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && servers.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell colSpan={7}>
                      <div className="h-6 w-full animate-pulse rounded bg-primary/5" />
                    </TableCell>
                  </TableRow>
                ))
              ) : servers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                      <ServerOff className="mb-2 h-8 w-8 opacity-40" />
                      {t("noServers")}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                servers.map((s) => {
                  const cfg = statusConfig[s.status] ?? statusConfig.offline
                  const isOffline = s.status === "offline" || s.status === "error"
                  return (
                    <TableRow key={s.id}>
                      {/* 服务器名 + 位置 */}
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{s.name}</div>
                          {s.location && (
                            <div className="truncate text-xs text-muted-foreground">{s.location}</div>
                          )}
                        </div>
                      </TableCell>
                      {/* 状态 */}
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1 text-xs", cfg.className)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      {/* CPU */}
                      <TableCell>
                        {isOffline ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-xs tabular-nums text-muted-foreground">{s.cpu}%</span>
                            <Progress value={s.cpu} className="h-1.5" indicatorClassName={usageColor(s.cpu)} />
                          </div>
                        )}
                      </TableCell>
                      {/* 内存 */}
                      <TableCell>
                        {isOffline ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {s.memory.used}/{s.memory.total}GB · {s.memory.usage}%
                            </span>
                            <Progress
                              value={s.memory.usage}
                              className="h-1.5"
                              indicatorClassName={usageColor(s.memory.usage)}
                            />
                          </div>
                        )}
                      </TableCell>
                      {/* 磁盘 */}
                      <TableCell>
                        {isOffline ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {s.disk.used}/{s.disk.total}GB · {s.disk.usage}%
                            </span>
                            <Progress
                              value={s.disk.usage}
                              className="h-1.5"
                              indicatorClassName={usageColor(s.disk.usage)}
                            />
                          </div>
                        )}
                      </TableCell>
                      {/* 运行时间 */}
                      <TableCell>
                        <span className="text-xs tabular-nums text-muted-foreground">{s.uptime}</span>
                      </TableCell>
                      {/* 标签 */}
                      <TableCell>
                        {s.tag ? (
                          <Badge variant="secondary" className="text-xs">
                            {s.tag}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* 查看全部 */}
        <div className="mt-3 flex justify-center border-t pt-3">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/dashboard/servers">
              {t("viewAllServers")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
