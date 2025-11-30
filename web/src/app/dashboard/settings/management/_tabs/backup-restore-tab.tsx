"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Download,
  Upload,
  Loader2,
  AlertTriangle,
  FileText,
  HardDrive,
} from "lucide-react"
import { toast } from "sonner"
import { getApiUrl } from "@/lib/config"
import { getCurrentAccessToken } from "@/stores/auth-store"

export function BackupRestoreTab() {
  const [loading, setLoading] = useState<string | null>(null)

  // 导出配置文件
  const handleExportConfig = async () => {
    try {
      setLoading("export-config")
      toast.info("正在导出配置文件...")

      const apiUrl = getApiUrl()
      const url = `${apiUrl}/backup/export-config`

      // 使用原生 fetch 以支持 blob 响应，通过 Cookie 认证
      const headers: HeadersInit = {}
      const token = getCurrentAccessToken()
      if (token) {
        ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        headers,
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      // 下载文件
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `config_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast.success("配置文件导出成功")
    } catch (error) {
      console.error("Failed to export config:", error)
      toast.error("导出配置文件失败")
    } finally {
      setLoading(null)
    }
  }

  // 导入配置文件
  const handleImportConfig = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json,.yaml,.yml"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        setLoading("import-config")
        toast.info("正在导入配置文件...")

        const formData = new FormData()
        formData.append("file", file)

        const apiUrl = getApiUrl()
        const url = `${apiUrl}/backup/import-config`

        const headers: HeadersInit = {}
        const token = getCurrentAccessToken()
        if (token) {
          ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
        }

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Import failed")
        }

        toast.success("配置文件导入成功")
      } catch (error) {
        console.error("Failed to import config:", error)
        toast.error("导入配置文件失败")
      } finally {
        setLoading(null)
      }
    }
    input.click()
  }

  // 导出数据库
  const handleExportDatabase = async () => {
    if (!confirm("确定要导出数据库吗？此操作可能需要几分钟时间。")) {
      return
    }

    try {
      setLoading("export-db")
      toast.info("正在导出数据库...")

      const apiUrl = getApiUrl()
      const url = `${apiUrl}/backup/export-database`

      const headers: HeadersInit = {}
      const token = getCurrentAccessToken()
      if (token) {
        ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        headers,
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      // 下载文件
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `database_${new Date().toISOString().slice(0, 10)}.sql`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast.success("数据库导出成功")
    } catch (error) {
      console.error("Failed to export database:", error)
      toast.error("导出数据库失败")
    } finally {
      setLoading(null)
    }
  }

  // 导入数据库
  const handleImportDatabase = async () => {
    if (!confirm("警告：导入数据库将覆盖当前所有数据！确定要继续吗？")) {
      return
    }

    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".sql,.gz,.zip"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        setLoading("import-db")
        toast.info("正在导入数据库...")

        const formData = new FormData()
        formData.append("file", file)

        const apiUrl = getApiUrl()
        const url = `${apiUrl}/backup/import-database`

        const headers: HeadersInit = {}
        const token = getCurrentAccessToken()
        if (token) {
          ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
        }

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Import failed")
        }

        toast.success("数据库导入成功，系统将在5秒后重启...")
      } catch (error) {
        console.error("Failed to import database:", error)
        toast.error("导入数据库失败")
      } finally {
        setLoading(null)
      }
    }
    input.click()
  }

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col gap-6 p-4 pt-0 overflow-auto">
      {/* 警告说明 */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">重要提示：</p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>导出的配置文件包含系统设置、用户配置等信息</li>
            <li>导出的数据库包含所有业务数据</li>
            <li>导入操作会覆盖现有数据，请谨慎操作</li>
            <li>建议定期导出备份到安全位置</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 配置文件管理 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <CardTitle>配置文件</CardTitle>
            </div>
            <CardDescription>导入或导出系统配置文件</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExportConfig}
              disabled={loading !== null}
            >
              {loading === "export-config" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  导出配置文件
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleImportConfig}
              disabled={loading !== null}
            >
              {loading === "import-config" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  导入配置文件
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground pt-2">
              <p>• 支持格式：JSON, YAML</p>
              <p>• 包含：系统设置、通知配置、安全配置等</p>
            </div>
          </CardContent>
        </Card>

        {/* 数据库管理 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-green-500" />
              <CardTitle>数据库</CardTitle>
            </div>
            <CardDescription>导入或导出完整数据库</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExportDatabase}
              disabled={loading !== null}
            >
              {loading === "export-db" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  导出数据库
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleImportDatabase}
              disabled={loading !== null}
            >
              {loading === "import-db" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  导入数据库
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground pt-2">
              <p>• 支持格式：SQL, SQL.GZ, ZIP</p>
              <p>• 包含：所有服务器、用户、日志等数据</p>
              <p className="text-destructive">• 导入会覆盖现有数据！</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
