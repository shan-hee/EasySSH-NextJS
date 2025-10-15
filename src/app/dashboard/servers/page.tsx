"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ServerList } from "@/components/servers/server-card"
import { ServerFilters } from "@/components/servers/server-filters"
import { AddServerDialog } from "@/components/servers/add-server-dialog"
import type { ServerFormData } from "@/components/servers/add-server-dialog"
import {
  Search,
  Plus,
  Server
} from "lucide-react"
import { useRouter } from "next/navigation"

// 模拟数据
const servers = [
  {
    id: 1,
    name: "Web Server 01",
    host: "192.168.1.100",
    port: 22,
    username: "root",
    status: "online" as const,
    os: "Ubuntu 22.04",
    cpu: "2 cores",
    memory: "4GB",
    disk: "80GB",
    lastConnected: "2024-01-15 14:30",
    uptime: "15天 6小时",
    tags: ["生产环境", "Web服务器"]
  },
  {
    id: 2,
    name: "Database Server",
    host: "192.168.1.101",
    port: 22,
    username: "admin",
    status: "online" as const,
    os: "CentOS 8",
    cpu: "4 cores",
    memory: "8GB",
    disk: "200GB",
    lastConnected: "2024-01-15 13:45",
    uptime: "30天 12小时",
    tags: ["生产环境", "数据库"]
  },
  {
    id: 3,
    name: "Dev Server",
    host: "192.168.1.102",
    port: 2222,
    username: "developer",
    status: "offline" as const,
    os: "Ubuntu 20.04",
    cpu: "2 cores",
    memory: "4GB",
    disk: "50GB",
    lastConnected: "2024-01-14 18:20",
    uptime: "0天 0小时",
    tags: ["开发环境", "测试"]
  },
  {
    id: 4,
    name: "Load Balancer",
    host: "192.168.1.103",
    port: 22,
    username: "root",
    status: "warning" as const,
    os: "RHEL 8",
    cpu: "2 cores",
    memory: "2GB",
    disk: "40GB",
    lastConnected: "2024-01-15 12:00",
    uptime: "5天 8小时",
    tags: ["生产环境", "负载均衡"]
  }
]

export default function ServersPage() {
  const router = useRouter()
  const [filteredServers, setFilteredServers] = useState(servers)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const handleConnect = (serverId: number) => {
    console.log("连接服务器:", serverId)
    // 这里应该处理连接逻辑
  }

  const handleEdit = (serverId: number) => {
    console.log("编辑服务器:", serverId)
    // 这里应该跳转到编辑页面
  }

  const handleDelete = (serverId: number) => {
    console.log("删除服务器:", serverId)
    // 这里应该处理删除逻辑
  }

  const handleViewDetails = (serverId: number) => {
    console.log("查看详情:", serverId)
    // 使用客户端路由避免整页刷新
    router.push(`/dashboard/servers/${serverId}`)
  }

  const handleAddServer = (data: ServerFormData) => {
    console.log("添加服务器:", data)
    // 这里应该处理添加服务器逻辑
  }

  const handleFiltersChange = (filters: {
    search: string;
    status: string;
    tag: string;
    os: string;
    sortBy: string;
    sortOrder: string;
  }) => {
    let filtered = [...servers]

    // 搜索过滤
    if (filters.search) {
      filtered = filtered.filter(server =>
        server.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        server.host.toLowerCase().includes(filters.search.toLowerCase())
      )
    }

    // 状态过滤
    if (filters.status !== 'all') {
      filtered = filtered.filter(server => server.status === filters.status)
    }

    // 标签过滤
    if (filters.tag !== 'all') {
      filtered = filtered.filter(server => server.tags.includes(filters.tag))
    }

    // 操作系统过滤
    if (filters.os !== 'all') {
      filtered = filtered.filter(server => server.os === filters.os)
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue = a[filters.sortBy as keyof typeof a]
      let bValue = b[filters.sortBy as keyof typeof b]

      if (typeof aValue === 'string') aValue = aValue.toLowerCase()
      if (typeof bValue === 'string') bValue = bValue.toLowerCase()

      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    setFilteredServers(filtered)
  }

  return (
    <>
      <PageHeader title="服务器列表" />

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* 操作栏 */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索服务器..."
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  全部 ({servers.length})
                </Button>
                <Button variant="outline" size="sm">
                  在线 ({servers.filter(s => s.status === 'online').length})
                </Button>
                <Button variant="outline" size="sm">
                  离线 ({servers.filter(s => s.status === 'offline').length})
                </Button>
                <Button variant="outline" size="sm">
                  警告 ({servers.filter(s => s.status === 'warning').length})
                </Button>
              </div>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              添加服务器
            </Button>
          </div>

          {/* 筛选器 */}
          <ServerFilters
            servers={servers}
            onFiltersChange={handleFiltersChange}
          />

          {/* 服务器列表 */}
          <ServerList
            servers={filteredServers}
            onConnect={handleConnect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewDetails={handleViewDetails}
          />

          {/* 空状态 */}
          {filteredServers.length === 0 && servers.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Server className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">未找到匹配的服务器</h3>
              <p className="text-muted-foreground mb-4">请尝试调整筛选条件</p>
            </div>
          )}

          {/* 完全空状态 */}
          {servers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Server className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无服务器</h3>
              <p className="text-muted-foreground mb-4">开始添加您的第一台服务器</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加服务器
              </Button>
            </div>
          )}
        </div>

        {/* 添加服务器弹窗 */}
        <AddServerDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSubmit={handleAddServer}
        />
    </>
  )
}
