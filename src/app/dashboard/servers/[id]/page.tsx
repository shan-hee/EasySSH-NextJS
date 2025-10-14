"use client"

import { useState } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  ArrowLeft,
  Terminal,
  Edit,
  Settings,
  Activity,
  HardDrive,
  Cpu,
  MemoryStick,
  Network,
  Clock,
  Users,
  FileText,
  Download,
  Upload,
  Shield,
  AlertTriangle
} from "lucide-react"
import Link from "next/link"

// 模拟数据
const serverData = {
  id: 1,
  name: "Web Server 01",
  host: "192.168.1.100",
  port: 22,
  username: "root",
  status: "online",
  os: "Ubuntu 22.04 LTS",
  kernel: "5.15.0-89-generic",
  uptime: "15天 6小时 42分钟",
  lastConnected: "2024-01-15 14:30:25",
  tags: ["生产环境", "Web服务器", "Nginx"],
  description: "主要的Web服务器，运行Nginx和PHP-FPM",

  // 系统信息
  system: {
    cpu: {
      model: "Intel(R) Xeon(R) CPU E5-2686 v4 @ 2.30GHz",
      cores: 2,
      usage: 45,
      load: [0.8, 1.2, 1.1]
    },
    memory: {
      total: 4096,
      used: 2048,
      free: 1536,
      cached: 512,
      usage: 50
    },
    disk: {
      total: 80,
      used: 32,
      free: 48,
      usage: 40
    },
    network: {
      interface: "eth0",
      rxBytes: "125.6 GB",
      txBytes: "89.3 GB",
      rxPackets: "892,451",
      txPackets: "756,223"
    }
  },

  // 连接历史
  connections: [
    { time: "2024-01-15 14:30", user: "admin", duration: "2小时 15分", ip: "192.168.1.50" },
    { time: "2024-01-15 10:15", user: "developer", duration: "45分钟", ip: "192.168.1.51" },
    { time: "2024-01-14 16:20", user: "admin", duration: "1小时 30分", ip: "192.168.1.50" },
    { time: "2024-01-14 09:00", user: "backup", duration: "10分钟", ip: "192.168.1.52" }
  ],

  // 进程信息
  processes: [
    { pid: 1234, name: "nginx", cpu: 15.2, memory: 45.6, status: "running" },
    { pid: 1235, name: "php-fpm", cpu: 8.4, memory: 128.3, status: "running" },
    { pid: 1236, name: "mysql", cpu: 22.1, memory: 512.8, status: "running" },
    { pid: 1237, name: "redis", cpu: 3.2, memory: 89.4, status: "running" },
    { pid: 1238, name: "fail2ban", cpu: 0.1, memory: 12.4, status: "running" }
  ],

  // 安全信息
  security: {
    lastSecurityScan: "2024-01-15 02:00",
    openPorts: [22, 80, 443, 3306],
    failedLogins: 3,
    activeUsers: 2,
    firewallStatus: "active",
    sshKeyAuth: true,
    rootLogin: false
  }
}

