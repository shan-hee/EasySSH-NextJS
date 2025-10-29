"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
 CheckCircle,
 XCircle,
 AlertCircle,
 Server,
 Activity,
 Wifi,
 Database,
 HardDrive,
 Cpu,
 MemoryStick,
 RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import {
 serversApi,
 monitoringApi,
 type Server as ApiServer,
 type SystemInfo,
 type CPUInfo,
 type MemoryInfo,
 type DiskInfo,
 type NetworkInterface
} from "@/lib/api"
import { SkeletonCard } from "@/components/ui/loading"

// 健康检查项
interface HealthCheckItem {
 name: string
 status: "healthy" | "warning" | "unhealthy"
 value: string
 details?: string
 icon: React.ReactNode
}

// 服务器健康检查结果
interface ServerHealthCheck {
 id: string
 server: string
 ip: string
 status: "healthy" | "warning" | "unhealthy" | "offline" | "error"
 checks: HealthCheckItem[]
 overall: {
 total: number
 healthy: number
 warning: number
 unhealthy: number
 }
 lastCheck: string
 uptime?: string
}

export default function MonitoringHealthPage() {
 const router = useRouter()
 const [healthChecks, setHealthChecks] = useState<ServerHealthCheck[]>([])
 const [loading, setLoading] = useState(true)
 const [refreshing, setRefreshing] = useState(false)

 // 加载健康检查数据
 const loadData = async () => {
 try {
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 toast.error("未登录，请先登录")
 router.push("/login")
 return
 }

 // 获取服务器列表
 const serversRes = await serversApi.list(token, { page: 1, limit: 100 })

 // 防御性检查：处理apiFetch自动解包导致的数据结构不一致
 const serverList = Array.isArray(serversRes)
 ? serversRes
 : (serversRes?.data || [])

 // 并行加载所有服务器的健康检查数据
 const healthChecksPromises = serverList.map(async (server: ApiServer) => {
 if (server.status !== "online") {
 return {
 id: server.id,
 server: server.name,
 ip: server.host,
 status: "offline" as const,
 checks: [],
 overall: { total: 0, healthy: 0, warning: 0, unhealthy: 0 },
 lastCheck: new Date().toLocaleString("zh-CN"),
 }
 }

 try {
 // 并行获取所有监控数据
 const [systemInfo, cpuInfo, memoryInfo, diskInfo, networkInfo] = await Promise.all([
 monitoringApi.getSystemInfo(token, server.id),
 monitoringApi.getCPUInfo(token, server.id),
 monitoringApi.getMemoryInfo(token, server.id),
 monitoringApi.getDiskInfo(token, server.id),
 monitoringApi.getNetworkInfo(token, server.id),
 ])

 // 生成健康检查项
 const checks: HealthCheckItem[] = []

 // 1. CPU检查
 const cpuStatus =
 cpuInfo.usage_percent < 70 ? "healthy" :
 cpuInfo.usage_percent < 90 ? "warning" : "unhealthy"
 checks.push({
 name: "CPU",
 status: cpuStatus,
 value: `${cpuInfo.usage_percent.toFixed(1)}%`,
 details: `${cpuInfo.cores} 核心`,
 icon: <Cpu className="h-4 w-4" />
 })

 // 2. 内存检查
 const memoryStatus =
 memoryInfo.usage_percent < 70 ? "healthy" :
 memoryInfo.usage_percent < 90 ? "warning" : "unhealthy"
 checks.push({
 name: "内存",
 status: memoryStatus,
 value: `${memoryInfo.usage_percent.toFixed(1)}%`,
 details: `${(memoryInfo.used / (1024 * 1024 * 1024)).toFixed(1)}/${(memoryInfo.total / (1024 * 1024 * 1024)).toFixed(1)} GB`,
 icon: <MemoryStick className="h-4 w-4" />
 })

 // 3. 磁盘检查
 const totalDiskUsed = diskInfo.disks.reduce((sum, disk) => sum + disk.used, 0)
 const totalDiskSize = diskInfo.disks.reduce((sum, disk) => sum + disk.total, 0)
 const diskUsagePercent = totalDiskSize > 0 ? (totalDiskUsed / totalDiskSize) * 100 : 0
 const diskStatus =
 diskUsagePercent < 70 ? "healthy" :
 diskUsagePercent < 90 ? "warning" : "unhealthy"
 checks.push({
 name: "磁盘",
 status: diskStatus,
 value: `${diskUsagePercent.toFixed(1)}%`,
 details: `${(totalDiskUsed / (1024 * 1024 * 1024)).toFixed(1)}/${(totalDiskSize / (1024 * 1024 * 1024)).toFixed(1)} GB`,
 icon: <HardDrive className="h-4 w-4" />
 })

 // 4. Swap检查
 const swapStatus =
 memoryInfo.swap_usage_percent < 50 ? "healthy" :
 memoryInfo.swap_usage_percent < 80 ? "warning" : "unhealthy"
 checks.push({
 name: "Swap",
 status: swapStatus,
 value: `${memoryInfo.swap_usage_percent.toFixed(1)}%`,
 details: `${(memoryInfo.swap_used / (1024 * 1024 * 1024)).toFixed(1)}/${(memoryInfo.swap_total / (1024 * 1024 * 1024)).toFixed(1)} GB`,
 icon: <Database className="h-4 w-4" />
 })

 // 5. 网络检查（检查是否有网络接口）
 const hasActiveNetwork = networkInfo.interfaces.some(
 iface => iface.bytes_sent > 0 || iface.bytes_recv > 0
 )
 checks.push({
 name: "网络",
 status: hasActiveNetwork ? "healthy" : "warning",
 value: hasActiveNetwork ? "活跃" : "未检测到流量",
 details: `${networkInfo.interfaces.length} 个接口`,
 icon: <Wifi className="h-4 w-4" />
 })

 // 6. 系统负载检查
 const loadAvg1 = cpuInfo.load_average[0]
 const loadPerCore = loadAvg1 / cpuInfo.cores
 const loadStatus =
 loadPerCore < 0.7 ? "healthy" :
 loadPerCore < 1.0 ? "warning" : "unhealthy"
 checks.push({
 name: "系统负载",
 status: loadStatus,
 value: loadAvg1.toFixed(2),
 details: `1分钟平均`,
 icon: <Activity className="h-4 w-4" />
 })

 // 计算总体统计
 const healthyCount = checks.filter(c => c.status === "healthy").length
 const warningCount = checks.filter(c => c.status === "warning").length
 const unhealthyCount = checks.filter(c => c.status === "unhealthy").length

 // 确定总体状态
 let overallStatus: "healthy" | "warning" | "unhealthy" = "healthy"
 if (unhealthyCount > 0) {
 overallStatus = "unhealthy"
 } else if (warningCount > 0) {
 overallStatus = "warning"
 }

 // 格式化运行时间
 const formatUptime = (seconds: number): string => {
 const days = Math.floor(seconds / 86400)
 const hours = Math.floor((seconds % 86400) / 3600)
 const minutes = Math.floor((seconds % 3600) / 60)
 return `${days}天 ${hours}小时 ${minutes}分钟`
 }

 return {
 id: server.id,
 server: server.name,
 ip: server.host,
 status: overallStatus,
 checks,
 overall: {
 total: checks.length,
 healthy: healthyCount,
 warning: warningCount,
 unhealthy: unhealthyCount,
 },
 lastCheck: new Date().toLocaleString("zh-CN"),
 uptime: formatUptime(systemInfo.uptime),
 }
 } catch (error: any) {
 console.error(`加载服务器 ${server.name} 健康检查数据失败:`, error)
 return {
 id: server.id,
 server: server.name,
 ip: server.host,
 status: "error" as const,
 checks: [],
 overall: { total: 0, healthy: 0, warning: 0, unhealthy: 0 },
 lastCheck: new Date().toLocaleString("zh-CN"),
 }
 }
 })

 const healthChecksData = await Promise.all(healthChecksPromises)
 setHealthChecks(healthChecksData)
 } catch (error: any) {
 console.error("加载健康检查数据失败:", error)
 if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
 toast.error("登录已过期，请重新登录")
 router.push("/login")
 } else {
 toast.error(`加载健康检查数据失败: ${error.message}`)
 }
 } finally {
 setLoading(false)
 setRefreshing(false)
 }
 }

 // 刷新数据
 const handleRefresh = async () => {
 setRefreshing(true)
 await loadData()
 }

 // 初始加载
 useEffect(() => {
 loadData()
 }, [])

 // 计算总体统计
 const totalServers = healthChecks.length
 const healthyServers = healthChecks.filter(h => h.status === "healthy").length
 const warningServers = healthChecks.filter(h => h.status === "warning").length
 const unhealthyServers = healthChecks.filter(h => h.status === "unhealthy").length
 const offlineServers = healthChecks.filter(h => h.status === "offline").length
 const errorServers = healthChecks.filter(h => h.status === "error").length

 const totalChecks = healthChecks.reduce((sum, h) => sum + h.overall.total, 0)
 const healthyChecks = healthChecks.reduce((sum, h) => sum + h.overall.healthy, 0)
 const warningChecks = healthChecks.reduce((sum, h) => sum + h.overall.warning, 0)
 const unhealthyChecks = healthChecks.reduce((sum, h) => sum + h.overall.unhealthy, 0)

 // 计算平均健康率
 const avgHealthRate = totalChecks > 0 ? ((healthyChecks / totalChecks) * 100).toFixed(1) : "0"

 // 获取状态图标
 const getStatusIcon = (status: string) => {
 switch (status) {
 case "healthy":
 return <CheckCircle className="h-5 w-5 text-green-600" />
 case "warning":
 return <AlertCircle className="h-5 w-5 text-yellow-600" />
 case "unhealthy":
 return <XCircle className="h-5 w-5 text-red-600" />
 case "offline":
 return <Server className="h-5 w-5 text-gray-400" />
 case "error":
 return <XCircle className="h-5 w-5 text-red-400" />
 default:
 return <Activity className="h-5 w-5 text-gray-400" />
 }
 }

 // 获取状态Badge
 const getStatusBadge = (status: string) => {
 switch (status) {
 case "healthy":
 return <Badge className="bg-green-100 text-green-800">健康</Badge>
 case "warning":
 return <Badge className="bg-yellow-100 text-yellow-800">警告</Badge>
 case "unhealthy":
 return <Badge className="bg-red-100 text-red-800">异常</Badge>
 case "offline":
 return <Badge variant="secondary">离线</Badge>
 case "error":
 return <Badge className="bg-red-100 text-red-800">错误</Badge>
 default:
 return <Badge variant="secondary">未知</Badge>
 }
 }

 return (
 <>
      <PageHeader title="健康检查">
 <Button
 variant="outline"
 size="sm"
 onClick={handleRefresh}
 disabled={refreshing}
 >
 <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
 刷新
 </Button>
 </PageHeader>

 {loading ? (
 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 {/* 统计卡片骨架屏 */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
 <SkeletonCard showHeader={false} lines={2} />
 <SkeletonCard showHeader={false} lines={2} />
 <SkeletonCard showHeader={false} lines={2} />
 <SkeletonCard showHeader={false} lines={2} />
 </div>
 {/* 服务器卡片网格骨架屏 */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 <SkeletonCard showHeader showIcon lines={4} />
 <SkeletonCard showHeader showIcon lines={4} />
 <SkeletonCard showHeader showIcon lines={4} />
 <SkeletonCard showHeader showIcon lines={4} />
 <SkeletonCard showHeader showIcon lines={4} />
 <SkeletonCard showHeader showIcon lines={4} />
 </div>
 </div>
 ) : (
 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 {/* 统计卡片 */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">服务器总数</CardTitle>
 <Server className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{totalServers}</div>
 <p className="text-xs text-muted-foreground">
 {healthyServers} 健康 / {warningServers} 警告 / {unhealthyServers + offlineServers + errorServers} 异常
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">健康检查项</CardTitle>
 <Activity className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{totalChecks}</div>
 <p className="text-xs text-muted-foreground">
 {healthyChecks} 正常 / {warningChecks} 警告 / {unhealthyChecks} 异常
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">平均健康率</CardTitle>
 <CheckCircle className="h-4 w-4 text-green-600" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">{avgHealthRate}%</div>
 <p className="text-xs text-muted-foreground">所有检查项平均</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">需要关注</CardTitle>
 <AlertCircle className="h-4 w-4 text-yellow-600" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-yellow-600">
 {warningServers + unhealthyServers}
 </div>
 <p className="text-xs text-muted-foreground">服务器需要处理</p>
 </CardContent>
 </Card>
 </div>

 {/* 健康检查列表 */}
 <div className="grid gap-4">
 {healthChecks.length === 0 ? (
 <Card>
 <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
 <Server className="h-12 w-12 mb-4" />
 <p>暂无服务器</p>
 </CardContent>
 </Card>
 ) : (
 healthChecks.map((check) => (
 <Card key={check.id}>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Server className="h-5 w-5 text-muted-foreground" />
 <div>
 <CardTitle className="text-lg">{check.server}</CardTitle>
 <div className="flex items-center gap-2 mt-1">
 <p className="text-sm text-muted-foreground">{check.ip}</p>
 {check.uptime && (
 <span className="text-xs text-muted-foreground">
 • 运行时间: {check.uptime}
 </span>
 )}
 </div>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {getStatusBadge(check.status)}
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {check.status === "offline" ? (
 <div className="flex items-center justify-center py-8 text-muted-foreground">
 <Server className="h-8 w-8 mr-2" />
 <p>服务器离线</p>
 </div>
 ) : check.status === "error" ? (
 <div className="flex items-center justify-center py-8 text-destructive">
 <XCircle className="h-8 w-8 mr-2" />
 <p>健康检查失败</p>
 </div>
 ) : (
 <>
 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
 {check.checks.map((item, idx) => (
 <div
 key={idx}
 className={`flex items-center justify-between p-3 border rounded-lg ${
 item.status === "healthy"
 ? "border-green-200 bg-green-50"
 : item.status === "warning"
 ? "border-yellow-200 bg-yellow-50"
 : "border-red-200 bg-red-50"
 }`}
 >
 <div className="flex items-center gap-3">
 {getStatusIcon(item.status)}
 <div>
 <div className="font-medium">{item.name}</div>
 {item.details && (
 <div className="text-xs text-muted-foreground">
 {item.details}
 </div>
 )}
 </div>
 </div>
 <div className="text-right">
 <div className="font-mono text-sm font-bold">{item.value}</div>
 <Badge variant="outline" className="text-xs mt-1">
 {item.status === "healthy"
 ? "正常"
 : item.status === "warning"
 ? "警告"
 : "异常"}
 </Badge>
 </div>
 </div>
 ))}
 </div>
 <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
 <span>
 检查项: {check.overall.healthy}/{check.overall.total} 正常
 </span>
 <span>最后检查: {check.lastCheck}</span>
 </div>
 </>
 )}
 </CardContent>
 </Card>
 ))
 )}
 </div>
 </div>
 )}
 </>
 )
}
