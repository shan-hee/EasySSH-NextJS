"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { Command, Package, Database, Save, Loader2, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { completionSchema } from "@/schemas/settings/system-config.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function CompletionTab() {
  const t = useTranslations("settingsSystemCompletion")
  const tCommon = useTranslations("common")
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: completionSchema,
    loadFn: async () => {
      const data = await settingsApi.getSystemConfig()
      return {
        completion_enabled: data.completion_enabled,
        completion_providers: data.completion_providers,
        completion_quotas: data.completion_quotas,
        completion_cache: data.completion_cache,
      }
    },
    saveFn: async (data) => {
      const fullConfig = await settingsApi.getSystemConfig()
      const updatedConfig = {
        ...fullConfig,
        ...data,
      }
      await settingsApi.saveSystemConfig(updatedConfig)
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }
  const completionEnabled = form.watch("completion_enabled")
  const providers = form.watch("completion_providers")
  const quotas = form.watch("completion_quotas")
  const cache = form.watch("completion_cache")

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* 可滚动内容区 - flex-1 + min-h-0 确保正确收缩 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-4">
        <div className="space-y-4">
          {/* 补全功能总开关 */}
          <SettingsSection
        title={t("sectionMainTitle")}
        description={t("sectionMainDescription")}
        icon={<Command className="h-5 w-5" />}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="completion_enabled">{t("fieldEnabledLabel")}</Label>
            <p className="text-sm text-muted-foreground">{t("fieldEnabledDesc")}</p>
          </div>
          <Switch
            id="completion_enabled"
            checked={completionEnabled}
            onCheckedChange={(checked) => form.setValue("completion_enabled", checked)}
          />
        </div>

        {!completionEnabled && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              {t("disabledAlert")}
            </AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      {/* 补全提供者和配额配置 */}
      {completionEnabled && (
        <SettingsSection
          title={t("sectionProvidersTitle")}
          description={t("sectionProvidersDescription")}
          icon={<Package className="h-5 w-5" />}
        >
          <div className="space-y-4">
            {/* 本地命令库 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="provider_local" className="text-base font-medium">
                    {t("providerLocalTitle")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("providerLocalDesc")}
                  </p>
                </div>
                <Switch
                  id="provider_local"
                  checked={providers?.local ?? true}
                  onCheckedChange={(checked) =>
                    form.setValue("completion_providers.local", checked)
                  }
                />
              </div>
              {providers?.local && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16">{t("labelMin")}</span>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[quotas?.local_min ?? 1]}
                      onValueChange={(value) =>
                        form.setValue("completion_quotas.local_min", value[0])
                      }
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {quotas?.local_min ?? 1} 项
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16">{t("labelMax")}</span>
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[quotas?.local_max ?? 3]}
                      onValueChange={(value) =>
                        form.setValue("completion_quotas.local_max", value[0])
                      }
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {quotas?.local_max ?? 3} 项
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 脚本库 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="provider_script" className="text-base font-medium">
                    {t("providerScriptTitle")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("providerScriptDesc")}
                  </p>
                </div>
                <Switch
                  id="provider_script"
                  checked={providers?.script ?? true}
                  onCheckedChange={(checked) =>
                    form.setValue("completion_providers.script", checked)
                  }
                />
              </div>
              {providers?.script && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16">{t("labelMin")}</span>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[quotas?.script_min ?? 0]}
                      onValueChange={(value) =>
                        form.setValue("completion_quotas.script_min", value[0])
                      }
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {quotas?.script_min ?? 0} 项
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16">{t("labelMax")}</span>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[quotas?.script_max ?? 2]}
                      onValueChange={(value) =>
                        form.setValue("completion_quotas.script_max", value[0])
                      }
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {quotas?.script_max ?? 2} 项
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 会话历史 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="provider_session" className="text-base font-medium">
                    {t("providerSessionTitle")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("providerSessionDesc")}
                  </p>
                </div>
                <Switch
                  id="provider_session"
                  checked={providers?.session ?? true}
                  onCheckedChange={(checked) =>
                    form.setValue("completion_providers.session", checked)
                  }
                />
              </div>
              {providers?.session && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16">{t("labelMin")}</span>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[quotas?.session_min ?? 0]}
                      onValueChange={(value) =>
                        form.setValue("completion_quotas.session_min", value[0])
                      }
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {quotas?.session_min ?? 0} 项
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-16">{t("labelMax")}</span>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[quotas?.session_max ?? 2]}
                      onValueChange={(value) =>
                        form.setValue("completion_quotas.session_max", value[0])
                      }
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-muted-foreground">
                      {quotas?.session_max ?? 2} 项
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 远端历史命令 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="provider_remote_history" className="text-base font-medium">
                    {t("providerRemoteHistoryTitle")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("providerRemoteHistoryDesc")}
                  </p>
                </div>
                <Switch
                  id="provider_remote_history"
                  checked={providers?.remote_history ?? true}
                  onCheckedChange={(checked) =>
                    form.setValue("completion_providers.remote_history", checked)
                  }
                />
              </div>
              {providers?.remote_history && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="remote_history_unlimited" className="text-sm">
                        {t("labelUnlimitedMode")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t("labelUnlimitedModeDesc")}
                      </p>
                    </div>
                    <Switch
                      id="remote_history_unlimited"
                      checked={quotas?.remote_history_unlimited ?? true}
                      onCheckedChange={(checked) =>
                        form.setValue("completion_quotas.remote_history_unlimited", checked)
                      }
                    />
                  </div>
                  {quotas?.remote_history_unlimited && (
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-16">
                        {t("labelSoftLimit")}
                      </span>
                      <Slider
                        min={1}
                        max={20}
                        step={1}
                        value={[quotas?.remote_history_soft_max ?? 7]}
                        onValueChange={(value) =>
                          form.setValue("completion_quotas.remote_history_soft_max", value[0])
                        }
                        className="flex-1"
                      />
                      <span className="w-12 text-sm text-muted-foreground">
                        {quotas?.remote_history_soft_max ?? 7} 项
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                {t("quotaHint")}
              </AlertDescription>
            </Alert>
          </div>
        </SettingsSection>
      )}

      {/* 缓存设置 */}
      {completionEnabled && (
        <SettingsSection
          title={t("sectionCacheTitle")}
          description={t("sectionCacheDescription")}
          icon={<Database className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cache_ttl">{t("fieldCacheTtl")}</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="cache_ttl"
                  min={1}
                  max={60}
                  step={1}
                  value={[cache?.ttl_minutes ?? 5]}
                  onValueChange={(value) =>
                    form.setValue("completion_cache.ttl_minutes", value[0])
                  }
                  className="flex-1"
                />
                <span className="w-16 text-sm text-muted-foreground">
                  {cache?.ttl_minutes ?? 5}
                  {t("fieldCacheTtlSuffix")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("fieldCacheTtlDesc")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cache_max">{t("fieldCacheMax")}</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="cache_max"
                  min={10}
                  max={1000}
                  step={10}
                  value={[cache?.max_entries ?? 100]}
                  onValueChange={(value) =>
                    form.setValue("completion_cache.max_entries", value[0])
                  }
                  className="flex-1"
                />
                <span className="w-16 text-sm text-muted-foreground">
                  {cache?.max_entries ?? 100}
                  {t("fieldCacheMaxSuffix")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("fieldCacheMaxDesc")}
              </p>
            </div>
          </div>
        </SettingsSection>
      )}

          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              {t("finalAlert")}
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* 固定底部按钮区 - shrink-0 防止被压缩 */}
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
