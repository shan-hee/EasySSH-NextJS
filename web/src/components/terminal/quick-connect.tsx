"use client"

import { Terminal, Server, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AnimatedList } from "@/components/ui/animated-list"
import { useTranslations } from "next-intl"

export type QuickServer = {
  id: string
  name: string
  host: string
  port: number
  username: string
  status: "online" | "offline"
  group?: string
  tags?: string[]
  last_connected?: string  // 最后连接时间
}

interface QuickConnectProps {
  servers: QuickServer[]
  isLoading?: boolean
  onSelectServer: (server: QuickServer) => void
}

export function QuickConnect({ servers, isLoading, onSelectServer }: QuickConnectProps) {
  const tTerminal = useTranslations("terminal")

  // 先分离在线和离线服务器
  const onlineServers = servers.filter((s) => s.status === "online")
  const offlineServers = servers.filter((s) => s.status === "offline")

  // 按最后连接时间排序（最近连接的排在前面）
  const sortByLastConnected = (a: QuickServer, b: QuickServer) => {
    // 如果两者都有 last_connected，比较时间
    if (a.last_connected && b.last_connected) {
      return new Date(b.last_connected).getTime() - new Date(a.last_connected).getTime()
    }
    // 如果只有 a 有 last_connected，a 排在前面
    if (a.last_connected && !b.last_connected) {
      return -1
    }
    // 如果只有 b 有 last_connected，b 排在前面
    if (!a.last_connected && b.last_connected) {
      return 1
    }
    // 如果两者都没有，保持原顺序
    return 0
  }

  // 在线和离线服务器分别按最后连接时间排序
  const sortedOnlineServers = [...onlineServers].sort(sortByLastConnected)
  const sortedOfflineServers = [...offlineServers].sort(sortByLastConnected)

  return (
    <div className="h-full flex flex-col overflow-hidden relative bg-background transition-colors">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent via-border" />

      <div className="flex-1 flex flex-col items-center px-8 py-12 overflow-y-auto">
        <div className="max-w-3xl w-full space-y-12">
          {/* Hero 区域 */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl border border-border bg-card/80 shadow-sm">
              <Terminal className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold text-foreground">
                {tTerminal("quickConnectTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {tTerminal("quickConnectSubtitle")}
              </p>
            </div>
          </div>

          {/* 服务器列表 */}
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-px bg-gradient-to-r from-transparent to-transparent via-border" />
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tTerminal("quickConnectLoading")}
                </p>
              </div>
            </div>
          ) : sortedOnlineServers.length > 0 ? (
            <div className="space-y-4">
              <div className="h-px bg-gradient-to-r from-transparent to-transparent via-border" />

              <AnimatedList className="space-y-2">
                {sortedOnlineServers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => onSelectServer(server)}
                    className="group flex items-center gap-3 p-4 rounded-lg border border-border/70 bg-card/70 cursor-pointer transition-all duration-200 hover:border-border hover:bg-accent/50"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground transition-colors truncate group-hover:text-primary">
                        {server.name || server.host}
                      </div>
                      <div className="text-xs font-mono truncate text-muted-foreground">
                        {server.username}@{server.host}:{server.port}
                      </div>
                    </div>

                    {server.group && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {server.group}
                      </Badge>
                    )}
                  </div>
                ))}
              </AnimatedList>
            </div>
          ) : null}

          {/* 无服务器提示 */}
          {!isLoading && sortedOnlineServers.length === 0 && (
            <div className="text-center space-y-3 py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border border-border bg-card/70">
                <Server className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {tTerminal("quickConnectEmptyTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tTerminal("quickConnectEmptyDescription")}
                </p>
              </div>
            </div>
          )}

          {!isLoading && sortedOfflineServers.length > 0 && (
            <div className="rounded-lg border border-border/70 bg-card/60 p-3">
              <div className="text-xs mb-2 text-muted-foreground">
                {tTerminal("quickConnectOfflineSectionTitle")}
              </div>
              <AnimatedList className="space-y-1.5">
                {sortedOfflineServers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => onSelectServer(server)}
                    className="group flex items-center gap-2 p-2 rounded cursor-pointer transition-all duration-200 hover:bg-accent/50"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></div>
                    <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      {server.name || server.host} <span className="font-mono">({server.host})</span>
                    </span>
                  </div>
                ))}
              </AnimatedList>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
