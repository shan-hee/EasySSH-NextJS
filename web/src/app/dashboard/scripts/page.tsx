"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Kbd } from "@/components/ui/kbd"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/error-utils"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { ColumnVisibility } from "@/components/ui/column-visibility"
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog"
import { Plus, X, RefreshCw, Search, Check, Terminal, Server as ServerIcon, FileText, Tag, User, Play } from "lucide-react"
import { scriptsApi, serversApi, batchTasksApi, type Script, type Server } from "@/lib/api"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { createScriptColumns } from "./components/script-columns"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { cn } from "@/lib/utils"
import {
  DashboardMetricCard,
  InlineStatusBadge,
} from "../logs/components/log-dashboard-widgets"

function formatScriptTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function ScriptsPage() {
 const t = useTranslations("scripts")
 const router = useRouter()
 const { ready } = useAuthReady()
 const { confirm: requestConfirm, confirmDialog } = useConfirmDialog()
 const [scripts, setScripts] = useState<Script[]>([])
 const [loading, setLoading] = useState(true)
 const [isDialogOpen, setIsDialogOpen] = useState(false)
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
 const [editingScriptId, setEditingScriptId] = useState<string | null>(null)
 const [refreshing, setRefreshing] = useState(false)

 // 执行对话框状态
 const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false)
 const [executingScript, setExecutingScript] = useState<Script | null>(null)
 const [servers, setServers] = useState<Server[]>([])
 const [selectedServerIds, setSelectedServerIds] = useState<string[]>([])
 const [executionMode, setExecutionMode] = useState<"parallel" | "sequential">("parallel")
 const [serverSearchQuery, setServerSearchQuery] = useState("")
 const [loadingServers, setLoadingServers] = useState(false)
 const [executing, setExecuting] = useState(false)
 // DataTable 分页与列可见性
 const [page, setPage] = useState(1)
 const [pageSize, setPageSize] = useState(20)
 const [totalPages, setTotalPages] = useState(1)
 const [totalRows, setTotalRows] = useState(0)
 const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
   name: true,
   description: false,
   content: false,
   tags: true,
   author: true,
   updated_at: true,
   executions: true,
 })
 const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null)
 const [scriptCategory, setScriptCategory] = useState("all")

 // 新建脚本表单状态
 const [newScript, setNewScript] = useState({
 name: "",
 description: "",
 content: "",
 tags: [] as string[],
 })

 // 编辑脚本表单状态
 const [editScript, setEditScript] = useState({
 name: "",
 description: "",
 content: "",
 tags: [] as string[],
 })

 const [tagInput, setTagInput] = useState("")
 const [showSuggestions, setShowSuggestions] = useState(false)
 const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
 const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([])

 const [editTagInput, setEditTagInput] = useState("")
 const [showEditSuggestions, setShowEditSuggestions] = useState(false)
 const [selectedEditSuggestionIndex, setSelectedEditSuggestionIndex] = useState(-1)
 const editSuggestionRefs = useRef<(HTMLButtonElement | null)[]>([])

// 加载脚本列表
 const loadScripts = useCallback(async () => {
  try {
     const response = await scriptsApi.list({
       page,
       limit: pageSize,
     })

     setScripts(response.data || [])
     setTotalRows(response.total || (response.data || []).length)
     setTotalPages(response.total_pages || 1)
   } catch (error: unknown) {
     console.error("加载脚本列表失败:", error)
     toast.error(getErrorMessage(error, t("toastLoadFailed")))
   } finally {
     setLoading(false)
     setRefreshing(false)
   }
 }, [page, pageSize, t])

 // 刷新脚本列表
 const handleRefresh = async () => {
 setRefreshing(true)
 await loadScripts()
}

 // 初始加载与分页变化（仅在已认证且全局状态就绪时触发）
 useEffect(() => {
   if (!ready) return
   setLoading(true)
   loadScripts()
 }, [page, pageSize, loadScripts, ready])

 useEffect(() => {
   if (scripts.length === 0) {
     setSelectedScriptId(null)
     return
   }

   if (!selectedScriptId || !scripts.some((script) => script.id === selectedScriptId)) {
     setSelectedScriptId(scripts[0].id)
   }
 }, [scripts, selectedScriptId])

 // 自动滚动选中的建议项到可见区域
 useEffect(() => {
 if (selectedSuggestionIndex >= 0 && suggestionRefs.current[selectedSuggestionIndex]) {
 suggestionRefs.current[selectedSuggestionIndex]?.scrollIntoView({
 block: 'nearest',
 behavior: 'smooth'
 })
 }
 }, [selectedSuggestionIndex])

 useEffect(() => {
 if (selectedEditSuggestionIndex >= 0 && editSuggestionRefs.current[selectedEditSuggestionIndex]) {
 editSuggestionRefs.current[selectedEditSuggestionIndex]?.scrollIntoView({
 block: 'nearest',
 behavior: 'smooth'
 })
 }
 }, [selectedEditSuggestionIndex])

 // 获取所有标签（安全处理）
 const allTags = Array.from(new Set((scripts || []).flatMap(script => script.tags || [])))

 // 获取可用标签（排除已选择的）
 const availableTags = allTags.filter(tag => !newScript.tags.includes(tag))

 // 根据输入过滤标签建议
 const filteredSuggestions = tagInput.trim()
 ? availableTags.filter(tag =>
 tag.toLowerCase().includes(tagInput.toLowerCase())
 )
 : availableTags

 // 编辑模式的可用标签（排除已选择的）
 const availableEditTags = allTags.filter(tag => !editScript.tags.includes(tag))

 // 编辑模式的标签建议
 const filteredEditSuggestions = editTagInput.trim()
 ? availableEditTags.filter(tag =>
 tag.toLowerCase().includes(editTagInput.toLowerCase())
 )
 : availableEditTags

