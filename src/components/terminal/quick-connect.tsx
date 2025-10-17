"use client"

import { useEffect, useState } from "react"
import { Terminal, Server } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useTheme } from "next-themes"

export type QuickServer = {
  id: number
  name: string
  host: string
  port: number
  username: string
  status: "online" | "offline"
  group?: string
  tags?: string[]
}

interface QuickConnectProps {
  servers: QuickServer[]
  onSelectServer: (server: QuickServer) => void
}

export function QuickConnect({ servers, onSelectServer }: QuickConnectProps) {
  const onlineServers = servers.filter((s) => s.status === "online")
  const offlineServers = servers.filter((s) => s.status === "offline")

  // 获取应用主题
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 确保只在客户端渲染时应用主题
  useEffect(() => {
    setMounted(true)
  }, [])

  // 初始从 html.dark 读取，挂载后使用 resolvedTheme，避免浅色初始黑屏
  const initialIsDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const isDark = mounted ? resolvedTheme === 'dark' : initialIsDark

  return (
    <div className={`h-full flex flex-col rounded-b-lg border overflow-hidden relative transition-colors ${
      isDark
        ? 'bg-black border-zinc-800/50'
        : 'bg-white border-zinc-200'
    }`}>
      <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent ${
        isDark ? 'via-white/5' : 'via-black/5'
      }`} />

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="max-w-3xl w-full space-y-12">
          {/* Hero 区域 */}
          <div className="text-center space-y-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl border ${
              isDark
                ? 'bg-gradient-to-b from-zinc-800/90 to-zinc-900/90 border-zinc-700/50'
                : 'bg-gradient-to-b from-zinc-100 to-zinc-200 border-zinc-300'
            }`}>
              <Terminal className="h-8 w-8 text-green-500" />
            </div>

            <div className="space-y-3">
              <h1 className={`text-3xl font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                快速连接
              </h1>
              <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                选择一个服务器开始终端会话
              </p>
            </div>
          </div>

          {/* 服务器列表 */}
          {onlineServers.length > 0 && (
            <div className="space-y-4">
              <div className={`h-px bg-gradient-to-r from-transparent to-transparent ${
                isDark ? 'via-zinc-800' : 'via-zinc-300'
              }`} />

              <div className="space-y-2">
                {onlineServers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => onSelectServer(server)}
                    className={`group flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                      isDark
                        ? 'bg-zinc-900/40 border-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-700/40'
                        : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium transition-colors truncate ${
                        isDark
                          ? 'text-white group-hover:text-green-400'
                          : 'text-zinc-900 group-hover:text-green-600'
                      }`}>
                        {server.name}
                      </div>
                      <div className={`text-xs font-mono truncate ${
                        isDark ? 'text-zinc-600' : 'text-zinc-500'
                      }`}>
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
              </div>
            </div>
          )}

          {/* 无服务器提示 */}
          {onlineServers.length === 0 && (
            <div className="text-center space-y-3 py-8">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg border ${
                isDark
                  ? 'bg-zinc-900/40 border-zinc-800/30'
                  : 'bg-zinc-50 border-zinc-200'
              }`}>
                <Server className={`h-6 w-6 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
              </div>
              <div className="space-y-1">
                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                  暂无可用服务器
                </p>
                <p className={`text-xs ${isDark ? 'text-zinc-600' : 'text-zinc-500'}`}>
                  请先在服务器管理中添加服务器
                </p>
              </div>
            </div>
          )}

          {offlineServers.length > 0 && (
            <div className={`rounded-lg border p-3 ${
              isDark
                ? 'bg-zinc-900/30 border-zinc-800/30'
                : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div className={`text-xs mb-2 flex items-center gap-2 ${
                isDark ? 'text-zinc-500' : 'text-zinc-600'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                  isDark ? 'bg-zinc-600' : 'bg-zinc-400'
                }`} />
                离线服务器
              </div>
              <div className="space-y-1.5">
                {offlineServers.map((server) => (
                  <div key={server.id} className={`flex items-center gap-2 text-xs pl-3 ${
                    isDark ? 'text-zinc-600' : 'text-zinc-500'
                  }`}>
                    <div className={`w-1 h-1 rounded-full ${
                      isDark ? 'bg-zinc-700' : 'bg-zinc-400'
                    }`}></div>
                    {server.name} <span className="font-mono">({server.host})</span>
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
