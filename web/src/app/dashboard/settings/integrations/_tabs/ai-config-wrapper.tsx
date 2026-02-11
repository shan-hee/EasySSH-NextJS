"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { aiSystemConfigSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsSection } from "@/components/settings/settings-section"
import { SettingsLoading } from "@/components/settings/settings-loading"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Save, Loader2, RotateCcw, Search } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { toast } from "sonner"

function getProbeErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail
    if (typeof detail === "string" && detail.trim()) {
      return detail
    }
    if (typeof detail === "object" && detail !== null) {
      const details = detail as { error?: string; message?: string }
      if (details.error && details.error.trim()) {
        return details.error
      }
      if (details.message && details.message.trim()) {
        return details.message
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function AIConfigWrapper() {
  const t = useTranslations("settingsIntegrationsAI")
  const tCommon = useTranslations("common")
  const [isProbingModels, setIsProbingModels] = useState(false)
  const [detectedModels, setDetectedModels] = useState<string[]>([])

  const providerOptions = [
    { label: t("providerOpenAI"), value: "openai" },
    { label: t("providerAnthropic"), value: "anthropic" },
  ]

  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: aiSystemConfigSchema,
    loadFn: async () => {
      const systemConfig = await settingsApi.getAISystemConfig()
      return systemConfig
    },
    saveFn: async (data) => {
      await settingsApi.saveAISystemConfig({
        system_enabled: data.system_enabled,
        system_provider: data.system_provider,
        system_api_key: data.system_api_key,
        system_api_endpoint: data.system_api_endpoint,
        system_models: data.system_models,
      })
    },
  })

  const handleProbeModels = async () => {
    setIsProbingModels(true)

    try {
      const response = await settingsApi.probeAISystemModels({
        system_provider: form.getValues("system_provider"),
        system_api_key: form.getValues("system_api_key")?.trim() || "",
        system_api_endpoint: form.getValues("system_api_endpoint")?.trim() || "",
      })

      const normalizedModels = Array.from(
        new Set(
          (response.models || [])
            .map((model) => model.trim())
            .filter((model) => model.length > 0),
        ),
      )

      setDetectedModels(normalizedModels)

      if (normalizedModels.length > 0) {
        toast.success(t("probeModelsSuccess", { count: normalizedModels.length }))
      } else {
        toast.info(response.message || t("noDetectedModels"))
      }
    } catch (error) {
      toast.error(getProbeErrorMessage(error, t("probeModelsFailed")))
    } finally {
      setIsProbingModels(false)
    }
  }

  const handleApplyDetectedModels = () => {
    if (detectedModels.length === 0) {
      toast.info(t("noDetectedModels"))
      return
    }

    form.setValue("system_models", detectedModels.join(","), {
      shouldDirty: true,
      shouldValidate: true,
    })

    toast.success(t("applyDetectedModelsSuccess", { count: detectedModels.length }))
  }

  const handleReload = async () => {
    await reload()
    setDetectedModels([])
  }

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-4">
        <div className="space-y-4">
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
                    onValueChange={(val) =>
                      form.setValue(
                        "system_provider",
                        val as "openai" | "anthropic",
                      )
                    }
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
                  name="system_api_key"
                  label={t("fieldApiKeyLabel")}
                  description={form.watch("has_api_key") ? t("fieldApiKeyDescConfigured") : t("fieldApiKeyDesc")}
                  type="password"
                  placeholder={form.watch("has_api_key") ? "••••••••••••••••" : t("fieldApiKeyPlaceholder")}
                />

                <FormInput
                  form={form}
                  name="system_models"
                  label={t("fieldModelsLabel")}
                  description={`${t("fieldModelsDesc")} ${t("manualModelInputHint")}`}
                  placeholder="gpt-4,gpt-3.5-turbo,claude-3-opus"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleProbeModels}
                    disabled={isSaving || isProbingModels}
                  >
                    {isProbingModels ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("probingModels")}
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        {t("probeModels")}
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleApplyDetectedModels}
                    disabled={isSaving || detectedModels.length === 0}
                  >
                    {t("applyDetectedModels")}
                  </Button>
                </div>

                {detectedModels.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("detectedModelsLabel")}: {detectedModels.join(", ")}
                  </p>
                )}
              </>
            )}

            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                {t("alertDescription")}
              </AlertDescription>
            </Alert>
          </SettingsSection>
        </div>
      </div>

      <div className="shrink-0 flex justify-end gap-2 p-4 bg-background">
        <Button variant="outline" onClick={handleReload} disabled={isSaving || isProbingModels}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {tCommon("reset")}
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isProbingModels}>
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