export default function ServerDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:duration-200 group-data-[ready=true]/sidebar-wrapper:ease-in-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">EasySSH 控制台</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard/servers">服务器列表</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{serverData.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* 服务器基本信息 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/servers">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{serverData.name}</h1>
                  <Badge
                    variant={serverData.status === 'online' ? 'default' : 'destructive'}
                    className={serverData.status === 'online' ? 'bg-green-500 hover:bg-green-600' : ''}
                  >
                    {serverData.status === 'online' ? '在线' : '离线'}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {serverData.host}:{serverData.port} | {serverData.username}@{serverData.os}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button>
                <Terminal className="mr-2 h-4 w-4" />
                连接终端
              </Button>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                编辑配置
              </Button>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                设置
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="system">系统信息</TabsTrigger>
              <TabsTrigger value="processes">进程管理</TabsTrigger>
              <TabsTrigger value="connections">连接历史</TabsTrigger>
              <TabsTrigger value="security">安全状态</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPU使用率</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{serverData.system.cpu.usage}%</div>
                    <p className="text-xs text-muted-foreground">
                      {serverData.system.cpu.cores} 核心
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">内存使用</CardTitle>
                    <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{serverData.system.memory.usage}%</div>
                    <p className="text-xs text-muted-foreground">
                      {serverData.system.memory.used}MB / {serverData.system.memory.total}MB
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">磁盘使用</CardTitle>
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{serverData.system.disk.usage}%</div>
                    <p className="text-xs text-muted-foreground">
                      {serverData.system.disk.used}GB / {serverData.system.disk.total}GB
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">运行时间</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{serverData.uptime}</div>
                    <p className="text-xs text-muted-foreground">
                      自启动以来
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>服务器信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">操作系统:</span>
                        <p className="font-medium">{serverData.os}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">内核版本:</span>
                        <p className="font-medium">{serverData.kernel}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">最后连接:</span>
                        <p className="font-medium">{serverData.lastConnected}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">网络接口:</span>
                        <p className="font-medium">{serverData.system.network.interface}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>网络统计</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">接收流量:</span>
                        <p className="font-medium">{serverData.system.network.rxBytes}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">发送流量:</span>
                        <p className="font-medium">{serverData.system.network.txBytes}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">接收包数:</span>
                        <p className="font-medium">{serverData.system.network.rxPackets}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">发送包数:</span>
                        <p className="font-medium">{serverData.system.network.txPackets}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>标签和描述</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {serverData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {serverData.description}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    系统性能
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>CPU 使用率</span>
                      <span>{serverData.system.cpu.usage}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${serverData.system.cpu.usage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>内存使用率</span>
                      <span>{serverData.system.memory.usage}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${serverData.system.memory.usage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>磁盘使用率</span>
                      <span>{serverData.system.disk.usage}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${serverData.system.disk.usage}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>详细信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h4 className="font-medium">CPU 信息</h4>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">型号:</span> {serverData.system.cpu.model}</p>
                        <p><span className="text-muted-foreground">核心数:</span> {serverData.system.cpu.cores}</p>
                        <p><span className="text-muted-foreground">负载平均:</span> {serverData.system.cpu.load.join(", ")}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">内存信息</h4>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">总计:</span> {serverData.system.memory.total}MB</p>
                        <p><span className="text-muted-foreground">已用:</span> {serverData.system.memory.used}MB</p>
                        <p><span className="text-muted-foreground">空闲:</span> {serverData.system.memory.free}MB</p>
                        <p><span className="text-muted-foreground">缓存:</span> {serverData.system.memory.cached}MB</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="processes" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>运行中的进程</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {serverData.processes.map((process) => (
                      <div key={process.pid} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{process.name}</p>
                            <p className="text-sm text-muted-foreground">PID: {process.pid}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-medium">{process.cpu}%</p>
                            <p className="text-muted-foreground">CPU</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">{process.memory}MB</p>
                            <p className="text-muted-foreground">内存</p>
                          </div>
                          <Badge variant={process.status === 'running' ? 'default' : 'secondary'}>
                            {process.status === 'running' ? '运行中' : '已停止'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="connections" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    连接历史
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {serverData.connections.map((conn, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{conn.user}</p>
                          <p className="text-sm text-muted-foreground">{conn.time}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{conn.duration}</p>
                          <p className="text-sm text-muted-foreground">{conn.ip}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      安全状态
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>防火墙状态</span>
                      <Badge variant={serverData.security.firewallStatus === 'active' ? 'default' : 'destructive'}>
                        {serverData.security.firewallStatus === 'active' ? '已启用' : '已禁用'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>SSH密钥认证</span>
                      <Badge variant={serverData.security.sshKeyAuth ? 'default' : 'secondary'}>
                        {serverData.security.sshKeyAuth ? '已启用' : '已禁用'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Root登录</span>
                      <Badge variant={serverData.security.rootLogin ? 'destructive' : 'default'}>
                        {serverData.security.rootLogin ? '允许' : '禁止'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      安全统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>登录失败次数</span>
                      <span className="font-medium text-destructive">{serverData.security.failedLogins}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>当前活跃用户</span>
                      <span className="font-medium">{serverData.security.activeUsers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>最后安全扫描</span>
                      <span className="font-medium text-sm">{serverData.security.lastSecurityScan}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>开放端口</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {serverData.security.openPorts.map((port) => (
                      <Badge key={port} variant="outline">
                        {port}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
    </>
  )
}
