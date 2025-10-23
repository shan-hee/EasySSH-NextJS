"use client"

import { useState } from "react"
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

// 模拟服务器资源数据
const mockServerResources = [
  {
    id: 1,
    name: "Web Server 01",
    host: "192.168.1.100",
    status: "online",
    cpu: { usage: 45, cores: 4, temperature: 62 },
    memory: { used: 6.2, total: 16, usage: 39 },
    disk: { used: 120, total: 500, usage: 24 },
    network: { rx: 1.2, tx: 0.8, unit: "MB/s" },
    uptime: "15天 6小时",
    lastUpdate: "30秒前"
  },
  {
    id: 2,
    name: "Database Server",
    host: "192.168.1.101",
    status: "online",
    cpu: { usage: 78, cores: 8, temperature: 71 },
    memory: { used: 28.5, total: 32, usage: 89 },
    disk: { used: 180, total: 200, usage: 90 },
    network: { rx: 2.5, tx: 1.8, unit: "MB/s" },
    uptime: "30天 12小时",
    lastUpdate: "45秒前"
  },
  {
    id: 3,
    name: "Dev Server",
    host: "192.168.1.102",
    status: "offline",
    cpu: { usage: 0, cores: 2, temperature: 0 },
    memory: { used: 0, total: 8, usage: 0 },
    disk: { used: 25, total: 100, usage: 25 },
    network: { rx: 0, tx: 0, unit: "MB/s" },
    uptime: "0天 0小时",
    lastUpdate: "5分钟前"
  },
  {
    id: 4,
    name: "Load Balancer",
    host: "192.168.1.103",
    status: "warning",
    cpu: { usage: 92, cores: 4, temperature: 85 },
    memory: { used: 1.8, total: 4, usage: 45 },
    disk: { used: 35, total: 80, usage: 44 },
    network: { rx: 5.2, tx: 3.8, unit: "MB/s" },
    uptime: "5天 8小时",
    lastUpdate: "1分钟前"
  }
]

export default function MonitoringResourcesPage() {
  const [servers, setServers] = useState(mockServerResources)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // 模拟刷新数据
    setTimeout(() => {
      setServers(prev => prev.map(server => ({
        ...server,
        lastUpdate: "刚刚"
      })))
      setIsRefreshing(false)
    }, 1000)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "text-green-600"
      case "warning": return "text-yellow-600"
      case "offline": return "text-red-600"
      default: return "text-gray-600"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online": return <Badge className="bg-green-100 text-green-800">在线</Badge>
      case "warning": return <Badge className="bg-yellow-100 text-yellow-800">警告</Badge>
      case "offline": return <Badge className="bg-red-100 text-red-800">离线</Badge>
      default: return <Badge variant="secondary">未知</Badge>
    }
  }

  const getUsageColor = (usage: number) => {
    if (usage >= 90) return "bg-red-500"
    if (usage >= 70) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <>
      <PageHeader
        title="资源监控"
        breadcrumbs={[
          { title: "监控与审计", href: "#" },
          { title: "资源监控" }
        ]}
      >
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
                      {server.cpu.usage}% ({server.cpu.cores} 核心, {server.cpu.temperature}°C)
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

