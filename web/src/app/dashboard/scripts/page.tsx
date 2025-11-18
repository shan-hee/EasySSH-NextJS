"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Kbd } from "@/components/ui/kbd"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/error-utils"
// DataTable 相关组件
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
import { Plus, X, RefreshCw } from "lucide-react"
import { scriptsApi, type Script } from "@/lib/api"
import { createScriptColumns } from "./components/script-columns"

export default function ScriptsPage() {
 const [scripts, setScripts] = useState<Script[]>([])
 const [loading, setLoading] = useState(true)
 const [isDialogOpen, setIsDialogOpen] = useState(false)
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
 const [editingScriptId, setEditingScriptId] = useState<string | null>(null)
 const [refreshing, setRefreshing] = useState(false)
 // DataTable 分页与列可见性
 const [page, setPage] = useState(1)
 const [pageSize, setPageSize] = useState(20)
 const [totalPages, setTotalPages] = useState(1)
 const [totalRows, setTotalRows] = useState(0)
 const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
   name: true,
   description: true,
   content: true,
   tags: true,
   author: true,
   updated_at: true,
   executions: true,
 })

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
     toast.error(getErrorMessage(error, "加载脚本失败"))
   } finally {
     setLoading(false)
     setRefreshing(false)
   }
 }, [page, pageSize])

 // 刷新脚本列表
 const handleRefresh = async () => {
 setRefreshing(true)
 await loadScripts()
 }

// 初始加载与分页变化
useEffect(() => {
  setLoading(true)
  loadScripts()
}, [page, pageSize, loadScripts])

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

// DataTable 列定义与可见列
const columns = useMemo(() => createScriptColumns({
  onExecute: (id) => handleExecute(id),
  onEdit: (id) => handleEdit(id),
  onDelete: (id) => handleDelete(id),
  // eslint-disable-next-line react-hooks/exhaustive-deps
}), [])

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

 const handleExecute = (scriptId: string) => {
 console.log("执行脚本:", scriptId)
 toast.info("脚本执行功能即将推出")
 // TODO: 实现脚本执行对话框和逻辑
 }

 const handleEdit = (scriptId: string) => {
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
 }

 const handleDelete = async (scriptId: string) => {
 if (!confirm("确定要删除这个脚本吗？")) {
 return
 }

 try {
 await scriptsApi.delete(scriptId)
 toast.success("脚本删除成功")
 await loadScripts()
 } catch (error: unknown) {
 console.error("删除脚本失败:", error)
 toast.error(getErrorMessage(error, "删除脚本失败"))
 }
 }

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
 toast.error("请填写脚本名称和内容")
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

 toast.success("脚本创建成功")
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
 toast.error(getErrorMessage(error, "创建脚本失败"))
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
 toast.error("请填写脚本名称和内容")
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

 toast.success("脚本更新成功")
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
 toast.error(getErrorMessage(error, "更新脚本失败"))
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
 <PageHeader title="脚本管理">
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={handleRefresh}
 disabled={refreshing}
 >
 <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
 刷新
 </Button>
 <Button onClick={handleOpenDialog}>
 <Plus className="mr-2 h-4 w-4" />
 新建脚本
 </Button>
 </div>
</PageHeader>

