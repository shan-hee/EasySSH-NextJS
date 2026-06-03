"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/sonner"
import { SettingsSection } from "@/components/settings/settings-section"
import { getErrorMessage } from "@/lib/error-utils"
import { logsApi } from "@/lib/api/logs"

export function LogManagementTab() {
  const t = useTranslations("settingsManagementLogs")
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [retentionDays, setRetentionDays] = useState("90")

  const handleCleanupLogs = async () => {
    const parsedRetentionDays = Number(retentionDays)
    if (!Number.isInteger(parsedRetentionDays) || parsedRetentionDays < 1 || parsedRetentionDays > 3650) {
      toast.error(t("cleanupInvalidRetention"))
      return
    }

    try {
      setCleanupLoading(true)
      const result = await logsApi.cleanup(parsedRetentionDays)
      toast.success(t("cleanupSuccess", { count: result.deleted_count }))
      setCleanupOpen(false)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("cleanupFailed")))
    } finally {
      setCleanupLoading(false)
    }
  }

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-auto px-4 pb-6 pt-0 md:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <SettingsSection
          title={t("sectionTitle")}
          description={t("sectionDescription")}
          icon={<Trash2 className="h-5 w-5 text-muted-foreground" />}
        >
          <Alert className="py-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t("cleanupWarning")}</AlertDescription>
          </Alert>

          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b p-4 sm:p-5">
              <CardTitle className="text-base">{t("cleanupCardTitle")}</CardTitle>
              <CardDescription>{t("cleanupCardDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 sm:p-5">
              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="audit-log-retention-days">{t("cleanupRetentionLabel")}</Label>
                <Input
                  id="audit-log-retention-days"
                  type="number"
                  min={1}
                  max={3650}
                  value={retentionDays}
                  disabled={cleanupLoading}
                  onChange={(event) => setRetentionDays(event.target.value)}
                />
                <p className="text-sm text-muted-foreground">{t("cleanupRetentionHint")}</p>
              </div>

              <div className="flex justify-start">
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={cleanupLoading}
                  onClick={() => setCleanupOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("cleanupButton")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </SettingsSection>

        <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("cleanupDialogTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("cleanupDialogDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cleanupLoading}>{t("cleanupCancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={cleanupLoading}
                onClick={(event) => {
                  event.preventDefault()
                  void handleCleanupLogs()
                }}
              >
                {cleanupLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("cleanupRunning")}
                  </>
                ) : t("cleanupConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
