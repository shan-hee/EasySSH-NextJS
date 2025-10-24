"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ServerList } from "@/components/servers/server-card"
import { ServerFilters } from "@/components/servers/server-filters"
import { AddServerDialog } from "@/components/servers/add-server-dialog"
import type { ServerFormData } from "@/components/servers/add-server-dialog"
import { serversApi, type Server } from "@/lib/api"
import {
  Search,
  Plus,
  Server as ServerIcon,
  Loader2
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const STORAGE_KEY = 'servers-order'

export default function ServersPage() {
  const router = useRouter()
  const [servers, setServers] = useState<Server[]>([])
  const [filteredServers, setFilteredServers] = useState<Server[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)
  const [statistics, setStatistics] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    unknown: 0
  })

  // 加载服务器列表
  useEffect(() => {
    loadServers()
    loadStatistics()

    // 加载视图模式
    const savedViewMode = localStorage.getItem('servers-view-mode')
    if (savedViewMode === 'grid' || savedViewMode === 'list') {
      setViewMode(savedViewMode)
    }
  }, [])

  async function loadServers() {
    try {
      setLoading(true)
      const token = localStorage.getItem("easyssh_access_token")

      if (!token) {
        router.push("/login")
        return
      }

      const response = await serversApi.list(token, {
        page: 1,
        limit: 100  // 加载所有服务器
      })

      setServers(response.data)
      setFilteredServers(response.data)
    } catch (error: any) {
      console.error("Failed to load servers:", error)

      if (error?.status === 401) {
        toast.error("登录已过期，请重新登录")
        router.push("/login")
      } else {
        toast.error("加载服务器列表失败: " + (error?.message || "未知错误"))
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadStatistics() {
    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) return

      const stats = await serversApi.getStatistics(token)
      setStatistics(stats)
    } catch (error) {
      console.error("Failed to load statistics:", error)
    }
  }

  // 处理拖拽重新排序
  const handleReorder = (newOrder: Server[]) => {
    setServers(newOrder)
    setFilteredServers(newOrder)

    // 保存到 localStorage
    const orderIds = newOrder.map(s => s.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderIds))
  }

  // 处理视图模式切换
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('servers-view-mode', mode)
  }

  const handleConnect = (serverId: string) => {
    // 跳转到SSH终端页面
    router.push(`/dashboard/terminal?server=${serverId}`)
  }

  const handleEdit = (serverId: string) => {
    // 跳转到编辑页面
    router.push(`/dashboard/servers/${serverId}/edit`)
  }

  const handleDelete = async (serverId: string) => {
    if (!confirm("确定要删除这台服务器吗？此操作不可恢复。")) {
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        router.push("/login")
        return
      }

      await serversApi.delete(token, serverId)
      toast.success("服务器已删除")

      // 刷新列表
      await loadServers()
      await loadStatistics()
    } catch (error: any) {
      console.error("Failed to delete server:", error)
      toast.error("删除失败: " + (error?.message || "未知错误"))
    }
  }

  const handleViewDetails = (serverId: string) => {
    router.push(`/dashboard/servers/${serverId}`)
  }

  const handleAddServer = async (data: ServerFormData) => {
    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        router.push("/login")
        return
      }

      await serversApi.create(token, {
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        auth_method: data.authMethod as "password" | "key",
        password: data.password,
        private_key: data.privateKey,
        group: data.group,
        tags: data.tags,
        description: data.description,
      })

      toast.success("服务器添加成功")
      setIsAddDialogOpen(false)

      // 刷新列表
      await loadServers()
      await loadStatistics()
    } catch (error: any) {
      console.error("Failed to add server:", error)
      toast.error("添加失败: " + (error?.message || "未知错误"))
    }
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
      filtered = filtered.filter(server =>
        server.tags && server.tags.includes(filters.tag)
      )
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

  // 加载中状态
  if (loading) {
    return (
      <>
        <PageHeader title="服务器列表" />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">加载服务器列表...</p>
          </div>
        </div>
      </>
    )
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
                全部 ({statistics.total})
              </Button>
              <Button variant="outline" size="sm">
                在线 ({statistics.online})
              </Button>
              <Button variant="outline" size="sm">
                离线 ({statistics.offline})
              </Button>
              <Button variant="outline" size="sm">
                异常 ({statistics.error})
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
          onViewModeChange={handleViewModeChange}
          viewMode={viewMode}
        />

        {/* 服务器列表 */}
        <ServerList
          servers={filteredServers}
          onConnect={handleConnect}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onViewDetails={handleViewDetails}
          onReorder={handleReorder}
          viewMode={viewMode}
        />

        {/* 空状态 */}
        {filteredServers.length === 0 && servers.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <ServerIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">未找到匹配的服务器</h3>
            <p className="text-muted-foreground mb-4">请尝试调整筛选条件</p>
          </div>
        )}

        {/* 完全空状态 */}
        {servers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <ServerIcon className="h-12 w-12 text-muted-foreground mb-4" />
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
