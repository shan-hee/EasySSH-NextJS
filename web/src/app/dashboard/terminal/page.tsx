"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/sonner"
import { TerminalComponent } from "@/components/terminal/terminal-component"
import { TerminalSession } from "@/components/terminal/types"
import type { QuickServer } from "@/components/terminal/quick-connect"
import { useRouter, useSearchParams } from "next/navigation"
import { serversApi, type Server } from "@/lib/api"
import { Loader2 } from "lucide-react"

export default function TerminalPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [servers, setServers] = useState<QuickServer[]>([])
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<TerminalSession[]>(() => {
    // 使用稳定常量 id，避免 SSR/CSR 时间差导致的 hydration mismatch
    const now = Date.now()
    return [
      {
        id: "quick-initial",
        serverId: 0,
        serverName: "快速连接",
        host: "",
        port: undefined,
        username: "",
        isConnected: false,
        status: "disconnected",
        lastActivity: now,
        type: "quick",
        pinned: false,
      },
    ]
  })
  const [hibernateBackground, setHibernateBackground] = useState(true)
  const [maxTabs, setMaxTabs] = useState(50)
  const [inactiveMinutes, setInactiveMinutes] = useState(60)
  const inactivityNotifiedRef = useRef<Set<string>>(new Set())

  // 加载服务器列表
  useEffect(() => {
    loadServers()
  }, [])

  // 处理URL参数中的server参数（从服务器列表跳转过来）
  useEffect(() => {
    const serverId = searchParams.get("server")
    if (serverId && servers.length > 0) {
      const server = servers.find(s => s.id.toString() === serverId)
      if (server && server.status === "online") {
        // 自动创建该服务器的终端会话
        const now = Date.now()
        const sessionId = `auto-${now}`
        const newSession: TerminalSession = {
          id: sessionId,
          serverId: server.id,
          serverName: server.name,
          host: server.host,
          port: server.port,
          username: server.username,
          isConnected: true,
          status: "connected",
          lastActivity: now,
          group: server.group,
          tags: server.tags,
          pinned: false,
          type: "terminal",
        }
        setSessions(prev => [...prev, newSession])
      }
    }
  }, [searchParams, servers])

  // 读取通用设置（仅使用本地存储集成）
  useEffect(() => {
    try {
      const mt = Number(localStorage.getItem("tab.maxTabs") || "50")
      if (!isNaN(mt)) setMaxTabs(mt)
      const im = Number(localStorage.getItem("tab.inactiveMinutes") || "60")
      if (!isNaN(im)) setInactiveMinutes(im)
      const hb = localStorage.getItem("tab.hibernate")
      if (hb != null) setHibernateBackground(hb === "true")
    } catch {}
  }, [])

  // 加载服务器列表
  async function loadServers() {
    try {
      setLoading(true)
      const token = localStorage.getItem("easyssh_access_token")

      if (!token) {
        router.push("/login")
        return
      }

      const response = await serversApi.list(token, {
        page: 1,
        limit: 100, // 加载所有服务器
      })

      // 将Server类型转换为QuickServer类型
      const quickServers: QuickServer[] = response.data.map((server: Server) => ({
        id: parseInt(server.id),
        name: server.name,
        host: server.host,
        port: server.port,
        username: server.username,
        status: server.status === "online" ? "online" : "offline",
        group: server.group,
        tags: server.tags,
      }))

      setServers(quickServers)
    } catch (error: any) {
      console.error("Failed to load servers:", error)

      if (error?.status === 401) {
        toast.error("登录已过期，请重新登录")
        router.push("/login")
      } else {
        toast.error("加载服务器列表失败: " + (error?.message || "未知错误"))
      }
    } finally {
      setLoading(false)
    }
  }

  // 创建“快速连接”页签
  const handleNewSession = (): string | void => {
    // 最大页签数限制
    if (sessions.length >= maxTabs) {
      toast.error(`已达到最大页签数限制 (${maxTabs})`)
      return
    }
    const now = Date.now()
    const id = `quick-${now}`
    const newTab: TerminalSession = {
      id,
      serverId: 0,
      serverName: "快速连接",
      host: "",
      username: "",
      isConnected: false,
      status: "disconnected",
      lastActivity: now,
      type: "quick",
      pinned: false,
    }
    setSessions(prev => [...prev, newTab])
    return id
  }

  // 从“快速连接”页签内选择服务器，升级为终端会话
  const handleStartConnectionFromQuick = (sessionId: string, server: QuickServer) => {
    const now = Date.now()
    setSessions(prev => prev.map(s => s.id === sessionId ? {
      id: s.id,
      serverId: server.id,
      serverName: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      isConnected: server.status === "online",
      status: server.status === "online" ? "connected" : "disconnected",
      lastActivity: now,
      group: server.group,
      tags: server.tags,
      pinned: false,
      type: "terminal",
    } : s))
  }

  // 关闭会话
  const handleCloseSession = (sessionId: string) => {
    // 若这次关闭会导致页签为空，则立刻跳转上一级，避免出现“无页签”中间态
    if (sessions.length <= 1) {
      router.replace("/dashboard")
      return
    }
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  const handleDuplicateSession = (sessionId: string) => {
    const src = sessions.find(s => s.id === sessionId)
    if (!src) return
    if (sessions.length >= maxTabs) {
      toast.error(`已达到最大页签数限制 (${maxTabs})`)
      return
    }
    const now = Date.now()
    const dup: TerminalSession = { ...src, id: `session-${now}`, lastActivity: now, pinned: false }
    setSessions(prev => [...prev, dup])
  }

  const handleCloseOthers = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id === sessionId || s.pinned))
  }

  const handleCloseAll = () => {
    const next = sessions.filter(s => s.pinned)
    if (next.length === 0) {
      router.replace("/dashboard")
      return
    }
    setSessions(next)
  }

  const handleTogglePin = (sessionId: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, pinned: !s.pinned } : s))
  }

  const handleReorder = (newOrderIds: string[]) => {
    const map = new Map(sessions.map(s => [s.id, s]))
    const newList = newOrderIds.map(id => map.get(id)!).filter(Boolean)
    if (newList.length === sessions.length) setSessions(newList)
  }

  // 发送命令
  const handleSendCommand = (sessionId: string, command: string) => {
    console.log(`Session ${sessionId}: ${command}`)
    // 这里应该处理实际的命令发送逻辑

    // 更新最后活动时间
    const now = Date.now()
    setSessions(prev => prev.map(session => session.id === sessionId ? { ...session, lastActivity: now } : session))
    // 清除已提醒标记
    inactivityNotifiedRef.current.delete(sessionId)
  }

  // 未活动断开提醒
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now()
      const threshold = inactiveMinutes * 60 * 1000
      sessions.forEach(s => {
        if (!s) return
        if (now - s.lastActivity >= threshold && !inactivityNotifiedRef.current.has(s.id)) {
          inactivityNotifiedRef.current.add(s.id)
          toast(`会话"${s.serverName}"长时间未活动`, {
            description: `已超过 ${inactiveMinutes} 分钟未活动，是否断开？`,
            action: { label: "断开", onClick: () => handleCloseSession(s.id) },
          })
        }
      })
    }, 60 * 1000)
    return () => clearInterval(t)
  }, [sessions, inactiveMinutes])

  // 加载中状态
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">加载服务器列表...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <TerminalComponent
        sessions={sessions}
        onNewSession={handleNewSession}
        onCloseSession={handleCloseSession}
        onSendCommand={handleSendCommand}
        onDuplicateSession={handleDuplicateSession}
        onCloseOthers={handleCloseOthers}
        onCloseAll={handleCloseAll}
        onTogglePin={handleTogglePin}
        onReorderSessions={handleReorder}
        hibernateBackground={hibernateBackground}
        onStartConnectionFromQuick={handleStartConnectionFromQuick}
        servers={servers}
      />
    </div>
  )
}
