"use client"

import * as React from "react"
import { Activity, AlertTriangle, CheckCircle, Loader2, RefreshCw, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useOptionalSshWorkspace } from "@/components/ssh-workspace/ssh-workspace"
import type { WorkspaceActivityLogItem } from "@/lib/session/workspace"
import { useTranslations } from "next-intl"

function formatCreatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export function ActivityLogPane({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("logsAudit")
  const workspace = useOptionalSshWorkspace()
  const adapter = workspace?.adapters.activityLog
  const enabled = workspace?.capabilities.activityLog !== false && !!adapter
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<WorkspaceActivityLogItem[]>([])
  const actionLabels = React.useMemo(() => ({
    ssh_connect: t("actionConnect"),
    ssh_disconnect: t("actionDisconnect"),
    sftp_upload: t("actionUpload"),
    sftp_download: t("actionDownload"),
    sftp_delete: t("actionDelete"),
    sftp_rename: t("actionRename"),
    sftp_mkdir: t("actionMkdir"),
    monitoring_query: t("actionMonitoringQuery"),
  }), [t])

  const loadItems = React.useCallback(async () => {
    if (!adapter) {
      return
    }
    try {
      setLoading(true)
      const result = await adapter.list({ page: 1, limit: 8 })
      setItems(result.items)
    } finally {
      setLoading(false)
    }
  }, [adapter])

  React.useEffect(() => {
    if (open) {
      void loadItems()
    }
  }, [loadItems, open])

  if (!enabled) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "h-7 w-7 rounded-md" : "h-8 w-8"}
          title={t("activityPageTitle")}
          aria-label={t("activityPageTitle")}
        >
          <Activity className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-medium">{t("activityPageTitle")}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => void loadItems()}
            disabled={loading}
            title={t("refresh")}
            aria-label={t("refresh")}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && items.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              {t("activityEmpty")}
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.id} className="rounded-md px-2 py-2 hover:bg-muted">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-medium">
                      {actionLabels[item.action as keyof typeof actionLabels] || item.action}
                    </div>
                    <Badge variant="outline" className="shrink-0 gap-1">
                      {item.status === "success" ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : item.status === "warning" ? (
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-600" />
                      )}
                      {item.status === "success"
                        ? t("filterStatusSuccessLabel")
                        : item.status === "warning"
                          ? t("filterStatusWarningLabel")
                          : t("filterStatusFailureLabel")}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground" title={item.resource}>
                    {item.resource || "-"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatCreatedAt(item.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
