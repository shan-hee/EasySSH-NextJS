"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  AlertTriangle,
  ArchiveRestore,
  Database,
  Download,
  FileCog,
  Loader2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { getApiUrl } from "@/lib/config"
import { getCurrentAccessToken } from "@/stores/auth-store"

type BackupContent = "config" | "database"
type ConflictStrategy = "skip" | "overwrite" | "error"
type BackupTranslationKey =
  | "contentConfigTitle"
  | "contentConfigDescription"
  | "contentDatabaseTitle"
  | "contentDatabaseDescription"
type ConflictTranslationKey =
  | "conflictSkipTitle"
  | "conflictSkipDescription"
  | "conflictOverwriteTitle"
  | "conflictOverwriteDescription"
  | "conflictErrorTitle"
  | "conflictErrorDescription"

type BackupTranslator = (key: BackupTranslationKey) => string

const contentOptions: Array<{
  value: BackupContent
  icon: typeof FileCog
  titleKey: BackupTranslationKey
  descriptionKey: BackupTranslationKey
}> = [
  {
    value: "config",
    icon: FileCog,
    titleKey: "contentConfigTitle",
    descriptionKey: "contentConfigDescription",
  },
  {
    value: "database",
    icon: Database,
    titleKey: "contentDatabaseTitle",
    descriptionKey: "contentDatabaseDescription",
  },
]

const conflictOptions: Array<{
  value: ConflictStrategy
  titleKey: ConflictTranslationKey
  descriptionKey: ConflictTranslationKey
}> = [
  {
    value: "skip",
    titleKey: "conflictSkipTitle",
    descriptionKey: "conflictSkipDescription",
  },
  {
    value: "overwrite",
    titleKey: "conflictOverwriteTitle",
    descriptionKey: "conflictOverwriteDescription",
  },
  {
    value: "error",
    titleKey: "conflictErrorTitle",
    descriptionKey: "conflictErrorDescription",
  },
]

