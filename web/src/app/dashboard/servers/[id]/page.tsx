"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
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
  Shield,
  AlertTriangle,
  Loader2,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { serversApi, monitoringApi, sshApi, type Server } from "@/lib/api"
import type { SystemInfo, CPUInfo, MemoryInfo, DiskInfo, NetworkInterface, ProcessInfo } from "@/lib/api"
import { toast } from "sonner"

export default function ServerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // 服务器基本信息
  const [server, setServer] = useState<Server | null>(null)

  // 监控数据
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [cpuInfo, setCpuInfo] = useState<CPUInfo | null>(null)
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null)
  const [diskInfo, setDiskInfo] = useState<DiskInfo[]>([])
  const [networkInfo, setNetworkInfo] = useState<NetworkInterface[]>([])
  const [processes, setProcesses] = useState<ProcessInfo[]>([])

  useEffect(() => {
    loadServerData()
  }, [params.id])

  async function loadServerData() {
    try {
      setLoading(true)
      const token = localStorage.getItem("easyssh_access_token")

      if (!token) {
        router.push("/login")
        return
      }

      // 加载服务器基本信息
      const serverData = await serversApi.getById(token, params.id)
      setServer(serverData)

      // 只有在线的服务器才加载监控数据
      if (serverData.status === "online") {
        await loadMonitoringData(token)
      }
    } catch (error: any) {
      console.error("Failed to load server:", error)

      if (error?.status === 401) {
        toast.error("登录已过期，请重新登录")
        router.push("/login")
      } else if (error?.status === 404) {
        toast.error("服务器不存在")
        router.push("/dashboard/servers")
      } else {
        toast.error("加载失败: " + (error?.message || "未知错误"))
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadMonitoringData(token: string) {
    try {
      // 并行加载所有监控数据
      const [system, cpu, memory, disk, network, procs] = await Promise.allSettled([
        monitoringApi.getSystemInfo(token, params.id),
        monitoringApi.getCPUInfo(token, params.id),
        monitoringApi.getMemoryInfo(token, params.id),
        monitoringApi.getDiskInfo(token, params.id),
        monitoringApi.getNetworkInfo(token, params.id),
        monitoringApi.getTopProcesses(token, params.id, 10)
      ])

      if (system.status === "fulfilled") setSystemInfo(system.value)
      if (cpu.status === "fulfilled") setCpuInfo(cpu.value)
      if (memory.status === "fulfilled") setMemoryInfo(memory.value)
      if (disk.status === "fulfilled") setDiskInfo(disk.value)
      if (network.status === "fulfilled") setNetworkInfo(network.value)
      if (procs.status === "fulfilled") setProcesses(procs.value)
    } catch (error) {
      console.error("Failed to load monitoring data:", error)
    }
  }

  async function handleRefresh() {
    if (!server) return

    try {
      setRefreshing(true)
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) return

      await loadMonitoringData(token)
      toast.success("数据已刷新")
    } catch (error) {
      toast.error("刷新失败")
    } finally {
      setRefreshing(false)
    }
  }

  async function handleTestConnection() {
    if (!server) return

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) return

      toast.info("正在测试连接...")
      const result = await serversApi.testConnection(token, params.id)

      if (result.success) {
        toast.success(`连接成功！延迟: ${result.latency}ms`)
      } else {
        toast.error("连接失败: " + result.message)
      }
    } catch (error: any) {
      toast.error("测试失败: " + (error?.message || "未知错误"))
    }
  }

  function handleConnect() {
    router.push(`/dashboard/terminal?server=${params.id}`)
  }

  function handleEdit() {
    router.push(`/dashboard/servers/${params.id}/edit`)
  }

  // 格式化字节数
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // 格式化运行时间
  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}天 ${hours}小时 ${minutes}分钟`
  }

  // 加载中状态
  if (loading) {
    return (
      <>
        <PageHeader title="服务器详情" />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">加载服务器信息...</p>
          </div>
        </div>
      </>
    )
  }

  if (!server) {
    return (
      <>
        <PageHeader title="服务器详情" />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">服务器不存在</p>
            <Link href="/dashboard/servers">
              <Button>返回列表</Button>
            </Link>
          </div>
        </div>
      </>
    )
  }

  const isOnline = server.status === "online"

  return (
    <>
      <PageHeader
        title="服务器详情"
        breadcrumbs={[
          { title: "服务器列表", href: "/dashboard/servers" },
          { title: server.name },
        ]}
      />

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
                <h1 className="text-2xl font-bold">{server.name}</h1>
                <Badge
                  variant={isOnline ? 'default' : 'destructive'}
                  className={isOnline ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  {isOnline ? '在线' : server.status === 'offline' ? '离线' : '未知'}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {server.host}:{server.port} | {server.username}@{systemInfo?.os || '...'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isOnline && (
              <Button onClick={handleConnect}>
                <Terminal className="mr-2 h-4 w-4" />
                连接终端
              </Button>
            )}
            <Button variant="outline" onClick={handleTestConnection}>
              <Activity className="mr-2 h-4 w-4" />
              测试连接
            </Button>
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
            {isOnline && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>

        {/* 离线提示 */}
        {!isOnline && (
          <Card className="border-yellow-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                <p>服务器当前处于离线状态，监控数据不可用。</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="system" disabled={!isOnline}>系统信息</TabsTrigger>
            <TabsTrigger value="processes" disabled={!isOnline}>进程管理</TabsTrigger>
            <TabsTrigger value="network" disabled={!isOnline}>网络</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">CPU使用率</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cpuInfo ? `${cpuInfo.usage_percent.toFixed(1)}%` : '-'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cpuInfo?.cores || '-'} 核心
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">内存使用</CardTitle>
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {memoryInfo ? `${memoryInfo.usage_percent.toFixed(1)}%` : '-'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {memoryInfo ? `${formatBytes(memoryInfo.used)} / ${formatBytes(memoryInfo.total)}` : '-'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">磁盘使用</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {diskInfo[0] ? `${diskInfo[0].usage_percent.toFixed(1)}%` : '-'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {diskInfo[0] ? `${formatBytes(diskInfo[0].used)} / ${formatBytes(diskInfo[0].total)}` : '-'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">运行时间</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {systemInfo ? formatUptime(systemInfo.uptime) : '-'}
                  </div>
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
                      <p className="font-medium">{systemInfo?.os || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">内核版本:</span>
                      <p className="font-medium">{systemInfo?.kernel || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">主机名:</span>
                      <p className="font-medium">{systemInfo?.hostname || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">架构:</span>
                      <p className="font-medium">{systemInfo?.architecture || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">最后连接:</span>
                      <p className="font-medium">
                        {server.last_connected ? new Date(server.last_connected).toLocaleString('zh-CN') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPU型号:</span>
                      <p className="font-medium truncate" title={cpuInfo?.model}>
                        {cpuInfo?.model || '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>标签和描述</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {server.tags && server.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {server.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {server.description && (
                    <p className="text-sm text-muted-foreground">
                      {server.description}
                    </p>
                  )}
                  {server.group && (
                    <div>
                      <span className="text-muted-foreground text-sm">分组: </span>
                      <Badge>{server.group}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
                {cpuInfo && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>CPU 使用率</span>
                      <span>{cpuInfo.usage_percent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${cpuInfo.usage_percent}%` }}
                      ></div>
                    </div>
                    {cpuInfo.load_average && cpuInfo.load_average.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        负载平均: {cpuInfo.load_average.map(l => l.toFixed(2)).join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {memoryInfo && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>内存使用率</span>
                      <span>{memoryInfo.usage_percent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${memoryInfo.usage_percent}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      已用: {formatBytes(memoryInfo.used)} / 总计: {formatBytes(memoryInfo.total)}
                    </p>
                  </div>
                )}

                {diskInfo.map((disk, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>磁盘 ({disk.mount_point})</span>
                      <span>{disk.usage_percent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${disk.usage_percent}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(disk.used)} / {formatBytes(disk.total)} ({disk.filesystem})
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top 进程</CardTitle>
              </CardHeader>
              <CardContent>
                {processes.length > 0 ? (
                  <div className="space-y-2">
                    {processes.map((process) => (
                      <div key={process.pid} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{process.name}</p>
                            <p className="text-sm text-muted-foreground">
                              PID: {process.pid} | 用户: {process.username}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-medium">{process.cpu_percent.toFixed(1)}%</p>
                            <p className="text-muted-foreground">CPU</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">{formatBytes(process.memory_rss)}</p>
                            <p className="text-muted-foreground">内存</p>
                          </div>
                          <Badge variant={process.status === 'running' ? 'default' : 'secondary'}>
                            {process.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">暂无进程信息</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="network" className="space-y-6">
            <div className="grid gap-4">
              {networkInfo.map((iface, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="h-5 w-5" />
                      {iface.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">MAC地址:</span>
                        <p className="font-medium font-mono">{iface.mac_address}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IP地址:</span>
                        <p className="font-medium font-mono">{iface.addresses.join(", ")}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">接收:</span>
                        <p className="font-medium">{formatBytes(iface.bytes_recv)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">发送:</span>
                        <p className="font-medium">{formatBytes(iface.bytes_sent)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">接收包:</span>
                        <p className="font-medium">{iface.packets_recv.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">发送包:</span>
                        <p className="font-medium">{iface.packets_sent.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {networkInfo.length === 0 && (
                <p className="text-center text-muted-foreground py-4">暂无网络信息</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
