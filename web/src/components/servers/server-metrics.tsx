"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Clock,
  TrendingUp,
  TrendingDown
} from "lucide-react"

interface SystemMetrics {
  cpu: {
    usage: number
    cores: number
    load: number[]
  }
  memory: {
    total: number
    used: number
    usage: number
  }
  disk: {
    total: number
    used: number
    usage: number
  }
  network: {
    rxBytes: string
    txBytes: string
  }
  uptime: string
}

interface ServerMetricsProps {
  metrics: SystemMetrics
  serverName: string
}

export function ServerMetrics({ metrics, serverName }: ServerMetricsProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    // 模拟刷新数据
    setTimeout(() => {
      setRefreshing(false)
    }, 1000)
  }

  const getUsageColor = (usage: number) => {
    if (usage < 60) return "bg-green-500"
    if (usage < 80) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getUsageStatus = (usage: number) => {
    if (usage < 60) return { text: "正常", color: "text-green-600" }
    if (usage < 80) return { text: "警告", color: "text-yellow-600" }
    return { text: "危险", color: "text-red-600" }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{serverName} - 系统监控</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {refreshing ? "刷新中..." : "刷新数据"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* CPU 使用率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU 使用率</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cpu.usage}%</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress
                value={metrics.cpu.usage}
                className="flex-1"
                indicatorClassName={getUsageColor(metrics.cpu.usage)}
              />
              <Badge variant="outline" className={getUsageStatus(metrics.cpu.usage).color}>
                {getUsageStatus(metrics.cpu.usage).text}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.cpu.cores} 核心 | 负载: {metrics.cpu.load.join(", ")}
            </p>
          </CardContent>
        </Card>

        {/* 内存使用率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">内存使用</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.memory.usage}%</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress
                value={metrics.memory.usage}
                className="flex-1"
                indicatorClassName={getUsageColor(metrics.memory.usage)}
              />
              <Badge variant="outline" className={getUsageStatus(metrics.memory.usage).color}>
                {getUsageStatus(metrics.memory.usage).text}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(metrics.memory.used / 1024).toFixed(1)}GB / {(metrics.memory.total / 1024).toFixed(1)}GB
            </p>
          </CardContent>
        </Card>

        {/* 磁盘使用率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">磁盘使用</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.disk.usage}%</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress
                value={metrics.disk.usage}
                className="flex-1"
                indicatorClassName={getUsageColor(metrics.disk.usage)}
              />
              <Badge variant="outline" className={getUsageStatus(metrics.disk.usage).color}>
                {getUsageStatus(metrics.disk.usage).text}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.disk.used}GB / {metrics.disk.total}GB
            </p>
          </CardContent>
        </Card>

        {/* 运行时间 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">运行时间</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{metrics.uptime}</div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">稳定运行</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              自上次重启以来
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 网络统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            网络统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">下载流量</span>
              </div>
              <span className="font-bold">{metrics.network.rxBytes}</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">上传流量</span>
              </div>
              <span className="font-bold">{metrics.network.txBytes}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 实时活动图表占位符 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            实时性能图表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">性能图表将在此处显示</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}