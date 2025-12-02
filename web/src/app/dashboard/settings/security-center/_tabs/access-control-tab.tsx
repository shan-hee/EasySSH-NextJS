"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { Shield, Save, Loader2, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { networkSecuritySchema } from "@/schemas/settings/security.schema"
import { settingsApi } from "@/lib/api/settings"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function AccessControlTab() {
  const t = useTranslations("settingsSecurityAccess")
  const tCommon = useTranslations("common")
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: networkSecuritySchema,
    loadFn: async () => {
      const config = await settingsApi.getIPWhitelistConfig()
      return {
        allowlist_ips: config.allowlist_ips || "",
        blocklist_ips: config.blocklist_ips || "",
      }
    },
    saveFn: async (data) => {
      await settingsApi.saveIPWhitelistConfig({
        allowlist_ips: data.allowlist_ips,
        blocklist_ips: data.blocklist_ips,
      })
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
      {/* IP白名单/黑名单配置 */}
      <SettingsSection
        title={t("sectionTitle")}
        description={t("sectionDescription")}
        icon={<Shield className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allowlist_ips">{t("labelAllowlist")}</Label>
            <Textarea
              id="allowlist_ips"
              placeholder={t("placeholderAllowlist")}
              value={form.watch("allowlist_ips") || ""}
              onChange={(e) => form.setValue("allowlist_ips", e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {t("helperAllowlist")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blocklist_ips">{t("labelBlocklist")}</Label>
            <Textarea
              id="blocklist_ips"
              placeholder={t("placeholderBlocklist")}
              value={form.watch("blocklist_ips") || ""}
              onChange={(e) => form.setValue("blocklist_ips", e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {t("helperBlocklist")}
            </p>
          </div>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            {t("alertContent")}
          </AlertDescription>
        </Alert>
      </SettingsSection>

      {/* 保存按钮区域 */}
      <div className="flex justify-end gap-2 pt-6 pb-16 mt-6">
        <Button variant="outline" onClick={reload} disabled={isSaving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {tCommon("reset")}
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tCommon("saving")}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {tCommon("save")}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
