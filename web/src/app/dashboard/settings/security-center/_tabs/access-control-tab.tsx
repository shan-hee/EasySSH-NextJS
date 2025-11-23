"use client"

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
        title="IP访问控制"
        description="配置允许或禁止访问的IP地址范围"
        icon={<Shield className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allowlist_ips">IP白名单 (允许访问)</Label>
            <Textarea
              id="allowlist_ips"
              placeholder="输入允许访问的IP地址,每行一个,支持CIDR格式&#10;例如: 192.168.1.0/24"
              value={form.watch("allowlist_ips") || ""}
              onChange={(e) => form.setValue("allowlist_ips", e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              留空表示允许所有IP访问。支持单个IP或CIDR格式,每行一个。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blocklist_ips">IP黑名单 (禁止访问)</Label>
            <Textarea
              id="blocklist_ips"
              placeholder="输入禁止访问的IP地址,每行一个,支持CIDR格式&#10;例如: 10.0.0.0/8"
              value={form.watch("blocklist_ips") || ""}
              onChange={(e) => form.setValue("blocklist_ips", e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              黑名单优先级高于白名单。支持单个IP或CIDR格式,每行一个。
            </p>
          </div>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            IP访问控制会影响所有用户的访问权限。建议仅在必要时启用,并定期审查配置。
          </AlertDescription>
        </Alert>
      </SettingsSection>

      {/* 保存按钮区域 */}
      <div className="flex justify-end gap-2 pt-6 pb-16 mt-6">
        <Button variant="outline" onClick={reload} disabled={isSaving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重置
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
