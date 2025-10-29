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
 Settings,
 Pin,
 PinOff,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const STORAGE_KEY = 'servers-order'
const PINNED_KEY = 'servers-pinned'

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
 const [pinnedServers, setPinnedServers] = useState<Set<string>>(new Set())
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

 // 加载置顶状态
 const savedPinned = localStorage.getItem(PINNED_KEY)
 if (savedPinned) {
 try {
 setPinnedServers(new Set(JSON.parse(savedPinned)))
 } catch (e) {
 console.error('Failed to load pinned servers:', e)
 }
 }
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
 server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 server.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
 server.username.toLowerCase().includes(searchTerm.toLowerCase())
 )
 }

 // 置顶的服务器排在前面
 filtered.sort((a, b) => {
 const aPin = pinnedServers.has(a.id) ? 1 : 0
 const bPin = pinnedServers.has(b.id) ? 1 : 0
 return bPin - aPin
 })

 setFilteredServers(filtered)
 }, [servers, searchTerm, activeTab, pinnedServers])

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
 limit: 100
 })

 const serverList = Array.isArray(response)
 ? response
 : (response?.data || [])

 setServers(serverList)
 setFilteredServers(serverList)
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

 const handleConnect = (serverId: string) => {
 router.push(`/dashboard/terminal?server=${serverId}`)
 }

 const handleEdit = (server: Server) => {
 setEditingServer(server)
 setIsEditDialogOpen(true)
 }

 const handleTogglePin = (serverId: string) => {
 setPinnedServers(prev => {
 const newSet = new Set(prev)
 if (newSet.has(serverId)) {
 newSet.delete(serverId)
 toast.success("已取消置顶")
 } else {
 newSet.add(serverId)
 toast.success("已置顶")
 }
 // 保存到localStorage
 localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(newSet)))
 return newSet
 })
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

 await loadServers()
 await loadStatistics()
 } catch (error: any) {
 console.error("Failed to delete server:", error)
 toast.error("删除失败: " + (error?.message || "未知错误"))
 }
 }

 const handleAddServer = async (data: ServerFormData, shouldTest = false) => {
 try {
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 router.push("/login")
 return
 }

 const serverData: {
 name: string
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

 const createdServer = await serversApi.create(token, serverData)

 toast.success("服务器添加成功")
 setIsAddDialogOpen(false)

 await loadServers()
 await loadStatistics()

 // 如果需要测试连接
 if (shouldTest && createdServer?.id) {
 toast.info("正在测试连接...")
 try {
 const result = await serversApi.testConnection(token, createdServer.id)
 if (result.success) {
 toast.success(`连接测试成功！延迟: ${result.latency_ms}ms`)
 // 测试成功后刷新服务器列表和统计信息以更新状态
 await loadServers()
 await loadStatistics()
 } else {
 toast.error("连接测试失败: " + result.message)
 // 测试失败也要刷新，因为后端会将状态更新为离线
 await loadServers()
 await loadStatistics()
 }
 } catch (error: any) {
 toast.error("测试失败: " + (error?.message || "未知错误"))
 // 测试失败也要刷新
 await loadServers()
 await loadStatistics()
 }
 }
 } catch (error: any) {
 console.error("Failed to add server:", error)

 let errorMessage = "未知错误"
 if (error?.detail) {
 if (typeof error.detail === 'object' && error.detail.message) {
 errorMessage = error.detail.message
 } else if (typeof error.detail === 'string') {
 errorMessage = error.detail
 }
 } else if (error?.message) {
 errorMessage = error.message
 }

 toast.error(`添加服务器失败: ${errorMessage}`)
 }
 }

 const handleEditServer = async (data: ServerFormData, shouldTest = false) => {
 try {
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 router.push("/login")
 return
 }

 if (!editingServer) {
 toast.error("未找到要编辑的服务器")
 return
 }

 await serversApi.update(token, editingServer.id, {
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

 const serverId = editingServer.id
 setEditingServer(null)

 await loadServers()
 await loadStatistics()

 // 如果需要测试连接
 if (shouldTest) {
 toast.info("正在测试连接...")
 try {
 const result = await serversApi.testConnection(token, serverId)
 if (result.success) {
 toast.success(`连接测试成功！延迟: ${result.latency_ms}ms`)
 // 测试成功后刷新服务器列表和统计信息以更新状态
 await loadServers()
 await loadStatistics()
 } else {
 toast.error("连接测试失败: " + result.message)
 // 测试失败也要刷新，因为后端会将状态更新为离线
 await loadServers()
 await loadStatistics()
 }
 } catch (error: any) {
 toast.error("测试失败: " + (error?.message || "未知错误"))
 // 测试失败也要刷新
 await loadServers()
 await loadStatistics()
 }
 }
 } catch (error: any) {
 console.error("Failed to update server:", error)

 let errorMessage = "未知错误"
 if (error?.detail) {
 if (typeof error.detail === 'object' && error.detail.message) {
 errorMessage = error.detail.message
 } else if (typeof error.detail === 'string') {
 errorMessage = error.detail
 }
 } else if (error?.message) {
 errorMessage = error.message
 }

 toast.error(`更新服务器失败: ${errorMessage}`)
 }
 }

 // 加载中状态
 if (loading) {
 return (
 <>
 <PageHeader title="连接配置" />
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
 <PageHeader title="连接配置" />

 <div className={"h-full flex flex-col overflow-hidden relative transition-colors bg-white dark:bg-black"}>
 <div className={"absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent via-black/5 dark:via-white/5"} />

 <div className="flex-1 flex flex-col items-center px-8 py-8 overflow-y-auto">
 <div className="max-w-3xl w-full space-y-6">
 {/* 搜索栏和添加按钮 */}
 {servers.length > 0 && (
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

 {/* 标签切换 */}
 <div className="flex gap-2">
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
 </div>
 </div>
 )}

 {/* 服务器列表 */}
 {filteredServers.length > 0 && (
 <div className="space-y-4">
 <div className={"h-px bg-gradient-to-r from-transparent to-transparent via-zinc-300 dark:via-zinc-800"} />

 <div className="space-y-2">
 {filteredServers.map((server) => (
 <div
 key={server.id}
 className={"group flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-zinc-900/40 dark:border-zinc-800/30 dark:hover:bg-zinc-800/60 dark:hover:border-zinc-700/40 cursor-pointer"}
 onClick={() => {
 if (server.status === 'online') {
 handleConnect(server.id)
 }
 }}
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
 {/* 置顶按钮 */}
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
 onClick={() => handleTogglePin(server.id)}
 title={pinnedServers.has(server.id) ? "取消置顶" : "置顶"}
 >
 {pinnedServers.has(server.id) ? (
 <Pin className="h-4 w-4" />
 ) : (
 <PinOff className="h-4 w-4" />
 )}
 </Button>
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
 onClick={() => handleConnect(server.id)}
 disabled={server.status !== 'online'}
 title="连接终端">
 <Terminal className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
 onClick={() => handleEdit(server)}
 title="编辑配置">
 <Edit className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
 onClick={() => handleDelete(server.id)}
 title="删除服务器">
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 空状态 - 筛选后无结果 */}
 {filteredServers.length === 0 && servers.length > 0 && (
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
 {servers.length === 0 && (
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
