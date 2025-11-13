import { apiFetch } from "@/lib/api-client"
import type { ServerListResponse } from "./servers"
import type { AuditLogStatisticsResponse } from "./audit-logs"

/**
 * 仪表盘统计数据
 */
export interface DashboardStats {
  totalServers: number
  onlineServers: number
  offlineServers: number
  todayConnections: number
  recentLogsCount: number
}

/**
 * 获取仪表盘统计数据（客户端）
 * 并行加载服务器列表和审计日志统计
 */
async function getStats(): Promise<DashboardStats> {
  try {
    // 并行加载服务器统计和审计日志统计
    const [serversResponse, logsStats] = await Promise.all([
      apiFetch<ServerListResponse>("/servers?page=1&limit=1000"),
      apiFetch<AuditLogStatisticsResponse>("/audit-logs/statistics").catch(() => null),
    ])

    // 处理服务器数据
    const servers = Array.isArray(serversResponse)
      ? serversResponse
      : Array.isArray(serversResponse?.data)
        ? serversResponse.data
        : []
    const total = Array.isArray(serversResponse)
      ? servers.length
      : serversResponse?.total || 0

    const onlineCount = servers.filter((s) => s.status === "online").length
    const offlineCount = servers.filter((s) => s.status === "offline").length

    // 处理审计日志统计数据
    const statsData = logsStats?.action_stats
      ? logsStats
      : ((logsStats as unknown as { data?: typeof logsStats })?.data ?? null)

    const todayConnections = statsData?.action_stats
      ? Object.values(statsData.action_stats).reduce(
          (sum: number, count) => sum + (count as number),
          0
        )
      : 0

    const recentLogsCount = statsData?.total_logs || 0

    return {
      totalServers: total,
      onlineServers: onlineCount,
      offlineServers: offlineCount,
      todayConnections,
      recentLogsCount,
    }
  } catch (error) {
    console.error("Failed to load dashboard data:", error)
    throw error
  }
}

/**
 * Dashboard API 客户端
 */
export const dashboardApi = {
  getStats,
}