// 加载服务器列表
const loadServers = useCallback(async () => {
  setLoadingServers(true)
  try {
    const response = await serversApi.list({ limit: 1000 })
    setServers(response.data || [])
  } catch (error: unknown) {
    console.error("加载服务器列表失败:", error)
    toast.error(getErrorMessage(error, t("toastLoadServersFailed")))
  } finally {
    setLoadingServers(false)
  }
}, [t])

// 过滤后的服务器列表
const filteredServers = useMemo(() => {
  if (!serverSearchQuery.trim()) return servers
  const query = serverSearchQuery.toLowerCase()
  return servers.filter(
    (server) =>
      server.name?.toLowerCase().includes(query) ||
      server.host.toLowerCase().includes(query)
  )
}, [servers, serverSearchQuery])

// 在线服务器数量
const onlineServersCount = useMemo(() => {
  return servers.filter((s) => s.status === "online").length
}, [servers])

// 已选择的在线服务器数量
const selectedOnlineCount = useMemo(() => {
  return selectedServerIds.filter((id) => {
    const server = servers.find((s) => s.id === id)
    return server?.status === "online"
  }).length
}, [selectedServerIds, servers])

// 事件处理函数 - 使用 useCallback 避免闭包陷阱
const handleExecute = useCallback((scriptId: string) => {
  const script = scripts.find((s) => s.id === scriptId)
  if (script) {
    setExecutingScript(script)
    setSelectedServerIds([])
    setExecutionMode("parallel")
    setServerSearchQuery("")
    setIsExecuteDialogOpen(true)
    loadServers()
  }
}, [scripts, loadServers])

// 执行脚本
const handleExecuteScript = useCallback(async () => {
  if (!executingScript) return

  // 过滤出在线的服务器
  const onlineSelectedIds = selectedServerIds.filter((id) => {
    const server = servers.find((s) => s.id === id)
    return server?.status === "online"
  })

  if (onlineSelectedIds.length === 0) {
    toast.error(t("toastSelectAtLeastOneServer"))
    return
  }

  setExecuting(true)
  try {
    // 创建批量任务
    // 注意: apiFetch 会自动解包 data 字段，所以直接获取 task
    const response = await batchTasksApi.create({
      task_name: `${t("executeTaskPrefix")}: ${executingScript.name}`,
      task_type: "script",
      script_id: executingScript.id,
      content: executingScript.content,
      server_ids: onlineSelectedIds,
      execution_mode: executionMode,
    })
    // response 可能是 { data: BatchTask } 或直接是 BatchTask（取决于 apiFetch 的解包逻辑）
    const task = "data" in response ? response.data : response

    // 启动任务
    await batchTasksApi.start(task.id)

    toast.success(t("toastExecuteStarted"))
    setIsExecuteDialogOpen(false)

    // 跳转到统一操作日志中的执行记录视图
    router.push("/dashboard/operation-logs?type=execution")
  } catch (error: unknown) {
    console.error("执行脚本失败:", error)
    toast.error(getErrorMessage(error, t("toastExecuteFailed")))
  } finally {
    setExecuting(false)
  }
}, [executingScript, selectedServerIds, servers, executionMode, t, router])

// 切换服务器选择
const toggleServerSelection = useCallback((serverId: string) => {
  const server = servers.find((s) => s.id === serverId)
  if (server?.status !== "online") {
    toast.warning(t("toastOnlyOnlineServers"))
    return
  }
  setSelectedServerIds((prev) =>
    prev.includes(serverId)
      ? prev.filter((id) => id !== serverId)
      : [...prev, serverId]
  )
}, [servers, t])

// 全选/取消全选在线服务器
const toggleSelectAllOnline = useCallback(() => {
  const onlineServerIds = filteredServers
    .filter((s) => s.status === "online")
    .map((s) => s.id)

  const allSelected = onlineServerIds.every((id) => selectedServerIds.includes(id))

  if (allSelected) {
    setSelectedServerIds((prev) => prev.filter((id) => !onlineServerIds.includes(id)))
  } else {
    setSelectedServerIds((prev) => {
      const newIds = new Set([...prev, ...onlineServerIds])
      return Array.from(newIds)
    })
  }
}, [filteredServers, selectedServerIds])

