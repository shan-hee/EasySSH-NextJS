"use client"

import { Server, Activity, History } from "lucide-react"
import type { DashboardStats } from "@/lib/api/dashboard"

interface DashboardStatsCardsProps {
  stats: DashboardStats
}

/**
 * 仪表盘统计卡片组件（客户端组件）
 * 接收服务端传递的初始数据
 */
export function DashboardStatsCards({ stats }: DashboardStatsCardsProps) {
  return (
    <div className="grid auto-rows-min gap-4 md:grid-cols-3">
      {/* 服务器总数卡片 */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">服务器总数</h3>
          <Server className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-primary">{stats.totalServers}</p>
        <p className="text-sm text-muted-foreground">
          在线: {stats.onlineServers} | 离线: {stats.offlineServers}
        </p>
      </div>

      {/* 操作总数卡片 */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">操作总数</h3>
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-green-600">{stats.todayConnections}</p>
        <p className="text-sm text-muted-foreground">所有审计日志记录</p>
      </div>

      {/* 历史记录卡片 */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">历史记录</h3>
          <History className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-blue-600">{stats.recentLogsCount}</p>
        <p className="text-sm text-muted-foreground">系统操作记录</p>
      </div>
    </div>
  )
}
