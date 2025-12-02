"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
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
  TrendingDown,
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
  const t = useTranslations("serverMetrics")

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
    if (usage < 60)
      return { text: t("statusNormal"), color: "text-green-600" }
    if (usage < 80)
      return { text: t("statusWarning"), color: "text-yellow-600" }
    return { text: t("statusDanger"), color: "text-red-600" }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {t("sectionTitle", { name: serverName })}
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {refreshing ? t("refreshing") : t("refresh")}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* CPU 使用率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("cardCpuTitle")}
            </CardTitle>
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
              {t("cpuCoresAndLoad", {
                cores: metrics.cpu.cores,
                load: metrics.cpu.load.join(", "),
              })}
            </p>
          </CardContent>
        </Card>

        {/* 内存使用率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("cardMemoryTitle")}
            </CardTitle>
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
            <CardTitle className="text-sm font-medium">
              {t("cardDiskTitle")}
            </CardTitle>
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
            <CardTitle className="text-sm font-medium">
              {t("cardUptimeTitle")}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{metrics.uptime}</div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">
                {t("uptimeStableLabel")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("uptimeSinceLastReboot")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 网络统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            {t("cardNetworkTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">
                  {t("networkDownloadLabel")}
                </span>
              </div>
              <span className="font-bold">{metrics.network.rxBytes}</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  {t("networkUploadLabel")}
                </span>
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
            {t("cardRealtimeTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">
              {t("realtimePlaceholder")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