<div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full overflow-hidden">
  <Card className="flex-1 min-h-0">
    <CardHeader className="flex flex-row items-center justify-between">
      <div>
        <CardTitle className="text-lg">脚本库</CardTitle>
        <CardDescription>显示 {scripts.length} 条记录</CardDescription>
      </div>
      <div className="flex gap-2">
        <ColumnVisibility
          columns={[
            { id: 'name', label: '名称' },
            { id: 'description', label: '描述' },
            { id: 'content', label: '内容' },
            // 以下列用于筛选，为避免报错，不允许在此处隐藏
            // { id: 'tags', label: '标签' },
            // { id: 'language', label: '语言' },
            // { id: 'author', label: '作者' },
            { id: 'updated_at', label: '更新时间' },
            { id: 'executions', label: '执行次数' },
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
      </div>
    </CardHeader>
    <CardContent className="flex-1 min-h-0 p-4 pt-0">
      <DataTable
        data={scripts}
        columns={visibleColumns}
        loading={loading}
        pageCount={totalPages}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageSizeChange={setPageSize}
        onPageChange={setPage}
        emptyMessage="暂无脚本"
        className="flex h-full flex-col"
        toolbar={(table) => (
          <DataTableToolbar
            table={table}
            searchKey="name"
            searchPlaceholder="搜索脚本名称或描述..."
            filters={[
              { column: 'author', title: '作者', options: filterOptions.authors },
              { column: 'tags', title: '标签', options: filterOptions.tags },
            ]}
            onRefresh={handleRefresh}
            showRefresh={true}
          >
            {/* 可添加额外操作按钮 */}
          </DataTableToolbar>
        )}
      />
    </CardContent>
  </Card>
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
 脚本名称 <span className="text-destructive">*</span>
 </Label>
 <Input
 id="script-name"
 placeholder="例如：系统监控脚本"
 value={newScript.name}
 onChange={(e) => setNewScript({ ...newScript, name: e.target.value })}
 />
 </div>

 {/* 脚本描述 */}
 <div className="space-y-2">
 <Label htmlFor="script-description">脚本描述</Label>
 <Input
 id="script-description"
 placeholder="简要描述脚本的功能"
 value={newScript.description}
 onChange={(e) => setNewScript({ ...newScript, description: e.target.value })}
 />
 </div>

 {/* 脚本内容 */}
 <div className="space-y-2">
 <Label htmlFor="script-content">
 脚本内容 <span className="text-destructive">*</span>
 </Label>
 <Textarea
 id="script-content"
 placeholder="#!/bin/bash&#10;&#10;echo 'Hello World'"
 className="font-mono min-h-[200px]"
 value={newScript.content}
 onChange={(e) => setNewScript({ ...newScript, content: e.target.value })}
 />
 <p className="text-xs text-muted-foreground">
 支持使用变量，如 $HOST, $PORT 等
 </p>
 </div>

 {/* 标签 */}
 <div className="space-y-2">
 <Label htmlFor="script-tags">标签</Label>
 <div className="relative">
 <Input
 id="script-tags"
 placeholder="输入标签名称，按回车添加"
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
 输入标签名称，
 <Kbd>↑</Kbd>
 <Kbd>↓</Kbd>
 选择建议，
 <Kbd>Enter</Kbd>
 添加，
 <Kbd>Esc</Kbd>
 关闭
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
 取消
 </Button>
 <Button onClick={handleCreateScript}>
 创建脚本
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* 编辑脚本弹窗 */}
 <Dialog open={isEditDialogOpen} onOpenChange={handleCloseEditDialog}>
 <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
 <DialogHeader className="shrink-0">
 <DialogTitle>编辑脚本</DialogTitle>
 <DialogDescription>
 修改脚本信息和内容
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
 {/* 脚本名称 */}
 <div className="space-y-2">
 <Label htmlFor="edit-script-name">
 脚本名称 <span className="text-destructive">*</span>
 </Label>
 <Input
 id="edit-script-name"
 placeholder="例如：系统监控脚本"
 value={editScript.name}
 onChange={(e) => setEditScript({ ...editScript, name: e.target.value })}
 />
 </div>

 {/* 脚本描述 */}
 <div className="space-y-2">
 <Label htmlFor="edit-script-description">脚本描述</Label>
 <Input
 id="edit-script-description"
 placeholder="简要描述脚本的功能"
 value={editScript.description}
 onChange={(e) => setEditScript({ ...editScript, description: e.target.value })}
 />
 </div>

 {/* 脚本内容 */}
 <div className="space-y-2">
 <Label htmlFor="edit-script-content">
 脚本内容 <span className="text-destructive">*</span>
 </Label>
 <Textarea
 id="edit-script-content"
 placeholder="#!/bin/bash&#10;&#10;echo 'Hello World'"
 className="font-mono min-h-[200px]"
 value={editScript.content}
 onChange={(e) => setEditScript({ ...editScript, content: e.target.value })}
 />
 <p className="text-xs text-muted-foreground">
 支持使用变量，如 $HOST, $PORT 等
 </p>
 </div>

 {/* 标签 */}
 <div className="space-y-2">
 <Label htmlFor="edit-script-tags">标签</Label>
 <div className="relative">
 <Input
 id="edit-script-tags"
 placeholder="输入标签名称，按回车添加"
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
 输入标签名称，
 <Kbd>↑</Kbd>
 <Kbd>↓</Kbd>
 选择建议，
 <Kbd>Enter</Kbd>
 添加，
 <Kbd>Esc</Kbd>
 关闭
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
 取消
 </Button>
 <Button onClick={handleUpdateScript}>
 保存修改
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 )
}