export function BackupRestoreTab() {
  const t = useTranslations("settingsManagementBackup")
  const { confirm: requestConfirm, confirmDialog } = useConfirmDialog()
  const restoreFileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState<"export" | "restore" | null>(null)
  const [exportContent, setExportContent] = useState<Record<BackupContent, boolean>>({
    config: true,
    database: true,
  })
  const [restoreContent, setRestoreContent] = useState<Record<BackupContent, boolean>>({
    config: true,
    database: true,
  })
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>("skip")

  const exportSelected = exportContent.config || exportContent.database
  const restoreSelected = restoreContent.config || restoreContent.database

  const authHeaders = () => {
    const headers: HeadersInit = {}
    const token = getCurrentAccessToken()
    if (token) {
      ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
    }
    return headers
  }

  const toggleExportContent = (value: BackupContent, checked: boolean) => {
    setExportContent((current) => ({
      ...current,
      [value]: checked,
    }))
  }

  const toggleRestoreContent = (value: BackupContent, checked: boolean) => {
    setRestoreContent((current) => ({
      ...current,
      [value]: checked,
    }))
  }

  const handleExport = async () => {
    if (!exportSelected) {
      toast.error(t("toastSelectExportContent"))
      return
    }

    try {
      setLoading("export")
      toast.info(t("toastExportLoading"))

      const params = new URLSearchParams({
        include_config: String(exportContent.config),
        include_database: String(exportContent.database),
      })
      const response = await fetch(`${getApiUrl()}/backup/export?${params.toString()}`, {
        headers: authHeaders(),
      })

      if (!response.ok) {
        const detail = await readErrorMessage(response)
        throw new Error(detail || "Export failed")
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = getDownloadFilename(response) || `easyssh_backup_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast.success(t("toastExportSuccess"))
    } catch (error) {
      console.error("Failed to export backup:", error)
      toast.error(error instanceof Error ? error.message : t("toastExportFailed"))
    } finally {
      setLoading(null)
    }
  }

  const handleRestoreClick = async () => {
    if (!restoreSelected) {
      toast.error(t("toastSelectRestoreContent"))
      return
    }
    if (conflictStrategy === "overwrite") {
      const confirmed = await requestConfirm({
        description: t("confirmOverwriteRestore"),
      })
      if (!confirmed) {
        return
      }
    }
    restoreFileInputRef.current?.click()
  }

  const handleRestoreFile = async (file: File) => {
    try {
      setLoading("restore")
      toast.info(t("toastRestoreLoading"))

      const formData = new FormData()
      formData.append("file", file)
      formData.append("include_config", String(restoreContent.config))
      formData.append("include_database", String(restoreContent.database))
      formData.append("conflict_strategy", conflictStrategy)

      const response = await fetch(`${getApiUrl()}/backup/restore`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      })

      if (!response.ok) {
        const detail = await readErrorMessage(response)
        throw new Error(detail || "Restore failed")
      }

      toast.success(t("toastRestoreSuccess"))
    } catch (error) {
      console.error("Failed to restore backup:", error)
      toast.error(error instanceof Error ? error.message : t("toastRestoreFailed"))
    } finally {
      setLoading(null)
      if (restoreFileInputRef.current) {
        restoreFileInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-auto px-4 pb-6 pt-0 md:px-6">
      {confirmDialog}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <Alert className="py-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="font-medium">{t("alertTitle")}</span>
              {t("alertItemUnified")}
            </span>
            <span className="text-muted-foreground">{t("alertItemSensitive")}</span>
          </AlertDescription>
        </Alert>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-base">{t("exportTitle")}</CardTitle>
              </div>
              <CardDescription>{t("exportDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ContentSelector
                idPrefix="export"
                options={contentOptions}
                values={exportContent}
                onChange={toggleExportContent}
                disabled={loading !== null}
                t={t}
              />

              <div className="space-y-3 border-t pt-4">
                <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                  <p>{t("exportHintFormat")}</p>
                  <p>{t("exportHintContent")}</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    className="w-full sm:w-auto sm:min-w-36"
                    onClick={handleExport}
                    disabled={loading !== null || !exportSelected}
                  >
                    {loading === "export" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("btnExportLoading")}
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        {t("btnExport")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex items-center gap-2">
                <ArchiveRestore className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">{t("restoreTitle")}</CardTitle>
              </div>
              <CardDescription>{t("restoreDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ContentSelector
                idPrefix="restore"
                options={contentOptions}
                values={restoreContent}
                onChange={toggleRestoreContent}
                disabled={loading !== null}
                t={t}
              />

              <div className="space-y-3 border-t pt-4">
                <div>
                  <Label className="text-sm font-medium">{t("conflictStrategyLabel")}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{t("conflictStrategyDescription")}</p>
                </div>
                <RadioGroup
                  value={conflictStrategy}
                  onValueChange={(value) => setConflictStrategy(value as ConflictStrategy)}
                  className="grid gap-2"
                  disabled={loading !== null}
                >
                  {conflictOptions.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`conflict-${option.value}`}
                      className="flex min-h-[58px] cursor-pointer items-start gap-3 rounded-md border bg-background/40 p-3 transition-colors hover:bg-muted/50"
                    >
                      <RadioGroupItem
                        id={`conflict-${option.value}`}
                        value={option.value}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 space-y-1">
                        <span className="block text-sm font-medium leading-none">{t(option.titleKey)}</span>
                        <span className="block text-xs font-normal leading-5 text-muted-foreground">
                          {t(option.descriptionKey)}
                        </span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <input
                ref={restoreFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleRestoreFile(file)
                  }
                }}
              />

              <div className="space-y-3 border-t pt-4">
                <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                  <p>{t("restoreHintFormat")}</p>
                  <p className="text-destructive">{t("restoreHintWarning")}</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant={conflictStrategy === "overwrite" ? "destructive" : "outline"}
                    className="w-full sm:w-auto sm:min-w-44"
                    onClick={handleRestoreClick}
                    disabled={loading !== null || !restoreSelected}
                  >
                    {loading === "restore" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("btnRestoreLoading")}
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {t("btnRestore")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ContentSelector({
  idPrefix,
  options,
  values,
  onChange,
  disabled,
  t,
}: {
  idPrefix: string
  options: typeof contentOptions
  values: Record<BackupContent, boolean>
  onChange: (value: BackupContent, checked: boolean) => void
  disabled: boolean
  t: BackupTranslator
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
      {options.map((option) => {
        const Icon = option.icon
        const inputId = `${idPrefix}-backup-content-${option.value}`
        return (
          <Label
            key={option.value}
            htmlFor={inputId}
            className="flex min-h-[74px] cursor-pointer items-start gap-3 rounded-md border bg-background/40 p-3 transition-colors hover:bg-muted/50"
          >
            <Checkbox
              id={inputId}
              checked={values[option.value]}
              disabled={disabled}
              onCheckedChange={(checked) => onChange(option.value, checked === true)}
              className="mt-0.5"
            />
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 space-y-1">
              <span className="block text-sm font-medium leading-none">{t(option.titleKey)}</span>
              <span className="block text-xs font-normal leading-5 text-muted-foreground">
                {t(option.descriptionKey)}
              </span>
            </span>
          </Label>
        )
      })}
    </div>
  )
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json()
    if (typeof data?.detail === "string") return data.detail
    if (typeof data?.error === "string") return data.error
  } catch {
    return ""
  }
  return ""
}

function getDownloadFilename(response: Response) {
  const disposition = response.headers.get("content-disposition")
  if (!disposition) return ""

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match?.[1] || ""
}