// 关闭执行对话框
const handleCloseExecuteDialog = useCallback((open: boolean) => {
  setIsExecuteDialogOpen(open)
  if (!open) {
    setExecutingScript(null)
    setSelectedServerIds([])
    setServerSearchQuery("")
  }
}, [])

 const handleEdit = useCallback((scriptId: string) => {
 const script = scripts.find(s => s.id === scriptId)
 if (script) {
 setEditingScriptId(scriptId)
 setEditScript({
 name: script.name,
 description: script.description || "",
 content: script.content,
 tags: [...script.tags],
 })
 setIsEditDialogOpen(true)
 }
 }, [scripts])

 const handleDelete = useCallback(async (scriptId: string) => {
 const confirmed = await requestConfirm({
 description: t("toastDeleteConfirm"),
 variant: "destructive",
 })
 if (!confirmed) {
 return
 }

 try {
 await scriptsApi.delete(scriptId)
 toast.success(t("toastDeleteSuccess"))
 await loadScripts()
 } catch (error: unknown) {
 console.error("删除脚本失败:", error)
 toast.error(getErrorMessage(error, t("toastDeleteFailed")))
 }
 }, [loadScripts, requestConfirm, t])

// DataTable 列定义与可见列
const columns = useMemo(() => createScriptColumns({
  onExecute: handleExecute,
  onEdit: handleEdit,
  onDelete: handleDelete,
  onSelect: setSelectedScriptId,
  selectedId: selectedScriptId,
  t: (key: string) => t(key),
}), [handleExecute, handleEdit, handleDelete, selectedScriptId, t])

const visibleColumns = useMemo(
  () => columns.filter((col) =>
    (col.id ? columnVisibility[col.id] ?? true : true)
  ),
  [columns, columnVisibility]
)

// 筛选项（根据现有字段：作者、标签）
const filterOptions = useMemo(() => {
  const tags = Array.from(new Set((scripts || []).flatMap(s => s.tags || []))) as string[]
  const authors = Array.from(new Set((scripts || []).map(s => s.author).filter(Boolean))) as string[]
  return {
    tags: tags.map(t => ({ label: t, value: t })),
    authors: authors.map(a => ({ label: a, value: a })),
  }
}, [scripts])

const tagCounts = useMemo(() => {
  const counts = new Map<string, number>()
  scripts.forEach((script) => {
    ;(script.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1))
  })
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}, [scripts])

const tableScripts = useMemo(() => {
  if (scriptCategory === "all") return scripts
  return scripts.filter((script) => (script.tags || []).includes(scriptCategory))
}, [scriptCategory, scripts])

const selectedScript = useMemo(() => (
  scripts.find((script) => script.id === selectedScriptId) || tableScripts[0] || scripts[0] || null
), [scripts, selectedScriptId, tableScripts])

const scriptSpark = useMemo(() => (
  scripts.slice(-12).map((script) => script.executions || 0)
), [scripts])

