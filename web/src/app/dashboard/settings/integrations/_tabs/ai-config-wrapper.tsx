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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Save, Loader2, RotateCcw, Plus, X, Search, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { toast } from "sonner"

export function AIConfigWrapper() {
  const t = useTranslations("settingsIntegrationsAI")
  const tCommon = useTranslations("common")
  const [modelInput, setModelInput] = useState("")
  const [isProbingModels, setIsProbingModels] = useState(false)

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

  // 将逗号分隔字符串解析为数组
  const getModelsArray = (): string[] => {
    const raw = form.watch("system_models") || ""
    return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
  }

  const setModelsFromArray = (models: string[]) => {
    form.setValue("system_models", models.join(","), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const addModel = () => {
    if (!modelInput.trim()) return
    const current = getModelsArray()
    if (!current.includes(modelInput.trim())) {
      setModelsFromArray([...current, modelInput.trim()])
    }
    setModelInput("")
  }

  const removeModel = (model: string) => {
    setModelsFromArray(getModelsArray().filter((m) => m !== model))
  }

  const handleProbeModels = async () => {
    setIsProbingModels(true)
    try {
      const response = await settingsApi.probeAISystemModels({
        system_provider: form.getValues("system_provider"),
        system_api_key: form.getValues("system_api_key")?.trim() || "",
        system_api_endpoint: form.getValues("system_api_endpoint")?.trim() || "",
      })
      const probed = Array.from(
        new Set(
          (response.models || []).map((m) => m.trim()).filter((m) => m.length > 0),
        ),
      )
      if (probed.length > 0) {
        // 合并到现有标签，去重
        const current = getModelsArray()
        const merged = Array.from(new Set([...current, ...probed]))
        setModelsFromArray(merged)
        toast.success(t("probeModelsSuccess", { count: probed.length }))
      } else {
        toast.info(response.message || t("noDetectedModels"))
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("probeModelsFailed")
      toast.error(msg)
    } finally {
      setIsProbingModels(false)
    }
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t("fieldModelsLabel")}</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto py-0.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleProbeModels}
                        disabled={isProbingModels || isSaving}
                      >
                        {isProbingModels ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            {t("probingModels")}
                          </>
                        ) : (
                          <>
                            <Search className="mr-1 h-3 w-3" />
                            {t("probeModels")}
                          </>
                        )}
                      </Button>
                      {getModelsArray().length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto py-0.5 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => setModelsFromArray([])}
                          disabled={isSaving}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {t("clearModels")}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("fieldModelsPlaceholder")}
                      value={modelInput}
                      onChange={(e) => setModelInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addModel())}
                    />
                    <Button type="button" onClick={addModel} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getModelsArray().map((model) => (
                      <Badge key={model} variant="secondary" className="gap-1">
                        {model}
                        <button
                          onClick={() => removeModel(model)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("fieldModelsDesc")}
                  </p>
                </div>
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
