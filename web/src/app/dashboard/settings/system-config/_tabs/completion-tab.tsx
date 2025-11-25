"use client"

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
    <div className="space-y-4">
      {/* 补全功能总开关 */}
      <SettingsSection
        title="补全功能"
        description="配置终端命令补全的全局行为"
        icon={<Command className="h-5 w-5" />}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="completion_enabled">启用命令补全</Label>
            <p className="text-sm text-muted-foreground">
              全局启用或禁用终端命令补全功能
            </p>
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
              补全功能已禁用。启用后,用户可以在终端中使用 Tab 键触发命令补全。
            </AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      {/* 补全提供者和配额配置 */}
      {completionEnabled && (
        <SettingsSection
          title="补全提供者与配额"
          description="配置补全数据来源及其在结果中的数量限制"
          icon={<Package className="h-5 w-5" />}
        >
          <div className="space-y-4">
            {/* 本地命令库 */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="provider_local" className="text-base font-medium">本地命令库</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    内置 200+ 常用 Linux/Unix 命令和子命令
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
                    <span className="text-sm text-muted-foreground w-16">最少</span>
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
                    <span className="text-sm text-muted-foreground w-16">最多</span>
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
                  <Label htmlFor="provider_script" className="text-base font-medium">脚本库</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    从用户保存的脚本库中提供补全建议
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
                    <span className="text-sm text-muted-foreground w-16">最少</span>
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
                    <span className="text-sm text-muted-foreground w-16">最多</span>
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
                  <Label htmlFor="provider_session" className="text-base font-medium">会话历史</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    从当前会话的命令历史中提供补全建议
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
                    <span className="text-sm text-muted-foreground w-16">最少</span>
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
                    <span className="text-sm text-muted-foreground w-16">最多</span>
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
                  <Label htmlFor="provider_remote_history" className="text-base font-medium">远端历史命令</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    从服务器的 Shell 历史文件中获取补全建议
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
                      <Label htmlFor="remote_history_unlimited" className="text-sm">无限制模式</Label>
                      <p className="text-xs text-muted-foreground">
                        允许填充剩余的补全位置
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
                      <span className="text-sm text-muted-foreground w-16">软上限</span>
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
                配额分配确保不同来源的补全结果均衡显示。“最少”保证该来源至少显示的数量，“最多”限制该来源最多显示的数量。
              </AlertDescription>
            </Alert>
          </div>
        </SettingsSection>
      )}

      {/* 缓存设置 */}
      {completionEnabled && (
        <SettingsSection
          title="缓存设置"
          description="配置补全结果的缓存策略以提升性能"
          icon={<Database className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cache_ttl">缓存有效期</Label>
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
                  {cache?.ttl_minutes ?? 5} 分钟
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                补全结果在缓存中保留的时间
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cache_max">最大缓存数</Label>
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
                  {cache?.max_entries ?? 100} 条
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                最多缓存的补全结果数量,超出后使用 LRU 策略淘汰
              </p>
            </div>
          </div>
        </SettingsSection>
      )}

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          这些是全局补全配置。用户可以在终端设置中进一步自定义触发方式、显示数量等个性化选项。
        </AlertDescription>
      </Alert>

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
