"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Cpu, MemoryStick, HardDrive, Network } from "lucide-react"

const mockMetrics = [
  { server: "Web Server 01", cpu: 45, memory: 68, disk: 55, network: 125 },
  { server: "Web Server 02", cpu: 52, memory: 71, disk: 48, network: 118 },
  { server: "Database Server", cpu: 78, memory: 85, disk: 72, network: 95 },
  { server: "App Server 01", cpu: 38, memory: 55, disk: 42, network: 88 },
]

export default function MonitoringPerfPage() {
  const [metrics] = useState(mockMetrics)

  const avgCpu = Math.round(metrics.reduce((acc, m) => acc + m.cpu, 0) / metrics.length)
  const avgMemory = Math.round(metrics.reduce((acc, m) => acc + m.memory, 0) / metrics.length)
  const avgDisk = Math.round(metrics.reduce((acc, m) => acc + m.disk, 0) / metrics.length)

  return (
    <>
      <PageHeader title="性能分析" breadcrumbs={[{ title: "监控", href: "#" }, { title: "性能分析" }]} />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均CPU</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgCpu}%</div>
              <p className="text-xs text-muted-foreground">所有服务器</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均内存</CardTitle>
              <MemoryStick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgMemory}%</div>
              <p className="text-xs text-muted-foreground">使用率</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均磁盘</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgDisk}%</div>
              <p className="text-xs text-muted-foreground">使用率</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">网络吞吐</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">106 MB/s</div>
              <p className="text-xs text-muted-foreground">平均流量</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>服务器性能</CardTitle>
            <CardDescription>实时性能指标</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.map((metric, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{metric.server}</span>
                    <span className="text-sm text-muted-foreground">实时数据</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">CPU</span>
                        <span className="font-mono">{metric.cpu}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={metric.cpu > 80 ? 'bg-red-500 h-full' : metric.cpu > 60 ? 'bg-yellow-500 h-full' : 'bg-green-500 h-full'}
                          style={{width: `${metric.cpu}%`}}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">内存</span>
                        <span className="font-mono">{metric.memory}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={metric.memory > 85 ? 'bg-red-500 h-full' : metric.memory > 70 ? 'bg-yellow-500 h-full' : 'bg-blue-500 h-full'}
                          style={{width: `${metric.memory}%`}}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">磁盘</span>
                        <span className="font-mono">{metric.disk}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={metric.disk > 80 ? 'bg-red-500 h-full' : metric.disk > 60 ? 'bg-yellow-500 h-full' : 'bg-purple-500 h-full'}
                          style={{width: `${metric.disk}%`}}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">网络</span>
                        <span className="font-mono">{metric.network} MB/s</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{width: `${Math.min(metric.network / 2, 100)}%`}} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