const totalExecutions = useMemo(() => (
  scripts.reduce((sum, script) => sum + (script.executions || 0), 0)
), [scripts])

 const handleAddTag = (tag?: string) => {
 const tagToAdd = tag || tagInput.trim()
 if (tagToAdd && !newScript.tags.includes(tagToAdd)) {
 setNewScript({
 ...newScript,
 tags: [...newScript.tags, tagToAdd],
 })
 setTagInput("")
 setShowSuggestions(false)
 setSelectedSuggestionIndex(-1)
 }
 }

 const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
 if (!showSuggestions || filteredSuggestions.length === 0) {
 if (e.key === 'Enter') {
 e.preventDefault()
 handleAddTag()
 }
 return
 }

 switch (e.key) {
 case 'ArrowDown':
 e.preventDefault()
 setSelectedSuggestionIndex((prev) =>
 prev < filteredSuggestions.length - 1 ? prev + 1 : prev
 )
 break
 case 'ArrowUp':
 e.preventDefault()
 setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1))
 break
 case 'Enter':
 e.preventDefault()
 if (selectedSuggestionIndex >= 0) {
 handleAddTag(filteredSuggestions[selectedSuggestionIndex])
 } else {
 handleAddTag()
 }
 break
 case 'Escape':
 e.preventDefault()
 setShowSuggestions(false)
 setSelectedSuggestionIndex(-1)
 break
 }
 }

 const handleRemoveTag = (tagToRemove: string) => {
 setNewScript({
 ...newScript,
 tags: newScript.tags.filter(tag => tag !== tagToRemove),
 })
 }

 // 编辑模式的标签处理函数
 const handleAddEditTag = (tag?: string) => {
 const tagToAdd = tag || editTagInput.trim()
 if (tagToAdd && !editScript.tags.includes(tagToAdd)) {
 setEditScript({
 ...editScript,
 tags: [...editScript.tags, tagToAdd],
 })
 setEditTagInput("")
 setShowEditSuggestions(false)
 setSelectedEditSuggestionIndex(-1)
 }
 }

 const handleKeyDownEditTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
 if (!showEditSuggestions || filteredEditSuggestions.length === 0) {
 if (e.key === 'Enter') {
 e.preventDefault()
 handleAddEditTag()
 }
 return
 }

 switch (e.key) {
 case 'ArrowDown':
 e.preventDefault()
 setSelectedEditSuggestionIndex((prev) =>
 prev < filteredEditSuggestions.length - 1 ? prev + 1 : prev
 )
 break
 case 'ArrowUp':
 e.preventDefault()
 setSelectedEditSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1))
 break
 case 'Enter':
 e.preventDefault()
 if (selectedEditSuggestionIndex >= 0) {
 handleAddEditTag(filteredEditSuggestions[selectedEditSuggestionIndex])
 } else {
 handleAddEditTag()
 }
 break
 case 'Escape':
 e.preventDefault()
 setShowEditSuggestions(false)
 setSelectedEditSuggestionIndex(-1)
 break
 }
 }

 const handleRemoveEditTag = (tagToRemove: string) => {
 setEditScript({
 ...editScript,
 tags: editScript.tags.filter(tag => tag !== tagToRemove),
 })
 }

 const handleCreateScript = async () => {
 if (!newScript.name || !newScript.content) {
 toast.error(t("toastFormIncomplete"))
 return
 }

 try {
 await scriptsApi.create({
  name: newScript.name,
  description: newScript.description || "",
  content: newScript.content,
  language: "bash",
  tags: newScript.tags,
})

 toast.success(t("toastCreateSuccess"))
 setIsDialogOpen(false)

 // 重置表单
 setNewScript({
 name: "",
 description: "",
 content: "",
 tags: [],
 })
 setTagInput("")

 // 重新加载列表
 await loadScripts()
 } catch (error: unknown) {
  console.error("创建脚本失败:", error)
 toast.error(getErrorMessage(error, t("toastCreateFailed")))
 }
 }

 const handleOpenDialog = () => {
 setIsDialogOpen(true)
 }

 const handleCloseDialog = (open: boolean) => {
 setIsDialogOpen(open)
 if (!open) {
 // 重置表单
 setNewScript({
 name: "",
 description: "",
 content: "",
 tags: [],
 })
 setTagInput("")
 }
 }

 const handleUpdateScript = async () => {
 if (!editScript.name || !editScript.content) {
 toast.error(t("toastFormIncomplete"))
 return
 }

 if (editingScriptId === null) return

 try {
 await scriptsApi.update(editingScriptId, {
  name: editScript.name,
  description: editScript.description || "",
  content: editScript.content,
  language: "bash",
  tags: editScript.tags,
})

 toast.success(t("toastUpdateSuccess"))
 setIsEditDialogOpen(false)
 setEditingScriptId(null)

 // 重置表单
 setEditScript({
 name: "",
 description: "",
 content: "",
 tags: [],
 })
 setEditTagInput("")

 // 重新加载列表
 await loadScripts()
 } catch (error: unknown) {
  console.error("更新脚本失败:", error)
 toast.error(getErrorMessage(error, t("toastUpdateFailed")))
 }
 }

 const handleCloseEditDialog = (open: boolean) => {
 setIsEditDialogOpen(open)
 if (!open) {
 setEditingScriptId(null)
 // 重置表单
 setEditScript({
 name: "",
 description: "",
 content: "",
 tags: [],
 })
 setEditTagInput("")
 }
 }

 return (
 <>
 {confirmDialog}
 <PageHeader title={t("pageTitle")} />

 <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pt-0 sm:gap-4 sm:p-4 sm:pt-0 xl:overflow-hidden">
   <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
     <DashboardMetricCard title={t("statsTotalScripts")} value={totalRows || scripts.length} icon={FileText} tone="emerald" spark={scriptSpark} loading={loading} />
     <DashboardMetricCard title={t("statsTags")} value={filterOptions.tags.length} icon={Tag} tone="blue" spark={tagCounts.slice(0, 12).map((item) => item.count)} loading={loading} />
     <DashboardMetricCard title={t("statsAuthors")} value={filterOptions.authors.length} icon={User} tone="violet" spark={filterOptions.authors.map(() => 1)} loading={loading} />
     <DashboardMetricCard title="累计执行" value={totalExecutions} icon={Play} tone="amber" spark={scriptSpark} loading={loading} />
   </div>

   <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[170px_minmax(0,1fr)_300px] 2xl:grid-cols-[180px_minmax(0,1fr)_320px]">
     <Card className="hidden min-h-0 gap-0 p-3 xl:flex xl:flex-col">
       <div className="px-1 pb-3">
         <h2 className="text-sm font-semibold">分类</h2>
         <p className="mt-1 text-xs text-muted-foreground">按标签聚合脚本集合。</p>
       </div>
       <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
         <button
           type="button"
           onClick={() => {
             setScriptCategory("all")
             setPage(1)
           }}
           className={cn(
             "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
             scriptCategory === "all" && "bg-accent font-medium"
           )}
         >
           <span>全部脚本</span>
           <span className="text-xs tabular-nums text-muted-foreground">{scripts.length}</span>
         </button>
         {tagCounts.map((item) => (
           <button
             key={item.tag}
             type="button"
             onClick={() => {
               setScriptCategory(item.tag)
               setPage(1)
               const nextScript = scripts.find((script) => (script.tags || []).includes(item.tag))
               if (nextScript) setSelectedScriptId(nextScript.id)
             }}
             className={cn(
               "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
               scriptCategory === item.tag && "bg-accent font-medium"
             )}
           >
             <span className="truncate">{item.tag}</span>
             <span className="ml-2 text-xs tabular-nums text-muted-foreground">{item.count}</span>
           </button>
         ))}
       </div>
     </Card>

     <DataTable
       data={tableScripts}
       columns={visibleColumns}
       loading={loading || refreshing}
       currentPage={scriptCategory === "all" ? page : 1}
       pageCount={scriptCategory === "all" ? totalPages : 1}
       pageSize={pageSize}
       totalRows={scriptCategory === "all" ? totalRows : tableScripts.length}
       onPageChange={setPage}
       onPageSizeChange={(newPageSize) => {
         setPageSize(newPageSize)
         setPage(1)
       }}
       emptyMessage={t("tableEmpty")}
       className="min-h-0 overflow-hidden"
       density="compact"
       toolbar={(table) => (
         <DataTableToolbar
           table={table}
           searchKey="name"
           searchPlaceholder={t("tableSearchPlaceholder")}
           filters={[
             { column: 'author', title: t("filterAuthorTitle"), options: filterOptions.authors },
             { column: 'tags', title: t("filterTagsTitle"), options: filterOptions.tags },
           ]}
           onRefresh={handleRefresh}
           showRefresh={true}
           isRefreshing={refreshing}
         >
           <ColumnVisibility
             columns={[
               { id: 'name', label: t("cvName") },
               { id: 'description', label: t("cvDescription") },
               { id: 'content', label: t("cvContent") },
               { id: 'tags', label: t("cvTags") },
               { id: 'author', label: t("cvAuthor") },
               { id: 'updated_at', label: t("cvUpdatedAt") },
               { id: 'executions', label: t("cvExecutions") },
             ].map(column => ({
               id: column.id,
               label: column.label,
               visible: columnVisibility[column.id] ?? true,
               onToggle: () => setColumnVisibility(prev => ({
                 ...prev,
                 [column.id]: !prev[column.id]
               }))
             }))}
           />
           <Button size="sm" onClick={handleOpenDialog}>
             <Plus className="mr-2 h-4 w-4" />
             {t("btnNew")}
           </Button>
         </DataTableToolbar>
       )}
     />

     <Card className="hidden min-h-0 gap-0 overflow-hidden p-4 xl:flex xl:flex-col">
       <div className="flex items-start justify-between gap-3">
         <div className="min-w-0">
           <h2 className="truncate text-base font-semibold">脚本详情</h2>
           <p className="mt-1 text-sm text-muted-foreground">查看当前选中脚本的标签、内容和最近更新。</p>
         </div>
         {selectedScript && <InlineStatusBadge label={selectedScript.language || "bash"} tone="blue" />}
       </div>
       {selectedScript ? (
         <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
           <div>
             <div className="text-sm font-medium">{selectedScript.name}</div>
             <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{selectedScript.description || "暂无描述"}</p>
           </div>
           <div className="grid grid-cols-2 gap-2 text-sm">
             <div className="rounded-md bg-muted/50 p-3">
               <div className="text-xs text-muted-foreground">执行次数</div>
               <div className="mt-1 font-semibold tabular-nums">{selectedScript.executions || 0}</div>
             </div>
             <div className="rounded-md bg-muted/50 p-3">
               <div className="text-xs text-muted-foreground">作者</div>
               <div className="mt-1 truncate font-semibold">{selectedScript.author || "-"}</div>
             </div>
           </div>
           <div className="flex flex-wrap gap-1">
             {(selectedScript.tags || []).length === 0 ? (
               <InlineStatusBadge label="未分类" tone="slate" />
             ) : selectedScript.tags.map((tag) => (
               <InlineStatusBadge key={tag} label={tag} tone="violet" />
             ))}
           </div>
           <pre className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">{selectedScript.content}</pre>
           <div className="space-y-2 text-xs text-muted-foreground">
             <div className="flex items-center justify-between gap-3">
               <span>创建时间</span>
               <span className="truncate text-right tabular-nums">{formatScriptTime(selectedScript.created_at)}</span>
             </div>
             <div className="flex items-center justify-between gap-3">
               <span>更新时间</span>
               <span className="truncate text-right tabular-nums">{formatScriptTime(selectedScript.updated_at)}</span>
             </div>
           </div>
           <div className="flex gap-2">
             <Button className="flex-1" size="sm" onClick={() => handleExecute(selectedScript.id)}>
               <Play className="mr-2 h-4 w-4" />
               执行
             </Button>
             <Button variant="outline" size="sm" onClick={() => handleEdit(selectedScript.id)}>
               编辑
             </Button>
           </div>
         </div>
       ) : (
         <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
           {t("tableEmpty")}
         </div>
       )}
     </Card>
   </section>
 </div>

 {/* 新建脚本弹窗 */}
 <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
 <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
 <DialogHeader className="shrink-0">
 <DialogTitle>新建脚本</DialogTitle>
 <DialogDescription>
 创建一个新的脚本模板，可以在任务中使用
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
{/* 脚本名称 */}
<div className="space-y-2">
<Label htmlFor="script-name">
{t("fieldNameLabel")} <span className="text-destructive">*</span>
</Label>
<Input
id="script-name"
placeholder={t("fieldNamePlaceholder")}
 value={newScript.name}
 onChange={(e) => setNewScript({ ...newScript, name: e.target.value })}
 />
 </div>

{/* 脚本描述 */}
<div className="space-y-2">
<Label htmlFor="script-description">{t("fieldDescriptionLabel")}</Label>
<Input
id="script-description"
placeholder={t("fieldDescriptionPlaceholder")}
 value={newScript.description}
 onChange={(e) => setNewScript({ ...newScript, description: e.target.value })}
 />
 </div>

 {/* 脚本内容 */}
 <div className="space-y-2">
 <Label htmlFor="script-content">
 {t("fieldContentLabel")} <span className="text-destructive">*</span>
 </Label>
 <Textarea
 id="script-content"
 placeholder="#!/bin/bash&#10;&#10;echo 'Hello World'"
 className="font-mono min-h-[200px]"
 value={newScript.content}
 onChange={(e) => setNewScript({ ...newScript, content: e.target.value })}
 />
 <p className="text-xs text-muted-foreground">
 {t("fieldContentHint")}
 </p>
 </div>

 {/* 标签 */}
 <div className="space-y-2">
 <Label htmlFor="script-tags">{t("fieldTagsLabel")}</Label>
 <div className="relative">
 <Input
 id="script-tags"
 placeholder={t("tagsInputPlaceholder")}
 value={tagInput}
 onChange={(e) => {
 setTagInput(e.target.value)
 setShowSuggestions(true)
 setSelectedSuggestionIndex(-1)
 }}
 onFocus={() => setShowSuggestions(true)}
 onBlur={() => {
 // 延迟关闭，让点击建议项有时间触发
 setTimeout(() => {
 setShowSuggestions(false)
 setSelectedSuggestionIndex(-1)
 }, 200)
 }}
 onKeyDown={handleKeyDown}
 />

 {/* 标签建议下拉列表 */}
 {showSuggestions && filteredSuggestions.length > 0 && tagInput.trim() && (
 <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto scrollbar-custom">
 <div className="p-1">
 {filteredSuggestions.map((tag, index) => (
 <button
 key={tag}
 ref={(el) => {
 suggestionRefs.current[index] = el
 }}
 type="button"
 className={`w-full text-left px-2 py-1.5 text-sm rounded-sm cursor-pointer transition-colors ${
 index === selectedSuggestionIndex
 ? 'bg-accent text-accent-foreground'
 : 'hover:bg-accent/50'
 }`}
 onMouseEnter={() => setSelectedSuggestionIndex(index)}
 onMouseDown={(e) => {
 e.preventDefault() // 防止失去焦点
 handleAddTag(tag)
 }}
 >
 {tag}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
 {t("tagsHintPrefix")}
 <Kbd>↑</Kbd>
 <Kbd>↓</Kbd>
 {t("tagsHintSelect")}
 <Kbd>Enter</Kbd>
 {t("tagsHintEnter")}
 <Kbd>Esc</Kbd>
 {t("tagsHintEsc")}
 </p>

 {/* 已添加的标签 */}
 {newScript.tags.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-2">
 {newScript.tags.map((tag) => (
 <Badge key={tag} variant="secondary" className="gap-1">
 {tag}
 <button
 type="button"
 onClick={() => handleRemoveTag(tag)}
 className="ml-1 hover:text-destructive"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 )}
 </div>
 </div>

 <DialogFooter className="shrink-0">
 <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
 {t("dialogCancel")}
 </Button>
 <Button onClick={handleCreateScript}>
 {t("dialogCreateSubmit")}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* 编辑脚本弹窗 */}
 <Dialog open={isEditDialogOpen} onOpenChange={handleCloseEditDialog}>
 <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
 <DialogHeader className="shrink-0">
 <DialogTitle>{t("editDialogTitle")}</DialogTitle>
 <DialogDescription>
 {t("editDialogDescription")}
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
 {/* 脚本名称 */}
 <div className="space-y-2">
 <Label htmlFor="edit-script-name">
 {t("fieldNameLabel")} <span className="text-destructive">*</span>
 </Label>
 <Input
 id="edit-script-name"
 placeholder={t("fieldNamePlaceholder")}
 value={editScript.name}
 onChange={(e) => setEditScript({ ...editScript, name: e.target.value })}
 />
 </div>

 {/* 脚本描述 */}
 <div className="space-y-2">
 <Label htmlFor="edit-script-description">{t("fieldDescriptionLabel")}</Label>
 <Input
 id="edit-script-description"
 placeholder={t("fieldDescriptionPlaceholder")}
 value={editScript.description}
 onChange={(e) => setEditScript({ ...editScript, description: e.target.value })}
 />
 </div>

 {/* 脚本内容 */}
 <div className="space-y-2">
 <Label htmlFor="edit-script-content">
 {t("fieldContentLabel")} <span className="text-destructive">*</span>
 </Label>
 <Textarea
 id="edit-script-content"
 placeholder="#!/bin/bash&#10;&#10;echo 'Hello World'"
 className="font-mono min-h-[200px]"
 value={editScript.content}
 onChange={(e) => setEditScript({ ...editScript, content: e.target.value })}
 />
 <p className="text-xs text-muted-foreground">
 {t("fieldContentHint")}
 </p>
 </div>

 {/* 标签 */}
 <div className="space-y-2">
 <Label htmlFor="edit-script-tags">{t("fieldTagsLabel")}</Label>
 <div className="relative">
 <Input
 id="edit-script-tags"
 placeholder={t("tagsInputPlaceholder")}
 value={editTagInput}
 onChange={(e) => {
 setEditTagInput(e.target.value)
 setShowEditSuggestions(true)
 setSelectedEditSuggestionIndex(-1)
 }}
 onFocus={() => setShowEditSuggestions(true)}
 onBlur={() => {
 // 延迟关闭，让点击建议项有时间触发
 setTimeout(() => {
 setShowEditSuggestions(false)
 setSelectedEditSuggestionIndex(-1)
 }, 200)
 }}
 onKeyDown={handleKeyDownEditTag}
 />

 {/* 标签建议下拉列表 */}
 {showEditSuggestions && filteredEditSuggestions.length > 0 && editTagInput.trim() && (
 <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto scrollbar-custom">
 <div className="p-1">
 {filteredEditSuggestions.map((tag, index) => (
 <button
 key={tag}
 ref={(el) => {
 editSuggestionRefs.current[index] = el
 }}
 type="button"
 className={`w-full text-left px-2 py-1.5 text-sm rounded-sm cursor-pointer transition-colors ${
 index === selectedEditSuggestionIndex
 ? 'bg-accent text-accent-foreground'
 : 'hover:bg-accent/50'
 }`}
 onMouseEnter={() => setSelectedEditSuggestionIndex(index)}
 onMouseDown={(e) => {
 e.preventDefault() // 防止失去焦点
 handleAddEditTag(tag)
 }}
 >
 {tag}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
 {t("tagsHintPrefix")}
 <Kbd>↑</Kbd>
 <Kbd>↓</Kbd>
 {t("tagsHintSelect")}
 <Kbd>Enter</Kbd>
 {t("tagsHintEnter")}
 <Kbd>Esc</Kbd>
 {t("tagsHintEsc")}
 </p>

 {/* 已添加的标签 */}
 {editScript.tags.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-2">
 {editScript.tags.map((tag) => (
 <Badge key={tag} variant="secondary" className="gap-1">
 {tag}
 <button
 type="button"
 onClick={() => handleRemoveEditTag(tag)}
 className="ml-1 hover:text-destructive"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 )}
 </div>
 </div>

 <DialogFooter className="shrink-0">
 <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
 {t("dialogCancel")}
 </Button>
 <Button onClick={handleUpdateScript}>
 {t("editDialogSave")}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* 执行脚本对话框 */}
 <Dialog open={isExecuteDialogOpen} onOpenChange={handleCloseExecuteDialog}>
   <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-0">
     <DialogHeader className="shrink-0 pb-4">
       <DialogTitle className="flex items-center gap-2">
         <Terminal className="h-5 w-5" />
         {t("executeDialogTitle")}
       </DialogTitle>
       <DialogDescription className="flex items-center gap-2 pt-1">
         <Badge variant="outline" className="font-mono text-xs">
           {executingScript?.name}
         </Badge>
       </DialogDescription>
     </DialogHeader>

     <div className="space-y-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
       {/* 选择目标服务器 */}
       <div className="space-y-3">
         <div className="flex items-center justify-between">
           <Label className="text-sm font-medium">{t("executeSelectServers")}</Label>
           <span className="text-xs text-muted-foreground">
             {t("executeSelectedSummary", {
               selected: selectedOnlineCount,
               online: onlineServersCount,
             })}
           </span>
         </div>

         {/* 搜索框和全选 */}
         <div className="flex items-center gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder={t("executeSearchPlaceholder")}
               value={serverSearchQuery}
               onChange={(e) => setServerSearchQuery(e.target.value)}
               className="pl-8 h-9"
             />
           </div>
           <Button
             variant="outline"
             size="sm"
             onClick={toggleSelectAllOnline}
             className="h-9 px-3 text-xs whitespace-nowrap"
           >
             {filteredServers.filter((s) => s.status === "online").every((s) => selectedServerIds.includes(s.id))
               ? t("executeUnselectAll")
               : t("executeSelectAll")}
           </Button>
         </div>

         {/* 服务器列表 */}
         <ScrollArea className="h-[240px] rounded-md border bg-muted/30">
           {loadingServers ? (
             <div className="p-2 space-y-1">
               {Array.from({ length: 4 }).map((_, i) => (
                 <div key={i} className="flex items-center gap-3 p-2.5 rounded-md border border-transparent">
                   <Skeleton className="h-4 w-4 rounded" />
                   <div className="flex-1 space-y-1.5">
                     <Skeleton className="h-4 w-32" />
                     <Skeleton className="h-3 w-24" />
                   </div>
                   <Skeleton className="h-2 w-2 rounded-full" />
                 </div>
               ))}
             </div>
           ) : filteredServers.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-[220px] gap-2 text-muted-foreground">
               <ServerIcon className="h-8 w-8 opacity-50" />
               <span className="text-sm">{t("executeNoServers")}</span>
             </div>
           ) : (
             <div className="p-2 space-y-1">
               {filteredServers.map((server) => {
                 const isOnline = server.status === "online"
                 const isSelected = selectedServerIds.includes(server.id)
                 return (
                   <div
                     key={server.id}
                     className={`flex items-center gap-3 p-2.5 rounded-md transition-all ${
                       isOnline
                         ? isSelected
                           ? "bg-primary/10 border border-primary/30"
                           : "hover:bg-accent/50 cursor-pointer border border-transparent"
                         : "opacity-40 cursor-not-allowed border border-transparent"
                     }`}
                     onClick={() => toggleServerSelection(server.id)}
                   >
                     <Checkbox
                       checked={isSelected}
                       disabled={!isOnline}
                       onCheckedChange={() => toggleServerSelection(server.id)}
                       className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                     />
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-medium truncate">
                         {server.name || server.host}
                       </p>
                       <p className="text-xs text-muted-foreground truncate font-mono">
                         {server.host}:{server.port}
                       </p>
                     </div>
                     <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                   </div>
                 )
               })}
             </div>
           )}
         </ScrollArea>
       </div>

       {/* 执行模式 */}
       <div className="space-y-3 pt-2">
         <Label className="text-sm font-medium">{t("executeMode")}</Label>
         <RadioGroup
           value={executionMode}
           onValueChange={(value) => setExecutionMode(value as "parallel" | "sequential")}
           className="grid grid-cols-2 gap-3"
         >
           <Label
             htmlFor="parallel"
             className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${
               executionMode === "parallel"
                 ? "border-primary bg-primary/5"
                 : "border-border hover:bg-accent/50"
             }`}
           >
             <RadioGroupItem value="parallel" id="parallel" />
             <span className="text-sm">{t("executeModeParallel")}</span>
           </Label>
           <Label
             htmlFor="sequential"
             className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${
               executionMode === "sequential"
                 ? "border-primary bg-primary/5"
                 : "border-border hover:bg-accent/50"
             }`}
           >
             <RadioGroupItem value="sequential" id="sequential" />
             <span className="text-sm">{t("executeModeSequential")}</span>
           </Label>
         </RadioGroup>
       </div>
     </div>

     <DialogFooter className="shrink-0 pt-4 border-t mt-4">
       <Button variant="outline" onClick={() => setIsExecuteDialogOpen(false)}>
         {t("dialogCancel")}
       </Button>
       <Button
         onClick={handleExecuteScript}
         disabled={executing || selectedOnlineCount === 0}
       >
         {executing ? (
           <>
             <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
             {t("executeRunning")}
           </>
         ) : (
           <>
             <Check className="mr-2 h-4 w-4" />
             {t("executeSubmit")}
           </>
         )}
       </Button>
     </DialogFooter>
   </DialogContent>
 </Dialog>
 </>
 )
}
