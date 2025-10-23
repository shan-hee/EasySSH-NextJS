"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, AlertCircle, Server, Activity, Wifi, Database, HardDrive } from "lucide-react"

const mockHealthChecks = [
  { id: 1, server: "Web Server 01", ip: "192.168.1.100", services: [
    { name: "Nginx", status: "healthy", port: 80, responseTime: "12ms" },
    { name: "SSH", status: "healthy", port: 22, responseTime: "5ms" },
    { name: "MySQL", status: "warning", port: 3306, responseTime: "850ms" }
  ]},
  { id: 2, server: "Database Server", ip: "192.168.1.101", services: [
    { name: "MySQL", status: "healthy", port: 3306, responseTime: "35ms" },
    { name: "Redis", status: "healthy", port: 6379, responseTime: "2ms" }
  ]},
  { id: 3, server: "App Server 01", ip: "192.168.1.102", services: [
    { name: "Node.js", status: "unhealthy", port: 3000, responseTime: "超时" },
    { name: "SSH", status: "healthy", port: 22, responseTime: "8ms" }
  ]},
]

export default function MonitoringHealthPage() {
  const [checks] = useState(mockHealthChecks)
  
  const totalServices = checks.reduce((acc, check) => acc + check.services.length, 0)
  const healthyServices = checks.reduce((acc, check) => acc + check.services.filter(s => s.status === "healthy").length, 0)
  const unhealthyServices = checks.reduce((acc, check) => acc + check.services.filter(s => s.status === "unhealthy").length, 0)

  return (
    <>
      <PageHeader title="健康检查" breadcrumbs={[{ title: "监控", href: "#" }, { title: "健康检查" }]}>
        <Button variant="outline" size="sm"><Activity className="mr-2 h-4 w-4" />刷新</Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">服务器总数</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{checks.length}</div>
              <p className="text-xs text-muted-foreground">监控中</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">健康服务</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{healthyServices}</div>
              <p className="text-xs text-muted-foreground">可用率 {Math.round(healthyServices / totalServices * 100)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">异常服务</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{unhealthyServices}</div>
              <p className="text-xs text-muted-foreground">需要处理</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均响应</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">15ms</div>
              <p className="text-xs text-muted-foreground">健康服务平均</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {checks.map(check => (
            <Card key={check.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{check.server}</CardTitle>
                      <p className="text-sm text-muted-foreground">{check.ip}</p>
                    </div>
                  </div>
                  <Badge className={check.services.every(s => s.status === "healthy") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {check.services.every(s => s.status === "healthy") ? "健康" : "异常"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {check.services.map((service, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {service.status === "healthy" ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                         service.status === "warning" ? <AlertCircle className="h-5 w-5 text-yellow-600" /> :
                         <XCircle className="h-5 w-5 text-red-600" />}
                        <div>
                          <div className="font-medium">{service.name}</div>
                          <div className="text-xs text-muted-foreground">端口 {service.port}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{service.responseTime}</div>
                        <Badge variant="outline" className="text-xs">
                          {service.status === "healthy" ? "正常" :
                           service.status === "warning" ? "慢" : "离线"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
