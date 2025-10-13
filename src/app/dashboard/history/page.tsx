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
import { SessionHistory } from "@/components/terminal/session-history"

// 模拟历史会话数据
const mockHistorySessions = [
  {
    id: "session-h001",
    serverId: 1,
    serverName: "Web Server 01",
    host: "192.168.1.100",
    port: 22,
    username: "root",
    startTime: "2024-01-15 09:30:00",
    endTime: "2024-01-15 11:45:00",
    duration: "2小时 15分钟",
    commandsCount: 89,
    dataTransferred: "5.2 MB",
    status: "completed" as const,
  },
  {
    id: "session-h002",
    serverId: 2,
    serverName: "Database Server",
    host: "192.168.1.101",
    port: 22,
    username: "admin",
    startTime: "2024-01-15 08:00:00",
    endTime: "2024-01-15 12:30:00",
    duration: "4小时 30分钟",
    commandsCount: 156,
    dataTransferred: "12.8 MB",
    status: "completed" as const,
  },
  {
    id: "session-h003",
    serverId: 3,
    serverName: "Dev Server",
    host: "192.168.1.102",
    port: 2222,
    username: "developer",
    startTime: "2024-01-14 15:20:00",
    endTime: "2024-01-14 18:45:00",
    duration: "3小时 25分钟",
    commandsCount: 67,
    dataTransferred: "3.1 MB",
    status: "disconnected" as const,
  },
  {
    id: "session-h004",
    serverId: 4,
    serverName: "Load Balancer",
    host: "192.168.1.103",
    port: 22,
    username: "root",
    startTime: "2024-01-14 14:10:00",
    endTime: "2024-01-14 14:35:00",
    duration: "25分钟",
    commandsCount: 12,
    dataTransferred: "245 KB",
    status: "error" as const,
    exitCode: 130,
  },
  {
    id: "session-h005",
    serverId: 1,
    serverName: "Web Server 01",
    host: "192.168.1.100",
    port: 22,
    username: "root",
    startTime: "2024-01-13 16:45:00",
    endTime: "2024-01-13 19:20:00",
    duration: "2小时 35分钟",
    commandsCount: 94,
    dataTransferred: "7.3 MB",
    status: "completed" as const,
  },
  {
    id: "session-h006",
    serverId: 2,
    serverName: "Database Server",
    host: "192.168.1.101",
    port: 22,
    username: "admin",
    startTime: "2024-01-13 10:15:00",
    endTime: "2024-01-13 11:50:00",
    duration: "1小时 35分钟",
    commandsCount: 43,
    dataTransferred: "2.1 MB",
    status: "completed" as const,
  },
  {
    id: "session-h007",
    serverId: 3,
    serverName: "Dev Server",
    host: "192.168.1.102",
    port: 2222,
    username: "developer",
    startTime: "2024-01-12 13:30:00",
    endTime: "2024-01-12 17:15:00",
    duration: "3小时 45分钟",
    commandsCount: 128,
    dataTransferred: "8.7 MB",
    status: "completed" as const,
  },
  {
    id: "session-h008",
    serverId: 1,
    serverName: "Web Server 01",
    host: "192.168.1.100",
    port: 22,
    username: "root",
    startTime: "2024-01-11 11:20:00",
    endTime: "2024-01-11 11:35:00",
    duration: "15分钟",
    commandsCount: 8,
    dataTransferred: "123 KB",
    status: "disconnected" as const,
  },
]

export default function HistoryPage() {
  const [sessions] = useState(mockHistorySessions)

  const handleViewDetails = (sessionId: string) => {
    console.log("查看会话详情:", sessionId)
    // 这里应该显示会话的详细命令历史
  }

  const handleExportSession = (sessionId: string) => {
    console.log("导出会话数据:", sessionId)
    // 这里应该导出会话的详细日志

    // 模拟下载文件
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      const data = {
        sessionId: session.id,
        serverName: session.serverName,
        host: session.host,
        username: session.username,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        commandsCount: session.commandsCount,
        dataTransferred: session.dataTransferred,
        status: session.status,
        exportTime: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${sessionId}-export.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">
                  EasySSH 控制台
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>会话历史</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <SessionHistory
          sessions={sessions}
          onViewDetails={handleViewDetails}
          onExportSession={handleExportSession}
        />
      </div>
    </>
  )
}