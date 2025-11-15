"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AddServerDialog } from "@/components/servers/add-server-dialog"
import { EditServerDialog } from "@/components/servers/edit-server-dialog"
import type { ServerFormData } from "@/components/servers/add-server-dialog"
import { serversApi, type Server, type AuthMethod } from "@/lib/api"
import {
 Search,
 Plus,
 Server as ServerIcon,
 Loader2,
 Terminal,
 Edit,
 Trash2,
 TestTube2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/error-utils"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AnimatedList } from "@/components/ui/animated-list"

// 可排序的服务器项组件
function SortableServerItem({
  server,
  testingServerId,
  onConnect,
  onTest,
  onEdit,
  onDelete,
}: {
  server: Server
  testingServerId: string | null
  onConnect: (id: string) => void
  onTest: (id: string, e: React.MouseEvent) => void
  onEdit: (server: Server) => void
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: server.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms ease', // 保留拖拽动画，缩短时长避免与 AnimatedList 冲突
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group flex items-center gap-3 p-4 rounded-lg border bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-zinc-900/40 dark:border-zinc-800/30 dark:hover:bg-zinc-800/60 dark:hover:border-zinc-700/40 cursor-grab active:cursor-grabbing"
    >
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          server.status === 'online'
            ? 'bg-green-500'
            : 'bg-zinc-400 dark:bg-zinc-600'
        }`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className={"text-sm font-medium transition-colors truncate text-zinc-900 dark:text-white"}>
            {server.name || server.host}
          </div>
          {/* 测试气泡按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"
            onClick={(e) => onTest(server.id, e)}
            disabled={testingServerId === server.id}
            title="测试连接"
          >
            {testingServerId === server.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <TestTube2 className="h-3 w-3" />
            )}
          </Button>
        </div>
        <div className={"text-xs font-mono truncate text-zinc-500 dark:text-zinc-600"}>
          {server.username}@{server.host}:{server.port}
        </div>
      </div>

      {server.group && (
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {server.group}
        </Badge>
      )}

      {server.tags && server.tags.length > 0 && (
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {server.tags[0]}
        </Badge>
      )}

      {/* 操作按钮组 */}
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => onConnect(server.id)}
          disabled={server.status !== 'online'}
          title="连接终端">
          <Terminal className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => onEdit(server)}
          title="编辑配置">
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
          onClick={() => onDelete(server.id)}
          title="删除服务器">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}


export default function ServersPage() {
 const router = useRouter()
 const [servers, setServers] = useState<Server[]>([])
 const [filteredServers, setFilteredServers] = useState<Server[]>([])
 const [searchTerm, setSearchTerm] = useState("")
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
 const [editingServer, setEditingServer] = useState<Server | null>(null)
 const [loading, setLoading] = useState(true)
 const [activeTab, setActiveTab] = useState<'all' | 'online' | 'offline'>('all')
 const [testingServerId, setTestingServerId] = useState<string | null>(null)
 const [isBatchTesting, setIsBatchTesting] = useState(false)
 const [draggedServer, setDraggedServer] = useState<Server | null>(null)
 const [isMounted, setIsMounted] = useState(false)
 const [statistics, setStatistics] = useState({
 total: 0,
 online: 0,
 offline: 0,
 error: 0,
 unknown: 0
 })

 // 配置拖拽传感器
 const sensors = useSensors(
   useSensor(PointerSensor, {
     activationConstraint: {
       distance: 8, // 移动8px后才激活拖拽，避免与点击事件冲突
     },
   })
 )

 // 客户端挂载检测
 useEffect(() => {
   setIsMounted(true)
 }, [])

 // 加载服务器列表
 useEffect(() => {
 loadServers()
 loadStatistics()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 // 根据搜索词和激活的标签过滤服务器
 useEffect(() => {
 let filtered = [...servers]

 // 按标签过滤
 if (activeTab === 'online') {
 filtered = filtered.filter(s => s.status === 'online')
 } else if (activeTab === 'offline') {
 filtered = filtered.filter(s => s.status === 'offline' || s.status === 'error')
 }

 // 按搜索词过滤
 if (searchTerm) {
 filtered = filtered.filter(server =>
 (server.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
 server.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
 server.username.toLowerCase().includes(searchTerm.toLowerCase())
 )
 }

 setFilteredServers(filtered)
 }, [servers, searchTerm, activeTab])

 async function loadServers() {
 try {
 setLoading(true)
 // 认证基于 HttpOnly Cookie，无需本地令牌

 const response = await serversApi.list({
 page: 1,
 limit: 100
 })

 const serverList = Array.isArray(response)
 ? response
 : (response?.data || [])

 setServers(serverList)
 setFilteredServers(serverList)
 } catch (error: unknown) {
 console.error("Failed to load servers:", error)
 toast.error(getErrorMessage(error, "加载服务器列表失败"))
 } finally {
 setLoading(false)
 }
 }

 async function loadStatistics() {
 try {
 // 认证基于 HttpOnly Cookie

 const stats = await serversApi.getStatistics()
 setStatistics(stats)
 } catch (error) {
 console.error("Failed to load statistics:", error)
 }
 }

 const handleConnect = (serverId: string) => {
 // 查找服务器以获取名称
 const server = servers.find(s => s.id === serverId)
 const serverName = server?.name || server?.host || ""
 router.push(`/dashboard/terminal?server=${serverId}&name=${encodeURIComponent(serverName)}`)
 }

 const handleEdit = (server: Server) => {
 setEditingServer(server)
 setIsEditDialogOpen(true)
 }

 const handleTestConnection = async (serverId: string, e: React.MouseEvent) => {
 e.stopPropagation()

 // 认证基于 HttpOnly Cookie

 setTestingServerId(serverId)
 toast.info("正在测试连接...")

 try {
 const result = await serversApi.testConnection(serverId)
 if (result.success) {
 toast.success(`连接测试成功！延迟: ${result.latency_ms}ms`)

 // 乐观更新：只更新当前服务器的状态，保持列表顺序不变
 setServers(prev => prev.map(s =>
 s.id === serverId ? { ...s, status: 'online' as const } : s
 ))

 // 只刷新统计信息
 await loadStatistics()
 } else {
 toast.error("连接测试失败: " + result.message)

 // 更新为离线状态
 setServers(prev => prev.map(s =>
 s.id === serverId ? { ...s, status: 'offline' as const } : s
 ))

 await loadStatistics()
 }
 } catch (error: unknown) {
 toast.error(getErrorMessage(error, "测试失败"))

 // 异常时标记为错误状态
 setServers(prev => prev.map(s =>
 s.id === serverId ? { ...s, status: 'error' as const } : s
 ))

 await loadStatistics()
 } finally {
 setTestingServerId(null)
 }
 }

 // 批量测试离线服务器
 const handleBatchTestOffline = async () => {
 // 认证基于 HttpOnly Cookie

 // 获取所有离线和错误状态的服务器
 const offlineServers = servers.filter(s => s.status === 'offline' || s.status === 'error')

 if (offlineServers.length === 0) {
 toast.info("没有离线服务器需要测试")
 return
 }

 setIsBatchTesting(true)
 toast.info(`开始测试 ${offlineServers.length} 台离线服务器...`)

 let successCount = 0
 let failCount = 0

 // 并发测试所有离线服务器
 const testPromises = offlineServers.map(async (server) => {
 try {
 const result = await serversApi.testConnection(server.id)

 // 更新服务器状态
 setServers(prev => prev.map(s =>
 s.id === server.id ? { ...s, status: result.success ? 'online' as const : 'offline' as const } : s
 ))

 if (result.success) {
 successCount++
 } else {
 failCount++
 }
 } catch {
 failCount++
 setServers(prev => prev.map(s =>
 s.id === server.id ? { ...s, status: 'error' as const } : s
 ))
 }
 })

 await Promise.all(testPromises)

 // 刷新统计信息
 await loadStatistics()

 setIsBatchTesting(false)

 // 显示测试结果
 if (successCount > 0 && failCount > 0) {
 toast.success(`测试完成：${successCount} 台恢复在线，${failCount} 台仍然离线`)
 } else if (successCount > 0) {
 toast.success(`测试完成：${successCount} 台服务器恢复在线！`)
 } else {
 toast.error(`测试完成：所有服务器仍然离线`)
 }
 }

 const handleDelete = async (serverId: string) => {
 if (!confirm("确定要删除这台服务器吗？此操作不可恢复。")) {
 return
 }

 try {
 // 认证基于 HttpOnly Cookie

 await serversApi.delete(serverId)
 toast.success("服务器已删除")

 // 乐观更新：直接从本地列表移除，避免整个页面刷新
 setServers(prev => prev.filter(s => s.id !== serverId))

 // 只刷新统计信息
 await loadStatistics()
 } catch (error: unknown) {
 console.error("Failed to delete server:", error)
 toast.error(getErrorMessage(error, "删除失败"))
 }
 }

 // 拖拽开始
 const handleDragStart = (event: { active: { id: string | number } }) => {
 const server = servers.find(s => s.id === String(event.active.id))
 setDraggedServer(server || null)
 }

 // 拖拽结束
 const handleDragEnd = async (event: DragEndEvent) => {
 const { active, over } = event
 setDraggedServer(null)

 if (!over || active.id === over.id) return

 const oldIndex = servers.findIndex(s => s.id === String(active.id))
 const newIndex = servers.findIndex(s => s.id === String(over.id))

 if (oldIndex !== -1 && newIndex !== -1) {
 const newOrder = arrayMove(servers, oldIndex, newIndex)

 // 乐观更新：立即更新 UI
 setServers(newOrder)

 // 调用后端 API 保存新顺序
 try {
 // 认证基于 HttpOnly Cookie

 const serverIds = newOrder.map(s => s.id)
 await serversApi.reorder(serverIds)
 toast.success("排序已保存")
 } catch (error: unknown) {
 console.error("Failed to save server order:", error)
 toast.error(getErrorMessage(error, "保存排序失败"))
 // 错误时重新加载服务器列表
 await loadServers()
 }
 }
 }

 const handleAddServer = async (data: ServerFormData) => {
 try {
 // 认证基于 HttpOnly Cookie

 const serverData: {
 name?: string
 host: string
 port: number
 username: string
 auth_method: AuthMethod
 password?: string
 private_key?: string
 group?: string
 tags?: string[]
 description?: string
 } = {
 name: data.name,
 host: data.host,
 port: parseInt(data.port) || 22,
 username: data.username,
 auth_method: data.authMethod === "privateKey" ? "key" : "password",
 password: data.password,
 private_key: data.privateKey,
 group: data.group,
 tags: data.tags,
 description: data.description,
 }

 const newServer = await serversApi.create(serverData)

 toast.success("服务器添加成功")
 setIsAddDialogOpen(false)

 // 乐观更新：直接添加到本地列表，避免整个页面刷新
 setServers(prev => [...prev, newServer])

 // 只刷新统计信息
 await loadStatistics()
 } catch (error: unknown) {
 console.error("Failed to add server:", error)
 toast.error(getErrorMessage(error, "添加服务器失败"))
 }
 }

 const handleEditServer = async (data: ServerFormData) => {
 try {
 // 认证基于 HttpOnly Cookie

 if (!editingServer) {
 toast.error("未找到要编辑的服务器")
 return
 }

 const updatedServer = await serversApi.update(editingServer.id, {
 name: data.name,
 host: data.host,
 port: parseInt(data.port) || 22,
 username: data.username,
 auth_method: data.authMethod === "privateKey" ? "key" : "password",
 password: data.password,
 private_key: data.privateKey,
 group: data.group,
 tags: data.tags,
 description: data.description,
 })

 toast.success("服务器更新成功")
 setIsEditDialogOpen(false)
 setEditingServer(null)

 // 乐观更新：只更新被修改的服务器，避免整个页面刷新
 setServers(prev => prev.map(s =>
 s.id === editingServer.id ? updatedServer : s
 ))

 // 只刷新统计信息（如果标签或分组改变）
 await loadStatistics()
 } catch (error: unknown) {
 console.error("Failed to update server:", error)
 toast.error(getErrorMessage(error, "更新服务器失败"))
 }
 }

 return (
 <>
 <PageHeader title="连接配置" />

 <div className={"h-full flex flex-col overflow-hidden relative transition-colors bg-white dark:bg-black"}>
 <div className={"absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent via-black/5 dark:via-white/5"} />

 <div className="flex-1 flex flex-col items-center px-8 py-8 overflow-y-auto">
 <div className="max-w-3xl w-full space-y-6">
 {/* 搜索栏和添加按钮 - 始终显示（有服务器时） */}
 {(loading || servers.length > 0) && (
 <div className="space-y-4">
 <div className="flex items-center justify-between gap-4">
 {/* 左侧：搜索框 */}
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 dark:text-zinc-600 h-4 w-4" />
 <Input
 placeholder="搜索服务器名称、地址或用户名..."
 className={"pl-10 bg-zinc-50 border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-800/30"}
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>

 {/* 右侧：添加按钮 */}
 <Button onClick={() => setIsAddDialogOpen(true)} className="shadow-sm flex-shrink-0">
 <Plus className="mr-2 h-4 w-4" />
 添加服务器
 </Button>
 </div>

 {/* 标签切换 - 始终显示 */}
 <div className="flex gap-2 items-center">
 <Button
 variant={activeTab === 'all' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setActiveTab('all')}
 className="h-8"
 >
 全部 ({statistics.total})
 </Button>
 <Button
 variant={activeTab === 'online' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setActiveTab('online')}
 className="h-8"
 >
 <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
 在线 ({statistics.online})
 </Button>
 <Button
 variant={activeTab === 'offline' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setActiveTab('offline')}
 className="h-8"
 >
 <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5" />
 离线 ({statistics.offline})
 </Button>

 {/* 一键测试离线服务器按钮 */}
 {statistics.offline > 0 && (
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
 onClick={handleBatchTestOffline}
 disabled={isBatchTesting}
 title="一键测试所有离线服务器"
 >
 {isBatchTesting ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <TestTube2 className="h-4 w-4" />
 )}
 </Button>
 )}
 </div>
 </div>
 )}

 {/* 加载状态 */}
 {loading && (
 <div className="space-y-4">
 <div className={"h-px bg-gradient-to-r from-transparent to-transparent via-zinc-300 dark:via-zinc-800"} />
 <div className="flex flex-col items-center justify-center py-12 gap-4">
 <Loader2 className="h-8 w-8 animate-spin text-zinc-400 dark:text-zinc-600" />
 <p className="text-sm text-zinc-500 dark:text-zinc-600">加载服务器列表...</p>
 </div>
 </div>
 )}

 {/* 服务器列表 */}
 {!loading && filteredServers.length > 0 && (
 <div className="space-y-4">
 <div className={"h-px bg-gradient-to-r from-transparent to-transparent via-zinc-300 dark:via-zinc-800"} />

 {isMounted ? (
 <DndContext
 sensors={sensors}
 collisionDetection={closestCenter}
 onDragStart={handleDragStart}
 onDragEnd={handleDragEnd}
 >
 <SortableContext
 items={filteredServers.map(s => s.id)}
 strategy={verticalListSortingStrategy}
 >
 <AnimatedList className="space-y-2">
 {filteredServers.map((server) => (
 <SortableServerItem
 key={server.id}
 server={server}
 testingServerId={testingServerId}
 onConnect={handleConnect}
 onTest={handleTestConnection}
 onEdit={handleEdit}
 onDelete={handleDelete}
 />
 ))}
 </AnimatedList>
 </SortableContext>

 <DragOverlay>
 {draggedServer ? (
 <div className="flex items-center gap-3 p-4 rounded-lg border bg-zinc-50 border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-800/30 shadow-lg opacity-80">
 <div
 className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
 draggedServer.status === 'online'
 ? 'bg-green-500'
 : 'bg-zinc-400 dark:bg-zinc-600'
 }`}
 />
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium text-zinc-900 dark:text-white">
 {draggedServer.name || draggedServer.host}
 </div>
 </div>
 </div>
 ) : null}
 </DragOverlay>
 </DndContext>
 ) : (
 // 服务端渲染时的静态列表
 <AnimatedList className="space-y-2">
 {filteredServers.map((server) => (
 <div
 key={server.id}
 className={"group flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-zinc-900/40 dark:border-zinc-800/30 dark:hover:bg-zinc-800/60 dark:hover:border-zinc-700/40"}
 >
 <div
 className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
 server.status === 'online'
 ? 'bg-green-500'
 : 'bg-zinc-400 dark:bg-zinc-600'
 }`}
 />
 <div className="flex-1 min-w-0">
 <div className={"text-sm font-medium transition-colors truncate text-zinc-900 dark:text-white"}>
 {server.name || server.host}
 </div>
 <div className={"text-xs font-mono truncate text-zinc-500 dark:text-zinc-600"}>
 {server.username}@{server.host}:{server.port}
 </div>
 </div>
 </div>
 ))}
 </AnimatedList>
 )}
 </div>
 )}

 {/* 空状态 - 筛选后无结果 */}
 {!loading && filteredServers.length === 0 && servers.length > 0 && (
 <div className="text-center space-y-3 py-8">
 <div className={"inline-flex items-center justify-center w-12 h-12 rounded-lg border bg-zinc-50 border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-800/30"}>
 <Search className={"h-6 w-6 text-zinc-400 dark:text-zinc-600"} />
 </div>
 <div className="space-y-1">
 <p className={"text-sm text-zinc-600 dark:text-zinc-500"}>
 未找到匹配的服务器
 </p>
 <p className={"text-xs text-zinc-500 dark:text-zinc-600"}>
 请尝试调整搜索条件或筛选标签
 </p>
 </div>
 </div>
 )}

 {/* 空状态 - 完全没有服务器 */}
 {!loading && servers.length === 0 && (
 <>
 <div className="flex items-center justify-between gap-4">
 {/* 左侧：搜索框（禁用状态） */}
 <div className="relative flex-1 max-w-md opacity-50 pointer-events-none">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 dark:text-zinc-600 h-4 w-4" />
 <Input
 placeholder="搜索服务器名称、地址或用户名..."
 className={"pl-10 bg-zinc-50 border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-800/30"}
 disabled
 />
 </div>

 {/* 右侧：添加按钮 */}
 <Button onClick={() => setIsAddDialogOpen(true)} className="shadow-sm flex-shrink-0">
 <Plus className="mr-2 h-4 w-4" />
 添加服务器
 </Button>
 </div>

 <div className="text-center space-y-3 py-8">
 <div className={"inline-flex items-center justify-center w-12 h-12 rounded-lg border bg-zinc-50 border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-800/30"}>
 <ServerIcon className={"h-6 w-6 text-zinc-400 dark:text-zinc-600"} />
 </div>
 <div className="space-y-1">
 <p className={"text-sm text-zinc-600 dark:text-zinc-500"}>
 暂无服务器配置
 </p>
 <p className={"text-xs text-zinc-500 dark:text-zinc-600"}>
 点击上方按钮添加您的第一台服务器
 </p>
 </div>
 </div>
 </>
 )}
 </div>
 </div>
 </div>

 {/* 添加服务器弹窗 */}
 <AddServerDialog
 open={isAddDialogOpen}
 onOpenChange={setIsAddDialogOpen}
 onSubmit={handleAddServer}
 />

 {/* 编辑服务器弹窗 */}
 <EditServerDialog
 open={isEditDialogOpen}
 onOpenChange={setIsEditDialogOpen}
 onSubmit={handleEditServer}
 initialData={editingServer ? {
 name: editingServer.name,
 host: editingServer.host,
 port: editingServer.port?.toString() || "22",
 username: editingServer.username,
 authMethod: editingServer.auth_method === "key" ? "privateKey" : "password",
 password: editingServer.password || "",
 privateKey: editingServer.private_key || "",
 rememberPassword: false,
 tags: editingServer.tags || [],
 description: editingServer.description || "",
 group: editingServer.group || "",
 jumpServer: "",
 autoConnect: false,
 keepAlive: true,
 } : undefined}
 />
 </>
 )
}
