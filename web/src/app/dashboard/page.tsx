"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import Link from "next/link"
import { serversApi, auditLogsApi } from "@/lib/api"
import { getErrorMessage } from "@/lib/error-utils"
import { Server, Activity, History } from "lucide-react"
import { SkeletonCard } from "@/components/ui/loading"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"

interface DashboardStats {
 totalServers: number
 onlineServers: number
 offlineServers: number
 todayConnections: number
 recentLogsCount: number
}

export default function Page() {
 const router = useRouter()
 const [stats, setStats] = useState<DashboardStats>({
 totalServers: 0,
 onlineServers: 0,
 offlineServers: 0,
 todayConnections: 0,
 recentLogsCount: 0,
 })
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 loadDashboardData()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 async function loadDashboardData() {
 try {
 setLoading(true)
 const accessToken = localStorage.getItem("easyssh_access_token")

 if (!accessToken) {
 router.push("/login")
 return
 }

 // 并行加载服务器列表和审计日志统计
 const [serversResponse, logsStats] = await Promise.all([
 serversApi.list(accessToken, { page: 1, limit: 1000 }),
 auditLogsApi.getStatistics(accessToken).catch(() => null), // 如果失败，返回 null
 ])

 // 防御性检查：处理apiFetch自动解包导致的数据结构不一致，确保始终返回数组
 const servers = Array.isArray(serversResponse)
 ? serversResponse
 : (Array.isArray(serversResponse?.data) ? serversResponse.data : [])
 const total = Array.isArray(serversResponse)
 ? servers.length
 : (serversResponse?.total || 0)

 const onlineCount = servers.filter(s => s.status === "online").length
 const offlineCount = servers.filter(s => s.status === "offline").length

 // 防御性检查：处理审计日志统计数据
    const statsData = logsStats?.action_stats ? logsStats : (logsStats as unknown as { data?: typeof logsStats })?.data || null

 // 统计今日连接（根据操作日志中的登录操作）
 const todayConnections = statsData?.action_stats
      ? Object.values(statsData.action_stats).reduce((sum: number, count) => sum + (count as number), 0)
 : 0

 // 最近日志数量
 const recentLogsCount = statsData?.total_logs || 0

 setStats({
 totalServers: total,
 onlineServers: onlineCount,
 offlineServers: offlineCount,
 todayConnections,
 recentLogsCount,
 })
 } catch (error: unknown) {
 console.error("Failed to load dashboard data:", error)
 toast.error(getErrorMessage(error, "无法加载仪表盘数据"))
 } finally {
 setLoading(false)
 }
 }

 // 加载状态 - 使用固定的卡片骨架屏
 if (loading) {
 return (
 <>
 <PageHeader title="仪表盘" />
 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 <div className="grid auto-rows-min gap-4 md:grid-cols-3">
 <SkeletonCard showHeader={false} lines={2} />
 <SkeletonCard showHeader={false} lines={2} />
 <SkeletonCard showHeader={false} lines={2} />
 </div>
 <SkeletonCard showHeader lines={4} className="flex-1" />
 </div>
 </>
 )
 }

 return (
 <>
 <PageHeader title="仪表盘" />
 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 <div className="grid auto-rows-min gap-4 md:grid-cols-3">
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
 <div className="bg-card border rounded-xl p-6">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-lg font-semibold">操作总数</h3>
 <Activity className="h-5 w-5 text-muted-foreground" />
 </div>
 <p className="text-3xl font-bold text-green-600">{stats.todayConnections}</p>
 <p className="text-sm text-muted-foreground">所有审计日志记录</p>
 </div>
 <div className="bg-card border rounded-xl p-6">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-lg font-semibold">历史记录</h3>
 <History className="h-5 w-5 text-muted-foreground" />
 </div>
 <p className="text-3xl font-bold text-blue-600">{stats.recentLogsCount}</p>
 <p className="text-sm text-muted-foreground">系统操作记录</p>
 </div>
 </div>
 <div className="bg-card border rounded-xl p-6 flex-1">
 <h3 className="text-xl font-semibold mb-4">快速操作</h3>
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
 <Link href="/dashboard/servers">
 <button className="bg-primary text-primary-foreground p-4 rounded-lg hover:bg-primary/90 transition-colors w-full">
 <div className="text-center">
 <div className="text-2xl mb-2">🖥️</div>
 <div>添加服务器</div>
 </div>
 </button>
 </Link>
 <Link href="/dashboard/terminal">
 <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
 <div className="text-center">
 <div className="text-2xl mb-2">💻</div>
 <div>Web终端</div>
 </div>
 </button>
 </Link>
 <Link href="/dashboard/monitoring">
 <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
 <div className="text-center">
 <div className="text-2xl mb-2">📊</div>
 <div>查看监控</div>
 </div>
 </button>
 </Link>
 <Link href="/dashboard/settings/general">
 <button className="bg-secondary text-secondary-foreground p-4 rounded-lg hover:bg-secondary/90 transition-colors w-full">
 <div className="text-center">
 <div className="text-2xl mb-2">⚙️</div>
 <div>系统设置</div>
 </div>
 </button>
 </Link>
 </div>
 </div>
 </div>
 </>
 )
}
