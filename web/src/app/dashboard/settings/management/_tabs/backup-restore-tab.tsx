"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Database,
  Download,
  Upload,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  FileArchive,
} from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { ColumnDef } from "@tanstack/react-table"

// 备份数据类型
interface BackupRecord {
  id: number
  filename: string
  type: "auto" | "manual"
  size: string
  status: "success" | "failed"
  duration: string
  createdAt: string
}

// 模拟备份历史数据
const mockBackupData: BackupRecord[] = [
  {
    id: 1,
    filename: "easyssh_backup_20240115_143025.tar.gz",
    type: "manual",
    size: "245 MB",
    status: "success",
    duration: "2m 35s",
    createdAt: "2024-01-15 14:30:25",
  },
  {
    id: 2,
    filename: "easyssh_backup_20240115_020015.tar.gz",
    type: "auto",
    size: "238 MB",
    status: "success",
    duration: "2m 28s",
    createdAt: "2024-01-15 02:00:15",
  },
  {
    id: 3,
    filename: "easyssh_backup_20240114_143010.tar.gz",
    type: "manual",
    size: "242 MB",
    status: "success",
    duration: "2m 31s",
    createdAt: "2024-01-14 14:30:10",
  },
]

const typeLabels = {
  auto: "自动",
  manual: "手动",
}

const typeColors = {
  auto: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  manual: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
}

const statusIcons = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertTriangle className="h-4 w-4 text-red-500" />,
}

export function BackupRestoreTab() {
  const [backups, setBackups] = useState<BackupRecord[]>(mockBackupData)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null)

  // 手动备份
  const handleManualBackup = async () => {
    if (!confirm("确定要立即执行手动备份吗？此操作可能需要几分钟时间。")) {
      return
    }

    try {
      setLoading(true)
      toast.info("正在执行备份...")
      await new Promise((resolve) => setTimeout(resolve, 3000))

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
      const newBackup: BackupRecord = {
        id: Date.now(),
        filename: `easyssh_backup_${timestamp}.tar.gz`,
        type: "manual",
        size: `${Math.floor(Math.random() * 50 + 200)} MB`,
        status: "success",
        duration: `${Math.floor(Math.random() * 60 + 120)}s`,
        createdAt: new Date().toLocaleString("zh-CN"),
      }

      setBackups([newBackup, ...backups])
      toast.success("备份创建成功！")
    } catch {
      toast.error("备份失败，请查看日志")
    } finally {
      setLoading(false)
    }
  }

  // 下载备份
  const handleDownload = (backup: BackupRecord) => {
    toast.info(`正在下载: ${backup.filename}`)
    setTimeout(() => {
      toast.success("下载完成")
    }, 1000)
  }

  // 恢复备份
  const handleRestore = async () => {
    if (!selectedBackup) return

    try {
      setLoading(true)
      toast.info("正在恢复备份...")
      await new Promise((resolve) => setTimeout(resolve, 3000))

      toast.success("备份恢复成功！系统将在5秒后重启...")
      setIsRestoreDialogOpen(false)
      setSelectedBackup(null)
    } catch {
      toast.error("恢复失败，请查看日志")
    } finally {
      setLoading(false)
    }
  }

  // 删除备份
  const handleDelete = (backup: BackupRecord) => {
    if (!confirm(`确定要删除备份 "${backup.filename}" 吗？此操作不可恢复。`)) {
      return
    }

    setBackups(backups.filter((b) => b.id !== backup.id))
    toast.success("备份已删除")
  }

  // 打开恢复对话框
  const openRestoreDialog = (backup: BackupRecord) => {
    setSelectedBackup(backup)
    setIsRestoreDialogOpen(true)
  }

  // 刷新列表
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setBackups(mockBackupData)
      toast.success("刷新成功")
    } finally {
      setRefreshing(false)
    }
  }

  // 定义表格列
  const columns = useMemo<ColumnDef<BackupRecord>[]>(
    () => [
      {
        accessorKey: "filename",
        header: "文件名",
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.filename}</span>,
      },
      {
        accessorKey: "type",
        header: "类型",
        cell: ({ row }) => (
          <Badge className={typeColors[row.original.type]}>{typeLabels[row.original.type]}</Badge>
        ),
      },
      {
        accessorKey: "size",
        header: "大小",
      },
      {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => <div className="flex items-center gap-2">{statusIcons[row.original.status]}</div>,
      },
      {
        accessorKey: "duration",
        header: "耗时",
      },
      {
        accessorKey: "createdAt",
        header: "创建时间",
      },
      {
        id: "actions",
        header: () => <div className="text-right">操作</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleDownload(row.original)} title="下载备份">
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openRestoreDialog(row.original)}
              disabled={row.original.status !== "success"}
              title="恢复备份"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original)} title="删除备份">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [backups]
  )

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col gap-4 p-4 pt-0 overflow-hidden">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">备份总数</CardTitle>
            <FileArchive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backups.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功备份</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {backups.filter((b) => b.status === "success").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最新备份</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {backups.length > 0 ? backups[0].createdAt.split(" ")[0] : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 备份说明 */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-1">备份说明：</p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>备份包含数据库、配置文件和用户数据</li>
            <li>建议定期下载备份到本地或远程存储</li>
            <li>恢复操作会覆盖当前数据，请谨慎操作</li>
            <li>恢复后系统将自动重启</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* 备份列表 */}
      <Card className="flex-1 min-h-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">备份列表</CardTitle>
            <CardDescription>显示 {backups.length} 个备份</CardDescription>
          </div>
          <Button onClick={handleManualBackup} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                备份中...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                立即备份
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-4 pt-0">
          <DataTable
            columns={columns}
            data={backups}
            toolbar={(table) => (
              <DataTableToolbar
                table={table}
                searchKey="filename"
                searchPlaceholder="搜索备份文件名..."
                filters={[
                  {
                    column: "type",
                    title: "类型",
                    options: [
                      { label: "自动", value: "auto", icon: Database },
                      { label: "手动", value: "manual", icon: FileArchive },
                    ],
                  },
                  {
                    column: "status",
                    title: "状态",
                    options: [
                      { label: "成功", value: "success", icon: CheckCircle },
                      { label: "失败", value: "failed", icon: AlertTriangle },
                    ],
                  },
                ]}
                onRefresh={handleRefresh}
                showRefresh={true}
              />
            )}
          />
        </CardContent>
      </Card>

      {/* 恢复确认对话框 */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认恢复备份</DialogTitle>
            <DialogDescription>此操作将覆盖当前所有数据，请谨慎操作</DialogDescription>
          </DialogHeader>
          {selectedBackup && (
            <div className="space-y-3 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">警告：此操作不可撤销！</p>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>将使用备份数据覆盖当前系统数据</li>
                    <li>所有未备份的最新数据将丢失</li>
                    <li>系统将在恢复完成后自动重启</li>
                    <li>恢复过程中请勿关闭或刷新页面</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">备份信息：</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• 文件名：{selectedBackup.filename}</p>
                  <p>• 大小：{selectedBackup.size}</p>
                  <p>• 创建时间：{selectedBackup.createdAt}</p>
                  <p>• 备份类型：{typeLabels[selectedBackup.type]}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestoreDialogOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleRestore} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在恢复...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  确认恢复
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
