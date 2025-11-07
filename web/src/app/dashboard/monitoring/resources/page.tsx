"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
 Cpu,
 MemoryStick,
 HardDrive,
 Wifi,
 Server,
 Activity,
 AlertTriangle,
 RefreshCw
} from "lucide-react"
import { serversApi, monitoringApi, type Server as ApiServer, type SystemInfo, type CPUInfo, type MemoryInfo, type DiskInfo, type NetworkInterface } from "@/lib/api"
import { toast } from "@/components/ui/sonner"
import { useRouter } from "next/navigation"
import { SkeletonCard } from "@/components/ui/loading"

// 服务器资源数据接口
interface ServerResource {
 id: string
 name: string
 host: string
 status: "online" | "warning" | "offline" | "error"
 cpu: { usage: number; cores: number; temperature?: number }
 memory: { used: number; total: number; usage: number }
 disk: { used: number; total: number; usage: number }
 network: { rx: number; tx: number; unit: string }
 uptime: string
 lastUpdate: string
}

function formatBytes(bytes: number): number {
 return Number((bytes / (1024 * 1024 * 1024)).toFixed(1))
}

function formatUptime(seconds: number): string {
 const days = Math.floor(seconds / 86400)
 const hours = Math.floor((seconds % 86400) / 3600)
 return `${days}天 ${hours}小时`
}

function formatNetworkSpeed(bytesPerSec: number): { value: number; unit: string } {
 const mbps = bytesPerSec / (1024 * 1024)
 if (mbps >= 1) {
 return { value: Number(mbps.toFixed(1)), unit: "MB/s" }
 }
 const kbps = bytesPerSec / 1024
 return { value: Number(kbps.toFixed(1)), unit: "KB/s" }
}

