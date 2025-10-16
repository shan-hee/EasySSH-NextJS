"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/sonner"
import { TerminalComponent } from "@/components/terminal/terminal-component"
import { TerminalSession } from "@/components/terminal/types"
import type { QuickServer } from "@/components/terminal/quick-connect"
import { useRouter } from "next/navigation"

// 模拟服务器数据
const servers: QuickServer[] = [
  {
    id: 1,
    name: "Web Server 01",
    host: "192.168.1.100",
    port: 22,
    username: "root",
    status: "online" as const,
    group: "生产",
    tags: ["web"],
  },
  {
    id: 2,
    name: "Database Server",
    host: "192.168.1.101",
    port: 22,
    username: "admin",
    status: "online" as const,
    group: "生产",
    tags: ["db"],
  },
  {
    id: 3,
    name: "Dev Server",
    host: "192.168.1.102",
    port: 2222,
    username: "developer",
    status: "offline" as const,
    group: "开发",
    tags: ["dev"],
  },
]

export default function TerminalPage() {
  const router = useRouter()
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
          toast(`会话“${s.serverName}”长时间未活动`, {
            description: `已超过 ${inactiveMinutes} 分钟未活动，是否断开？`,
            action: { label: "断开", onClick: () => handleCloseSession(s.id) },
          })
        }
      })
    }, 60 * 1000)
    return () => clearInterval(t)
  }, [sessions, inactiveMinutes])

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
