"use client"

import { useState } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SessionList } from "@/components/terminal/session-list"
import Link from "next/link"
import { useRouter } from "next/navigation"

// 模拟活动会话数据
const mockSessions = [
  {
    id: "session-001",
    serverId: 1,
    serverName: "Web Server 01",
    host: "192.168.1.100",
    port: 22,
    username: "root",
    status: "connected" as const,
    startTime: "2024-01-15 14:30:00",
    lastActivity: "2 分钟前",
    duration: "2小时 15分钟",
    commandsCount: 45,
    dataTransferred: "2.3 MB",
  },
  {
    id: "session-002",
    serverId: 2,
    serverName: "Database Server",
    host: "192.168.1.101",
    port: 22,
    username: "admin",
    status: "connected" as const,
    startTime: "2024-01-15 13:45:00",
    lastActivity: "5 分钟前",
    duration: "3小时 0分钟",
    commandsCount: 67,
    dataTransferred: "4.1 MB",
  },
  {
    id: "session-003",
    serverId: 4,
    serverName: "Load Balancer",
    host: "192.168.1.103",
    port: 22,
    username: "root",
    status: "connecting" as const,
    startTime: "2024-01-15 16:20:00",
    lastActivity: "刚刚",
    duration: "5 分钟",
    commandsCount: 3,
    dataTransferred: "156 KB",
  },
  {
    id: "session-004",
    serverId: 3,
    serverName: "Dev Server",
    host: "192.168.1.102",
    port: 2222,
    username: "developer",
    status: "disconnected" as const,
    startTime: "2024-01-15 15:10:00",
    lastActivity: "10 分钟前",
    duration: "1小时 25分钟",
    commandsCount: 28,
    dataTransferred: "890 KB",
  },
]

export default function TerminalSessionsPage() {
  const [sessions, setSessions] = useState(mockSessions)
  const router = useRouter()

  const handleDisconnect = (sessionId: string) => {
    console.log("断开会话:", sessionId)
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? { ...session, status: "disconnected" as const }
        : session
    ))
  }

  const handleReconnect = (sessionId: string) => {
    console.log("重新连接会话:", sessionId)
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? { ...session, status: "connecting" as const }
        : session
    ))

    // 模拟连接过程
    setTimeout(() => {
      setSessions(prev => prev.map(session =>
        session.id === sessionId
          ? { ...session, status: "connected" as const, lastActivity: "刚刚" }
          : session
      ))
    }, 2000)
  }

  const handleViewDetails = (sessionId: string) => {
    console.log("查看会话详情:", sessionId)
    // 使用客户端路由避免整页刷新
    router.push(`/dashboard/terminal?session=${sessionId}`)
  }

  const handleForceDisconnect = (sessionId: string) => {
    console.log("强制断开会话:", sessionId)
    setSessions(prev => prev.filter(session => session.id !== sessionId))
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:duration-200 group-data-[ready=true]/sidebar-wrapper:ease-in-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link href="/dashboard">EasySSH 控制台</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard/terminal">终端</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>活动会话</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <SessionList
          sessions={sessions}
          onDisconnect={handleDisconnect}
          onReconnect={handleReconnect}
          onViewDetails={handleViewDetails}
          onForceDisconnect={handleForceDisconnect}
        />
      </div>
    </>
  )
}
