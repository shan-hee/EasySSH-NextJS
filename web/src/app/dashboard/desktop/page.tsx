"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Bot,
  Clock,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Server as ServerIcon,
  Settings,
  Terminal,
  Upload,
  type LucideIcon,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { serversApi, sshSessionsApi, type Server, type SSHSessionDetail } from "@/lib/api"
import { getErrorMessage } from "@/lib/error-utils"
import { cn } from "@/lib/utils"

export default function DesktopWorkbenchPage() {
  const t = useTranslations("desktopWorkbench")
  const router = useRouter()
  const { ready } = useAuthReady()
  const [servers, setServers] = useState<Server[]>([])
  const [sessions, setSessions] = useState<SSHSessionDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    if (!ready) return

    setLoading(true)
    setError("")
    try {
      const [serverResponse, sessionResponse] = await Promise.all([
        serversApi.list({ page: 1, limit: 1000 }),
        sshSessionsApi.list({ page: 1, limit: 6 }),
      ])
      setServers(serverResponse.data ?? [])
      setSessions(sessionResponse.data ?? [])
    } catch (err) {
      console.error("Failed to load desktop workbench:", err)
      setError(getErrorMessage(err, t("loadFailed")))
    } finally {
      setLoading(false)
    }
  }, [ready, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const recentServers = useMemo(
    () =>
      [...servers]
        .sort((a, b) => {
          const aTime = a.last_connected ? new Date(a.last_connected).getTime() : 0
          const bTime = b.last_connected ? new Date(b.last_connected).getTime() : 0
          return bTime - aTime
        })
        .slice(0, 6),
    [servers],
  )

  const totalServers = servers.length
  const onlineServers = servers.filter((server) => server.status === "online").length

  const handleConnect = (server: Server) => {
    sessionStorage.setItem("pendingConnection", JSON.stringify({
      server: server.id,
      name: server.name || server.host,
    }))
    router.push("/dashboard/terminal")
  }

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{t("quickConnectTitle")}</CardTitle>
                  <CardDescription>{t("quickConnectDescription")}</CardDescription>
                </div>
                <Button asChild size="sm">
                  <Link href="/dashboard/servers?new=1">
                    <Plus className="mr-2 h-4 w-4" />
                    {t("addServer")}
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("loading")}
                </div>
              ) : error ? (
                <div className="flex h-32 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <span>{error}</span>
                  <Button variant="outline" size="sm" onClick={() => void loadData()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("retry")}
                  </Button>
                </div>
              ) : recentServers.length === 0 ? (
                <div className="flex h-36 flex-col items-center justify-center gap-3 text-center">
                  <ServerIcon className="h-9 w-9 text-muted-foreground/50" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t("emptyTitle")}</p>
                    <p className="text-xs text-muted-foreground">{t("emptyDescription")}</p>
                  </div>
                  <Button asChild size="sm">
                    <Link href="/dashboard/servers?new=1">
                      <Plus className="mr-2 h-4 w-4" />
                      {t("addFirstServer")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {recentServers.map((server) => (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => handleConnect(server)}
                      className="flex min-h-[76px] items-center gap-3 rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted/60"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Terminal className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{server.name || server.host}</p>
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              server.status === "online" ? "bg-emerald-500" : "bg-muted-foreground/50",
                            )}
                          />
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {server.username}@{server.host}:{server.port}
                        </p>
                        {server.group && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">{server.group}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("workspaceTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm text-muted-foreground">{t("totalServers")}</span>
                  <span className="text-lg font-semibold tabular-nums">{totalServers}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm text-muted-foreground">{t("onlineServers")}</span>
                  <span className="text-lg font-semibold tabular-nums">{onlineServers}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("shortcutsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Shortcut href="/dashboard/terminal" icon={Terminal} label={t("terminal")} />
                <Shortcut href="/dashboard/sftp" icon={FolderOpen} label={t("files")} />
                <Shortcut href="/dashboard/ai-assistant" icon={Bot} label={t("aiAssistant")} />
                <Shortcut href="/dashboard/settings?section=backup" icon={Upload} label={t("importData")} />
                <Shortcut href="/dashboard/settings" icon={Settings} label={t("settings")} />
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {t("recentSessionsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t("noRecentSessions")}</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {sessions.map((session) => (
                  <div key={session.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{session.server_name || session.server_host}</p>
                      <Badge variant={session.status === "active" ? "default" : "outline"}>{session.status}</Badge>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {session.server_host}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(session.connected_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Shortcut({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: LucideIcon
  label: string
}) {
  return (
    <Button asChild variant="outline" className="h-16 flex-col gap-1.5">
      <Link href={href}>
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </Link>
    </Button>
  )
}
