"use client"

import { useTranslations } from "next-intl"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { integrationsConfigSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsSection } from "@/components/settings/settings-section"
import { SettingsLoading } from "@/components/settings/settings-loading"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Save, Loader2, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

export function AIConfigWrapper() {
  const t = useTranslations("settingsIntegrationsAI")
  const tCommon = useTranslations("common")

  const providerOptions = [
    { label: t("providerOpenAI"), value: "openai" },
    { label: t("providerAnthropic"), value: "anthropic" },
    { label: t("providerAzure"), value: "azure" },
    { label: t("providerCustom"), value: "custom" },
  ]
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: integrationsConfigSchema,
    loadFn: async () => {
      // 只获取 AI 系统配置
      const systemConfig = await settingsApi.getAISystemConfig()
      return systemConfig
    },
    saveFn: async (data) => {
      // 只保存系统配置
      await settingsApi.saveAISystemConfig({
        system_enabled: data.system_enabled,
        system_provider: data.system_provider,
        system_api_endpoint: data.system_api_endpoint,
        system_default_model: data.system_default_model,
        system_rate_limit: data.system_rate_limit,
      })
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
      {/* 系统配置 */}
      <SettingsSection
        title={t("sectionTitle")}
        description={t("sectionDescription")}
        icon={<Bot className="h-5 w-5" />}
      >
        <FormSwitch
          form={form}
          name="system_enabled"
          label={t("fieldSystemEnabledLabel")}
          description={t("fieldSystemEnabledDesc")}
        />

        {form.watch("system_enabled") && (
          <>
            <div className="space-y-2">
              <Label>{t("fieldProviderLabel")}</Label>
              <Select
                value={form.watch("system_provider")}
                onValueChange={(val) => form.setValue("system_provider", val as "openai" | "anthropic" | "azure" | "custom")}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("fieldProviderPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FormInput
              form={form}
              name="system_api_endpoint"
              label={t("fieldApiEndpointLabel")}
              description={t("fieldApiEndpointDesc")}
              type="url"
              placeholder="https://api.openai.com/v1"
            />

            <FormInput
              form={form}
              name="system_default_model"
              label={t("fieldDefaultModelLabel")}
              placeholder="gpt-4"
            />

            <FormInput
              form={form}
              name="system_rate_limit"
              label={t("fieldRateLimitLabel")}
              type="number"
              min={1}
              max={1000}
            />
          </>
        )}

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            {t("alertDescription")}
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
