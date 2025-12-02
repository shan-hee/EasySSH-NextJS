"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
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
  const t = useTranslations("settingsManagementBackup")
  const [loading, setLoading] = useState<string | null>(null)

  // 导出配置文件
  const handleExportConfig = async () => {
    try {
      setLoading("export-config")
      toast.info(t("toastExportConfigLoading"))

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

      toast.success(t("toastExportConfigSuccess"))
    } catch (error) {
      console.error("Failed to export config:", error)
      toast.error(t("toastExportConfigFailed"))
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
        toast.info(t("toastImportConfigLoading"))

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

        toast.success(t("toastImportConfigSuccess"))
      } catch (error) {
        console.error("Failed to import config:", error)
        toast.error(t("toastImportConfigFailed"))
      } finally {
        setLoading(null)
      }
    }
    input.click()
  }

  // 导出数据库
  const handleExportDatabase = async () => {
    if (!confirm(t("confirmExportDb"))) {
      return
    }

    try {
      setLoading("export-db")
      toast.info(t("toastExportDbLoading"))

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

      toast.success(t("toastExportDbSuccess"))
    } catch (error) {
      console.error("Failed to export database:", error)
      toast.error(t("toastExportDbFailed"))
    } finally {
      setLoading(null)
    }
  }

  // 导入数据库
  const handleImportDatabase = async () => {
    if (!confirm(t("confirmImportDb"))) {
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
        toast.info(t("toastImportDbLoading"))

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

        toast.success(t("toastImportDbSuccess"))
      } catch (error) {
        console.error("Failed to import database:", error)
        toast.error(t("toastImportDbFailed"))
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
          <p className="font-medium mb-2">{t("alertTitle")}</p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>{t("alertItemConfig")}</li>
            <li>{t("alertItemDatabase")}</li>
            <li>{t("alertItemImportWarning")}</li>
            <li>{t("alertItemSuggestion")}</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 配置文件管理 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <CardTitle>{t("cardConfigTitle")}</CardTitle>
            </div>
            <CardDescription>{t("cardConfigDescription")}</CardDescription>
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
                  {t("btnExportConfigLoading")}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t("btnExportConfig")}
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
                  {t("btnImportConfigLoading")}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("btnImportConfig")}
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground pt-2">
              <p>{t("configHintFormats")}</p>
              <p>{t("configHintContent")}</p>
            </div>
          </CardContent>
        </Card>

        {/* 数据库管理 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-green-500" />
              <CardTitle>{t("cardDbTitle")}</CardTitle>
            </div>
            <CardDescription>{t("cardDbDescription")}</CardDescription>
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
                  {t("btnExportDbLoading")}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t("btnExportDb")}
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
                  {t("btnImportDbLoading")}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("btnImportDb")}
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground pt-2">
              <p>{t("dbHintFormats")}</p>
              <p>{t("dbHintContent")}</p>
              <p className="text-destructive">{t("dbHintWarning")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
