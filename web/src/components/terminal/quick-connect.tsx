"use client"

import { Terminal, Server, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AnimatedList } from "@/components/ui/animated-list"

export type QuickServer = {
  id: number | string  // 支持 UUID 字符串
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
  // 先分离在线和离线服务器
  const onlineServers = servers.filter((s) => s.status === "online")
  const offlineServers = servers.filter((s) => s.status === "offline")

  // 按最后连接时间排序（最近连接的排在前面）
  const sortedOnlineServers = onlineServers.sort((a, b) => {
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
  })

  return (
    <div className={"h-full flex flex-col overflow-hidden relative transition-colors bg-white dark:bg-black"}>
      <div className={"absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent via-black/5 dark:via-white/5"} />

      <div className="flex-1 flex flex-col items-center px-8 py-12 overflow-y-auto">
        <div className="max-w-3xl w-full space-y-12">
          {/* Hero 区域 */}
          <div className="text-center space-y-6">
            <div className={"inline-flex items-center justify-center w-16 h-16 rounded-xl border bg-gradient-to-b from-zinc-100 to-zinc-200 border-zinc-300 dark:from-zinc-800/90 dark:to-zinc-900/90 dark:border-zinc-700/50"}>
              <Terminal className="h-8 w-8 text-green-500" />
            </div>

            <div className="space-y-3">
              <h1 className={"text-3xl font-semibold text-zinc-900 dark:text-white"}>
                快速连接
              </h1>
              <p className={"text-sm text-zinc-600 dark:text-zinc-500"}>
                选择一个服务器开始终端会话
              </p>
            </div>
          </div>

          {/* 服务器列表 */}
          {isLoading ? (
            <div className="space-y-4">
              <div className={"h-px bg-gradient-to-r from-transparent to-transparent via-zinc-300 dark:via-zinc-800"} />
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400 dark:text-zinc-600" />
                <p className="text-sm text-zinc-500 dark:text-zinc-600">加载服务器列表...</p>
              </div>
            </div>
          ) : sortedOnlineServers.length > 0 ? (
            <div className="space-y-4">
              <div className={"h-px bg-gradient-to-r from-transparent to-transparent via-zinc-300 dark:via-zinc-800"} />

              <AnimatedList className="space-y-2">
                {sortedOnlineServers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => onSelectServer(server)}
                    className={"group flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all duration-200 bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-zinc-900/40 dark:border-zinc-800/30 dark:hover:bg-zinc-800/60 dark:hover:border-zinc-700/40"}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className={"text-sm font-medium transition-colors truncate text-zinc-900 group-hover:text-green-600 dark:text-white dark:group-hover:text-green-400"}>
                        {server.name || server.host}
                      </div>
                      <div className={"text-xs font-mono truncate text-zinc-500 dark:text-zinc-600"}>
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
              <div className={"inline-flex items-center justify-center w-12 h-12 rounded-lg border bg-zinc-50 border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-800/30"}>
                <Server className={"h-6 w-6 text-zinc-400 dark:text-zinc-600"} />
              </div>
              <div className="space-y-1">
                <p className={"text-sm text-zinc-600 dark:text-zinc-500"}>
                  暂无可用服务器
                </p>
                <p className={"text-xs text-zinc-500 dark:text-zinc-600"}>
                  请先在服务器管理中添加服务器
                </p>
              </div>
            </div>
          )}

          {!isLoading && offlineServers.length > 0 && (
            <div className={"rounded-lg border p-3 bg-zinc-50 border-zinc-200 dark:bg-zinc-900/30 dark:border-zinc-800/30"}>
              <div className={"text-xs mb-2 text-zinc-600 dark:text-zinc-500"}>
                离线服务器
              </div>
              <div className="space-y-1.5">
                {offlineServers.map((server) => (
                  <div key={server.id} className={"flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-600"}>
                    <div className={"w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"}></div>
                    {server.name || server.host} <span className="font-mono">({server.host})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