export default function MonitoringResourcesPage() {
 const router = useRouter()
 const [servers, setServers] = useState<ServerResource[]>([])
 const [loading, setLoading] = useState(true)
 const [isRefreshing, setIsRefreshing] = useState(false)
 const [token, setToken] = useState<string>("")

 useEffect(() => {
 loadData()
 }, [])

 async function loadData() {
 try {
 setLoading(true)
 const accessToken = localStorage.getItem("easyssh_access_token")

 if (!accessToken) {
 router.push("/login")
 return
 }

 setToken(accessToken)

 // 加载服务器列表
 const serverListResponse = await serversApi.list(accessToken, {
 page: 1,
 limit: 100,
 })

 // 防御性检查：处理apiFetch自动解包导致的数据结构不一致
 const serverList = Array.isArray(serverListResponse)
 ? serverListResponse
 : (serverListResponse?.data || [])

 // 并行加载所有在线服务器的监控数据
 const resourcesPromises = serverList.map(async (server: ApiServer) => {
 if (server.status !== "online") {
 // 离线服务器返回默认数据
 return {
 id: server.id,
 name: server.name,
 host: server.host,
 status: "offline" as const,
 cpu: { usage: 0, cores: 0 },
 memory: { used: 0, total: 0, usage: 0 },
 disk: { used: 0, total: 0, usage: 0 },
 network: { rx: 0, tx: 0, unit: "MB/s" },
 uptime: "0天 0小时",
 lastUpdate: new Date().toLocaleTimeString("zh-CN"),
 }
 }

 try {
 // 并行获取所有监控数据
 const [systemInfo, cpuInfo, memoryInfo, diskInfo, networkInfo] = await Promise.all([
 monitoringApi.getSystemInfo(accessToken, server.id),
 monitoringApi.getCPUInfo(accessToken, server.id),
 monitoringApi.getMemoryInfo(accessToken, server.id),
 monitoringApi.getDiskInfo(accessToken, server.id),
 monitoringApi.getNetworkInfo(accessToken, server.id),
 ])

 // 计算总磁盘使用情况
 const totalDiskUsed = diskInfo.reduce((sum, disk) => sum + disk.used, 0)
 const totalDiskSize = diskInfo.reduce((sum, disk) => sum + disk.total, 0)
 const diskUsagePercent = totalDiskSize > 0 ? Math.round((totalDiskUsed / totalDiskSize) * 100) : 0

 // 计算网络速度（假设取第一个网卡，或者所有网卡的总和）
 const rxSpeed = networkInfo.reduce((sum, iface) => sum + (iface.bytes_recv || 0), 0)
 const txSpeed = networkInfo.reduce((sum, iface) => sum + (iface.bytes_sent || 0), 0)
 const rxFormatted = formatNetworkSpeed(rxSpeed / 60) // 假设是每分钟的数据，除以60得到每秒
 const txFormatted = formatNetworkSpeed(txSpeed / 60)

 // 判断状态
 let status: "online" | "warning" | "offline" | "error" = "online"
 if (cpuInfo.usage_percent >= 90 || memoryInfo.usage_percent >= 90 || diskUsagePercent >= 90) {
 status = "warning"
 }

 return {
 id: server.id,
 name: server.name,
 host: server.host,
 status,
 cpu: {
 usage: Math.round(cpuInfo.usage_percent),
 cores: cpuInfo.cores,
 temperature: undefined, // 后端API暂未提供温度数据
 },
 memory: {
 used: formatBytes(memoryInfo.used),
 total: formatBytes(memoryInfo.total),
 usage: Math.round(memoryInfo.usage_percent),
 },
 disk: {
 used: formatBytes(totalDiskUsed),
 total: formatBytes(totalDiskSize),
 usage: diskUsagePercent,
 },
 network: {
 rx: rxFormatted.value,
 tx: txFormatted.value,
 unit: rxFormatted.unit,
 },
 uptime: formatUptime(systemInfo.uptime),
 lastUpdate: new Date().toLocaleTimeString("zh-CN"),
 }
 } catch (error) {
 console.error(`Failed to load monitoring data for ${server.name}:`, error)
 // 监控数据加载失败，返回错误状态
 return {
 id: server.id,
 name: server.name,
 host: server.host,
 status: "error" as const,
 cpu: { usage: 0, cores: 0 },
 memory: { used: 0, total: 0, usage: 0 },
 disk: { used: 0, total: 0, usage: 0 },
 network: { rx: 0, tx: 0, unit: "MB/s" },
 uptime: "未知",
 lastUpdate: new Date().toLocaleTimeString("zh-CN"),
 }
 }
 })

 const resourcesData = await Promise.all(resourcesPromises)
 setServers(resourcesData)
 } catch (error: any) {
 console.error("Failed to load monitoring data:", error)

 if (error?.status === 401) {
 toast.error("登录已过期，请重新登录")
 router.push("/login")
 } else {
 toast.error("加载监控数据失败: " + (error?.message || "未知错误"))
 }
 } finally {
 setLoading(false)
 }
 }

 const handleRefresh = async () => {
 setIsRefreshing(true)
 await loadData()
 setIsRefreshing(false)
 toast.success("数据已刷新")
 }

 const getStatusColor = (status: string) => {
 switch (status) {
 case "online": return "text-green-600"
 case "warning": return "text-yellow-600"
 case "offline": return "text-red-600"
 case "error": return "text-orange-600"
 default: return "text-gray-600"
 }
 }

 const getStatusBadge = (status: string) => {
 switch (status) {
 case "online": return <Badge className="bg-green-100 text-green-800">在线</Badge>
 case "warning": return <Badge className="bg-yellow-100 text-yellow-800">警告</Badge>
 case "offline": return <Badge className="bg-red-100 text-red-800">离线</Badge>
 case "error": return <Badge className="bg-orange-100 text-orange-800">错误</Badge>
 default: return <Badge variant="secondary">未知</Badge>
 }
 }

 const getUsageColor = (usage: number) => {
 if (usage >= 90) return "bg-red-500"
 if (usage >= 70) return "bg-yellow-500"
 return "bg-green-500"
 }

 // 加载状态 - 使用图表卡片骨架屏
 if (loading) {
 return (
 <>
 <PageHeader title="资源监控" />
 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 {/* 统计卡片骨架屏 */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
 <SkeletonCard showHeader={false} lines={2} />
 <SkeletonCard showHeader={false} lines={2} />
 <SkeletonCard showHeader={false} lines={2} />
 <SkeletonCard showHeader={false} lines={2} />
 </div>
 {/* 服务器资源卡片网格骨架屏 */}
 <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
 <SkeletonCard showHeader showIcon lines={6} />
 <SkeletonCard showHeader showIcon lines={6} />
 <SkeletonCard showHeader showIcon lines={6} />
 </div>
 </div>
 </>
 )
 }

 return (
 <>
 <PageHeader title="资源监控">
 <Button
 variant="outline"
 size="sm"
 onClick={handleRefresh}
 disabled={isRefreshing}
 >
 <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
 刷新数据
 </Button>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 {/* 概览统计 */}
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">在线服务器</CardTitle>
 <Server className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">
 {servers.filter(s => s.status === "online").length}
 </div>
 <p className="text-xs text-muted-foreground">
 共 {servers.length} 台服务器
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">平均CPU使用率</CardTitle>
 <Cpu className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">
 {Math.round(servers.reduce((acc, s) => acc + s.cpu.usage, 0) / servers.length)}%
 </div>
 <p className="text-xs text-muted-foreground">
 过去1小时平均值
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">平均内存使用率</CardTitle>
 <MemoryStick className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">
 {Math.round(servers.reduce((acc, s) => acc + s.memory.usage, 0) / servers.length)}%
 </div>
 <p className="text-xs text-muted-foreground">
 过去1小时平均值
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">告警数量</CardTitle>
 <AlertTriangle className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-yellow-600">
 {servers.filter(s => s.status === "warning").length}
 </div>
 <p className="text-xs text-muted-foreground">
 需要关注的服务器
 </p>
 </CardContent>
 </Card>
 </div>

 {/* 服务器详细监控 */}
 <div className="grid gap-4 lg:grid-cols-2">
 {servers.map(server => (
 <Card key={server.id} className="p-0">
 <CardHeader className="pb-4">
 <div className="flex items-start justify-between">
 <div>
 <CardTitle className="text-lg">{server.name}</CardTitle>
 <CardDescription>{server.host}</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 {getStatusBadge(server.status)}
 <Activity className={`h-4 w-4 ${getStatusColor(server.status)}`} />
 </div>
 </div>
 </CardHeader>

 <CardContent className="space-y-4">
 {/* CPU */}
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <Cpu className="h-4 w-4" />
 <span>CPU</span>
 </div>
 <span className="font-mono">
 {server.cpu.usage}% ({server.cpu.cores} 核心{server.cpu.temperature ? `, ${server.cpu.temperature}°C` : ''})
 </span>
 </div>
 <Progress
 value={server.cpu.usage}
 className="h-2"
 indicatorClassName={getUsageColor(server.cpu.usage)}
 />
 </div>

 {/* 内存 */}
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <MemoryStick className="h-4 w-4" />
 <span>内存</span>
 </div>
 <span className="font-mono">
 {server.memory.used}GB / {server.memory.total}GB ({server.memory.usage}%)
 </span>
 </div>
 <Progress
 value={server.memory.usage}
 className="h-2"
 indicatorClassName={getUsageColor(server.memory.usage)}
 />
 </div>

 {/* 磁盘 */}
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <HardDrive className="h-4 w-4" />
 <span>磁盘</span>
 </div>
 <span className="font-mono">
 {server.disk.used}GB / {server.disk.total}GB ({server.disk.usage}%)
 </span>
 </div>
 <Progress
 value={server.disk.usage}
 className="h-2"
 indicatorClassName={getUsageColor(server.disk.usage)}
 />
 </div>

 {/* 网络 */}
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <Wifi className="h-4 w-4" />
 <span>网络</span>
 </div>
 <span className="font-mono">
 ↓ {server.network.rx} {server.network.unit} / ↑ {server.network.tx} {server.network.unit}
 </span>
 </div>
 </div>

 {/* 运行时间和最后更新 */}
 <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
 <span>运行时间: {server.uptime}</span>
 <span>更新于: {server.lastUpdate}</span>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 </>
 )
}

