"use client"

import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { aiProviderSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { AIProviderTab } from "./ai-provider-tab"
import { SettingsLoading } from "@/components/settings/settings-loading"
import { Button } from "@/components/ui/button"
import { Save, Loader2, RotateCcw } from "lucide-react"

interface AIProviderWrapperProps {
  isAdmin?: boolean
}

export function AIProviderWrapper({ isAdmin = false }: AIProviderWrapperProps = {}) {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: aiProviderSchema,
    loadFn: async () => {
      // 并行获取 AI 系统配置和用户配置
      const [systemConfig, userConfig] = await Promise.all([
        settingsApi.getAISystemConfig(),
        settingsApi.getAIUserConfig(),
      ])
      return {
        ...systemConfig,
        ...userConfig,
      }
    },
    saveFn: async (data) => {
      // 分别保存系统配置和用户配置
      await Promise.all([
        settingsApi.saveAISystemConfig({
          system_enabled: data.system_enabled,
          system_provider: data.system_provider,
          system_api_endpoint: data.system_api_endpoint,
          system_default_model: data.system_default_model,
          system_rate_limit: data.system_rate_limit,
        }),
        settingsApi.saveAIUserConfig({
          use_system_config: data.use_system_config,
          provider: data.provider,
          api_key: data.api_key,
          api_endpoint: data.api_endpoint,
          preferred_model: data.preferred_model,
        }),
      ])
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
      <AIProviderTab form={form} isAdmin={isAdmin} />

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
