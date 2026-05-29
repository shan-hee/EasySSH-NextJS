"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AddServerDialog } from "@/components/servers/add-server-dialog"
import { EditServerDialog } from "@/components/servers/edit-server-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"

// 可排序的服务器项组件
function SortableServerItem({
  server,
  onConnect,
  onEdit,
  onDelete,
}: {
  server: Server
  onConnect: (id: string) => void
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

  const t = useTranslations("servers")

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group flex items-center gap-3 p-4 rounded-lg border bg-card text-card-foreground border-border hover:bg-accent/60 hover:border-primary/40 cursor-grab active:cursor-grabbing outline-none focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-primary/20 transition-colors duration-200"
    >
      <ServerIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />

      <div className="flex-1 min-w-0 flex items-center gap-4">
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-foreground transition-colors truncate group-hover:text-primary">
              {server.name || server.host}
            </div>
          </div>
          <div className={"text-xs font-mono whitespace-nowrap text-muted-foreground"}>
            {server.username}@{server.host}:{server.port}
          </div>
        </div>
        {server.description && (
          <div className={"flex-1 text-xs truncate text-muted-foreground/80 text-left"}>
            {server.description}
          </div>
        )}
      </div>

      {server.tags && server.tags.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {server.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* 操作按钮组 */}
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground"
          onClick={() => onConnect(server.id)}
          title={t("tooltipConnect")}>
          <Terminal className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground"
          onClick={() => onEdit(server)}
          title={t("tooltipEdit")}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(server.id)}
          title={t("tooltipDelete")}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function ServersPage() {
 const router = useRouter()
 const { ready } = useAuthReady()
 const t = useTranslations("servers")
 const [servers, setServers] = useState<Server[]>([])
 const [filteredServers, setFilteredServers] = useState<Server[]>([])
 const [searchTerm, setSearchTerm] = useState("")
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
 const [editingServer, setEditingServer] = useState<Server | null>(null)
 const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
 const [loading, setLoading] = useState(true)
 const [activeGroup, setActiveGroup] = useState<string>('all')
 const [draggedServer, setDraggedServer] = useState<Server | null>(null)
 const [isMounted, setIsMounted] = useState(false)

 const groupFilters = useMemo(() => {
 const counts = new Map<string, number>()
 for (const server of servers) {
 const group = server.group?.trim()
 if (!group) continue
 counts.set(group, (counts.get(group) || 0) + 1)
 }

 return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
 }, [servers])

 const availableGroups = useMemo(
 () => groupFilters.map(([group]) => group),
 [groupFilters]
 )

 const availableTags = useMemo(() => {
 const tags = new Set<string>()
 for (const server of servers) {
 for (const tag of server.tags || []) {
 const normalizedTag = tag.trim()
 if (normalizedTag) tags.add(normalizedTag)
 }
 }
 return Array.from(tags).sort((a, b) => a.localeCompare(b, "zh-CN"))
 }, [servers])

 const deleteTargetServer = useMemo(
 () => servers.find(server => server.id === deleteTargetId) || null,
 [deleteTargetId, servers]
 )

 // 配置拖拽传感器
 const sensors = useSensors(
   useSensor(PointerSensor, {
     activationConstraint: {
       distance: 8, // 移动8px后才激活拖拽，避免与点击事件冲突
     },
   })
 )

 // 根据搜索词和当前分组过滤服务器
 useEffect(() => {
 let filtered = [...servers]

 // 按分组过滤
 if (activeGroup !== 'all') {
 filtered = filtered.filter(s => s.group?.trim() === activeGroup)
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
 }, [servers, searchTerm, activeGroup])

 useEffect(() => {
 if (activeGroup !== 'all' && !groupFilters.some(([group]) => group === activeGroup)) {
 setActiveGroup('all')
 }
 }, [activeGroup, groupFilters])

 // 客户端挂载检测
 useEffect(() => {
   setIsMounted(true)
 }, [])

 const loadServers = useCallback(async () => {
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
 toast.error(getErrorMessage(error, t("toastLoadFailed")))
 } finally {
 setLoading(false)
 }
 }, [t])

 // 加载服务器列表
 useEffect(() => {
   if (!ready) return
   loadServers()
 }, [ready, loadServers])

 const handleConnect = (serverId: string) => {
 // 查找服务器以获取名称
 const server = servers.find(s => s.id === serverId)
 const serverName = server?.name || server?.host || ""
 // 优化：使用 sessionStorage 传递参数，避免 URL 参数导致的二次跳转
 sessionStorage.setItem("pendingConnection", JSON.stringify({
   server: serverId,
   name: serverName
 }))
 router.push("/dashboard/terminal")
 }

 const handleEdit = (server: Server) => {
 setEditingServer(server)
 setIsEditDialogOpen(true)
 }

 const handleRequestDelete = (serverId: string) => {
 setDeleteTargetId(serverId)
 }

 const handleDelete = async (serverId: string) => {
 try {
 // 认证基于 HttpOnly Cookie

 await serversApi.delete(serverId)
 toast.success(t("toastDeleteSuccess"))

 // 乐观更新：直接从本地列表移除，避免整个页面刷新
 setServers(prev => prev.filter(s => s.id !== serverId))
 setDeleteTargetId(null)
 } catch (error: unknown) {
 console.error("Failed to delete server:", error)
 toast.error(getErrorMessage(error, t("toastDeleteFailed")))
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
 toast.success(t("toastSortSaved"))
 } catch (error: unknown) {
 console.error("Failed to save server order:", error)
 toast.error(getErrorMessage(error, t("toastSortSaveFailed")))
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
 group: data.group?.trim() || undefined,
 tags: data.tags,
 description: data.description,
 }

 const newServer = await serversApi.create(serverData)

 toast.success(t("toastCreateSuccess"))
 setIsAddDialogOpen(false)

 // 乐观更新：直接添加到本地列表，避免整个页面刷新
 setServers(prev => [...prev, newServer])
 } catch (error: unknown) {
 console.error("Failed to add server:", error)
 toast.error(getErrorMessage(error, t("toastCreateFailed")))
 }
 }

 const handleEditServer = async (data: ServerFormData) => {
 try {
 // 认证基于 HttpOnly Cookie

 if (!editingServer) {
 toast.error(t("toastEditNotFound"))
 return
 }

 const updateData: {
 name?: string
 host: string
 port: number
 username: string
 auth_method: "password" | "key"
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
 group: data.group?.trim() || "",
 tags: data.tags,
 description: data.description,
 }

 // 只有在填写了密码时才发送
 if (data.password) {
 updateData.password = data.password
 }

 // 只有在填写了私钥时才发送
 if (data.privateKey) {
 updateData.private_key = data.privateKey
 }

 const updatedServer = await serversApi.update(editingServer.id, updateData)

 toast.success(t("toastUpdateSuccess"))
 setIsEditDialogOpen(false)
 setEditingServer(null)

 // 乐观更新：只更新被修改的服务器，避免整个页面刷新
 setServers(prev => prev.map(s =>
 s.id === editingServer.id ? updatedServer : s
 ))
 } catch (error: unknown) {
 console.error("Failed to update server:", error)
 toast.error(getErrorMessage(error, t("toastUpdateFailed")))
 }
 }

 return (
 <>
 <PageHeader title={t("pageTitle")} />

 <div className={"h-full flex flex-col overflow-hidden relative transition-colors bg-background text-foreground"}>
 <div className={"absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"} />

 <div className="flex-1 flex flex-col items-center px-8 py-8 overflow-y-auto">
 <div className="max-w-3xl w-full space-y-3">
 {/* 搜索栏和添加按钮 - 始终显示（有服务器时） */}
 {(loading || servers.length > 0) && (
 <div className="space-y-3">
 <div className="flex items-center justify-between gap-4">
 {/* 左侧：搜索框 */}
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder={t("searchPlaceholder")}
 className={"pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"}
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>

 {/* 右侧：添加按钮 */}
 <Button onClick={() => setIsAddDialogOpen(true)} className="shadow-sm flex-shrink-0">
 <Plus className="mr-2 h-4 w-4" />
 {t("addServer")}
 </Button>
 </div>

 {/* 分组切换 - 始终显示 */}
 <div className="flex flex-wrap items-center gap-x-2 gap-y-2 py-1">
 <Button
 variant={activeGroup === 'all' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setActiveGroup('all')}
 className="h-8"
 >
 {t("tabAll")} ({servers.length})
 </Button>
 {groupFilters.map(([group, count]) => (
 <Button
 key={group}
 variant={activeGroup === group ? 'default' : 'outline'}
 size="sm"
 onClick={() => setActiveGroup(group)}
 className="h-8"
 >
 {group} ({count})
 </Button>
 ))}
 </div>
 </div>
 )}

 {/* 加载状态 */}
 {loading && (
 <div className="space-y-4">
 <div className={"h-px bg-gradient-to-r from-transparent via-border to-transparent"} />
 <div className="flex flex-col items-center justify-center py-12 gap-4">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 <p className="text-sm text-muted-foreground">
   {t("loadingList")}
 </p>
 </div>
 </div>
 )}

 {/* 服务器列表 */}
 {!loading && filteredServers.length > 0 && (
 <div className="space-y-4">
 <div className={"h-px bg-gradient-to-r from-transparent via-border to-transparent"} />

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
 onConnect={handleConnect}
 onEdit={handleEdit}
 onDelete={handleRequestDelete}
 />
 ))}
 </AnimatedList>
 </SortableContext>

 <DragOverlay>
 {draggedServer ? (
 <div className="flex items-center gap-3 p-4 rounded-lg border bg-card text-card-foreground border-border shadow-lg opacity-80">
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium text-foreground">
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
 className={"group flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 bg-card text-card-foreground border-border hover:bg-accent/60 hover:border-primary/40 outline-none focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-primary/20"}
 >
 <ServerIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />

 <div className="flex-1 min-w-0 flex items-center gap-4">
 <div className="flex-shrink-0">
 <div className="flex items-center gap-2">
 <div className="text-sm font-medium text-foreground transition-colors truncate group-hover:text-primary">
 {server.name || server.host}
 </div>
 </div>
 <div className={"text-xs font-mono whitespace-nowrap text-muted-foreground"}>
 {server.username}@{server.host}:{server.port}
 </div>
 </div>
 {server.description && (
 <div className={"flex-1 text-xs truncate text-muted-foreground/80 text-left"}>
 {server.description}
 </div>
 )}
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
 <div className={"inline-flex items-center justify-center w-12 h-12 rounded-lg border bg-card border-border"}>
 <Search className={"h-6 w-6 text-muted-foreground"} />
 </div>
 <div className="space-y-1">
 <p className={"text-sm text-muted-foreground"}>
 {t("emptyFilteredTitle")}
 </p>
 <p className={"text-xs text-muted-foreground/80"}>
 {t("emptyFilteredDescription")}
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
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder={t("searchPlaceholder")}
 className={"pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"}
 disabled
 />
 </div>

 {/* 右侧：添加按钮 */}
 <Button onClick={() => setIsAddDialogOpen(true)} className="shadow-sm flex-shrink-0">
 <Plus className="mr-2 h-4 w-4" />
 {t("addServer")}
 </Button>
 </div>

 <div className="text-center space-y-3 py-8">
 <div className={"inline-flex items-center justify-center w-12 h-12 rounded-lg border bg-card border-border"}>
 <ServerIcon className={"h-6 w-6 text-muted-foreground"} />
 </div>
 <div className="space-y-1">
 <p className={"text-sm text-muted-foreground"}>
 {t("emptyAllTitle")}
 </p>
 <p className={"text-xs text-muted-foreground/80"}>
 {t("emptyAllDescription")}
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
 availableGroups={availableGroups}
 availableTags={availableTags}
 />

 {/* 编辑服务器弹窗 */}
 <EditServerDialog
 open={isEditDialogOpen}
 onOpenChange={setIsEditDialogOpen}
 onSubmit={handleEditServer}
 availableGroups={availableGroups}
 availableTags={availableTags}
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

 <ConfirmDialog
 open={deleteTargetId !== null}
 onOpenChange={(nextOpen) => {
 if (!nextOpen) setDeleteTargetId(null)
 }}
 title={t("tooltipDelete")}
 description={deleteTargetServer?.name || deleteTargetServer?.host
 ? `${t("confirmDelete")}\n${deleteTargetServer.name || deleteTargetServer.host}`
 : t("confirmDelete")}
 confirmText={t("tooltipDelete")}
 variant="destructive"
 onConfirm={() => {
 if (deleteTargetId) {
 void handleDelete(deleteTargetId)
 }
 }}
 />
 </>
 )
}
