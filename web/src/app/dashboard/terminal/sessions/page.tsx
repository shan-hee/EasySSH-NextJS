"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, RefreshCw, Activity, Server, ArrowUpDown, ArrowDownUp, Loader2, XCircle } from "lucide-react"
import { sshSessionsApi, type SSHSessionDetail, type SSHSessionStatistics } from "@/lib/api/ssh-sessions"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useLocale, useTranslations } from "next-intl"

const statusColors = {
  active: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  timeout: "bg-red-100 text-red-800",
}

// 格式化数据传输量
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 格式化时长（使用 i18n 文案）
function formatDuration(
  seconds: number | undefined,
  t: (key: string, values?: Record<string, number>) => string
): string {
  if (!seconds) return "-"

  if (seconds < 60) {
    return t("durationSeconds", { seconds })
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0
      ? t("durationMinutesSeconds", { minutes, seconds: remainingSeconds })
      : t("durationMinutes", { minutes })
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0
    ? t("durationHoursMinutes", { hours, minutes: remainingMinutes })
    : t("durationHours", { hours })
}

// 格式化时间
function formatTimestamp(timestamp: string, locale: string): { date: string; time: string } {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString(locale),
    time: date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }
}

export default function TerminalSessionsPage() {
  const { ready } = useAuthReady()
  const [sessions, setSessions] = useState<SSHSessionDetail[]>([])
  const [statistics, setStatistics] = useState<SSHSessionStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const t = useTranslations("terminalSessions")
  const locale = useLocale()

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // 并行加载活动会话列表和统计信息
      const [sessionsResponse, statsResponse] = await Promise.all([
        sshSessionsApi.list({
          status: "active",
          limit: 100,
        }),
        sshSessionsApi.getStatistics(),
      ])

      setSessions(sessionsResponse.data || [])
      setStatistics(statsResponse)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("loadFailed")))
    } finally {
      setLoading(false)
    }
  }, [t])

  // 初始加载（仅在已认证且全局状态就绪时触发）
  useEffect(() => {
    if (!ready) return
    loadData()
  }, [ready, loadData])

  // 客户端搜索过滤
  const filteredSessions = sessions.filter(session => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      session.session_id.toLowerCase().includes(searchLower) ||
      session.client_ip.toLowerCase().includes(searchLower) ||
      session.terminal_type.toLowerCase().includes(searchLower)
    )
  })

  // 删除会话记录
  const handleDelete = async (id: string) => {
    try {
      await sshSessionsApi.delete(id)
      toast.success(t("deleteSuccess"))
      loadData()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("deleteFailed")))
    }
  }

  return (
    <>
      <PageHeader title={t("pageTitle")}>
        <Button variant="outline" size="sm" onClick={() => loadData()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("refresh")}
        </Button>
      </PageHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pt-0 sm:gap-4 sm:p-4 sm:pt-0 xl:overflow-hidden">
        {/* 统计卡片 */}
        <div className="grid shrink-0 gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsActive")}</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics?.active_sessions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsActiveDesc")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsTotal")}</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.total_sessions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsTotalDesc")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsUpload")}</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatBytes(statistics?.total_bytes_sent || 0)}
              </div>
              <p className="text-xs text-muted-foreground">{t("statsUploadDesc")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsDownload")}</CardTitle>
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatBytes(statistics?.total_bytes_received || 0)}
              </div>
              <p className="text-xs text-muted-foreground">{t("statsDownloadDesc")}</p>
            </CardContent>
          </Card>
        </div>

        {/* 搜索栏 */}
        <Card className="shrink-0 gap-0 py-0">
          <CardHeader className="py-3 sm:py-4">
            <CardTitle className="text-lg">{t("searchTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t("searchPlaceholder")}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 活动会话表格 */}
        <Card className="min-h-0 flex-1 gap-0 overflow-hidden p-0">
            <CardHeader className="shrink-0 p-4 sm:p-5">
              <CardTitle className="text-lg">{t("tableTitle")}</CardTitle>
              <CardDescription>
                {t("tableDescription", {
                  current: filteredSessions.length,
                  total: sessions.length,
                })}
              </CardDescription>
            </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {t("empty")}
              </div>
            ) : (
              <div className="h-full overflow-auto border-t">
                <Table className="min-w-[980px]">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>{t("colSessionId")}</TableHead>
                      <TableHead>{t("colClientInfo")}</TableHead>
                      <TableHead>{t("colTerminalType")}</TableHead>
                      <TableHead>{t("colConnectedAt")}</TableHead>
                      <TableHead>{t("colDuration")}</TableHead>
                      <TableHead>{t("colTraffic")}</TableHead>
                      <TableHead>{t("colCommands")}</TableHead>
                      <TableHead>{t("colStatus")}</TableHead>
                      <TableHead>{t("colActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map(session => {
                      const { date, time } = formatTimestamp(session.connected_at, locale)
                      const duration = session.duration || 0
                      return (
                        <TableRow key={session.id}>
                          <TableCell className="font-mono text-sm">
                            {session.session_id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{session.client_ip}</div>
                              <div className="text-xs text-muted-foreground">
                                Port: {session.client_port}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{session.terminal_type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            <div>
                              <div>{time}</div>
                              <div className="text-xs text-muted-foreground">{date}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(duration, t)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="flex items-center gap-1 text-blue-600">
                                <ArrowUpDown className="h-3 w-3" />
                                {formatBytes(session.bytes_sent)}
                              </div>
                              <div className="flex items-center gap-1 text-green-600">
                                <ArrowDownUp className="h-3 w-3" />
                                {formatBytes(session.bytes_received)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            N/A
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[session.status as keyof typeof statusColors]}>
                              {session.status === "active"
                                ? t("statusActive")
                                : session.status === "closed"
                                ? t("statusClosed")
                                : t("statusTimeout")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(session.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
