"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Clock, Save, Loader2, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { sessionManagementSchema } from "@/schemas/settings/security.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function SessionManagementTab() {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: sessionManagementSchema,
    loadFn: async () => {
      const data = await settingsApi.getTabSessionConfig()
      return {
        session_timeout: data.session_timeout,
        max_tabs: data.max_tabs,
        inactive_minutes: data.inactive_minutes,
        remember_login: data.remember_login,
        hibernate: data.hibernate,
      }
    },
    saveFn: async (data) => {
      await settingsApi.saveTabSessionConfig(data)
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  const sessionTimeout = form.watch("session_timeout")
  const maxTabs = form.watch("max_tabs")

  return (
    <div className="space-y-4">
      <SettingsSection
        title="会话管理"
        description="配置用户会话和标签页管理策略"
        icon={<Clock className="h-5 w-5" />}
      >
        <FormInput
          form={form}
          name="session_timeout"
          label="会话超时时间（分钟）"
          description="用户无操作后自动退出的时间 (5-1440分钟)"
          type="number"
          min={5}
          max={1440}
          step={5}
          required
        />

        <FormInput
          form={form}
          name="max_tabs"
          label="最大标签页数"
          description="同一用户允许打开的最大标签页数量 (1-200)"
          type="number"
          min={1}
          max={200}
          step={1}
          required
        />

        <FormInput
          form={form}
          name="inactive_minutes"
          label="非活动断开提醒（分钟）"
          description="用户在标签页非活动状态下的提醒时间 (5-1440分钟)"
          type="number"
          min={5}
          max={1440}
          step={5}
          required
        />

        <FormSwitch
          form={form}
          name="remember_login"
          label="记住登录状态"
          description="允许用户选择记住登录状态，下次访问自动登录"
        />

        <FormSwitch
          form={form}
          name="hibernate"
          label="后台标签页休眠"
          description="启用后，后台标签页将自动休眠以节省资源"
        />

        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">当前配置预览：</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              • 用户在 <span className="font-semibold text-foreground">{sessionTimeout}</span>{" "}
              分钟无操作后将自动退出
            </p>
            <p>
              • 每个用户最多可同时打开{" "}
              <span className="font-semibold text-foreground">{maxTabs}</span> 个标签页
            </p>
            <p>
              • 记住登录状态：
              <span className="font-semibold text-foreground">
                {form.watch("remember_login") ? "已启用" : "已禁用"}
              </span>
            </p>
            <p>
              • 后台休眠：
              <span className="font-semibold text-foreground">
                {form.watch("hibernate") ? "已启用" : "已禁用"}
              </span>
            </p>
          </div>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            会话管理配置会影响所有用户的登录体验。建议根据实际使用场景合理设置超时时间，既要保证安全性，也要兼顾用户体验。
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
