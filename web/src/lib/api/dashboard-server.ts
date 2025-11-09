import { serverApiFetch } from "@/lib/server-api"
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
 * 服务器统计数据
 */
export interface ServerStats {
  totalServers: number
  onlineServers: number
  offlineServers: number
}

/**
 * 审计日志统计数据
 */
export interface AuditStats {
  todayConnections: number
  recentLogsCount: number
}

/**
 * 获取服务器统计数据（快速）
 * 用于 Streaming 优化，独立获取服务器数据
 */
export async function getServerStats(): Promise<ServerStats> {
  try {
    const serversResponse = await serverApiFetch<ServerListResponse>("/servers?page=1&limit=1000")

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

    return {
      totalServers: total,
      onlineServers: onlineCount,
      offlineServers: offlineCount,
    }
  } catch (error) {
    console.error("Failed to load server stats:", error)
    throw error
  }
}

/**
 * 获取审计日志统计数据（可能较慢）
 * 用于 Streaming 优化，独立获取审计日志数据
 */
export async function getAuditStats(): Promise<AuditStats> {
  try {
    const logsStats = await serverApiFetch<AuditLogStatisticsResponse>(
      "/audit-logs/statistics"
    ).catch(() => null)

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
      todayConnections,
      recentLogsCount,
    }
  } catch (error) {
    console.error("Failed to load audit stats:", error)
    // 审计日志统计失败时返回默认值，不影响主要功能
    return {
      todayConnections: 0,
      recentLogsCount: 0,
    }
  }
}

/**
 * 获取仪表盘数据（服务端）
 * 并行加载服务器列表和审计日志统计
 * @deprecated 建议使用 getServerStats 和 getAuditStats 分别获取，以支持 Streaming
 */
export async function getDashboardData(): Promise<DashboardStats> {
  try {
    // 并行加载服务器统计和审计日志统计
    const [serverStats, auditStats] = await Promise.all([
      getServerStats(),
      getAuditStats(),
    ])

    return {
      ...serverStats,
      ...auditStats,
    }
  } catch (error) {
    console.error("Failed to load dashboard data:", error)
    throw error
  }
}
