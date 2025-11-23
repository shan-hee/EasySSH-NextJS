"use client"

import { useState } from "react"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput } from "@/components/settings/form-field"
import { Globe, Shield, Zap, Save, Loader2, RotateCcw, Plus, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { networkSecurityFullSchema } from "@/schemas/settings/security.schema"
import { settingsApi } from "@/lib/api/settings"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function NetworkSecurityTab() {
  // 统一的表单管理
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: networkSecurityFullSchema,
    loadFn: async () => {
      // 加载 CORS 和速率限制配置
      const [corsData, rateLimitData] = await Promise.all([
        settingsApi.getCORSConfig(),
        settingsApi.getRateLimitConfig(),
      ])

      return {
        // CORS 配置
        allowed_origins: corsData.allowed_origins || ["*"],
        allowed_methods: corsData.allowed_methods || ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowed_headers: corsData.allowed_headers || ["*"],
        // 速率限制配置
        login_limit: rateLimitData.login_limit || 5,
        api_limit: rateLimitData.api_limit || 100,
      }
    },
    saveFn: async (data) => {
      // 分别保存 CORS 和速率限制配置
      await Promise.all([
        settingsApi.saveCORSConfig({
          allowed_origins: data.allowed_origins,
          allowed_methods: data.allowed_methods,
          allowed_headers: data.allowed_headers,
        }),
        settingsApi.saveRateLimitConfig({
          login_limit: data.login_limit,
          api_limit: data.api_limit,
        }),
      ])
    },
  })

  // CORS 输入状态
  const [originInput, setOriginInput] = useState("")
  const [methodInput, setMethodInput] = useState("")
  const [headerInput, setHeaderInput] = useState("")

  // 添加CORS项
  const addOrigin = () => {
    if (!originInput.trim()) return
    const current = form.watch("allowed_origins") || []
    if (!current.includes(originInput.trim())) {
      form.setValue("allowed_origins", [...current, originInput.trim()])
    }
    setOriginInput("")
  }

  const addMethod = () => {
    if (!methodInput.trim()) return
    const current = form.watch("allowed_methods") || []
    if (!current.includes(methodInput.trim().toUpperCase())) {
      form.setValue("allowed_methods", [...current, methodInput.trim().toUpperCase()])
    }
    setMethodInput("")
  }

  const addHeader = () => {
    if (!headerInput.trim()) return
    const current = form.watch("allowed_headers") || []
    if (!current.includes(headerInput.trim())) {
      form.setValue("allowed_headers", [...current, headerInput.trim()])
    }
    setHeaderInput("")
  }

  // 删除CORS项
  const removeOrigin = (origin: string) => {
    const current = form.watch("allowed_origins") || []
    form.setValue(
      "allowed_origins",
      current.filter((o) => o !== origin)
    )
  }

  const removeMethod = (method: string) => {
    const current = form.watch("allowed_methods") || []
    form.setValue(
      "allowed_methods",
      current.filter((m) => m !== method)
    )
  }

  const removeHeader = (header: string) => {
    const current = form.watch("allowed_headers") || []
    form.setValue(
      "allowed_headers",
      current.filter((h) => h !== header)
    )
  }

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
      {/* CORS配置 */}
      <SettingsSection
        title="CORS跨域配置"
        description="配置跨域资源共享(CORS)策略"
        icon={<Globe className="h-5 w-5" />}
      >
        <div className="space-y-4">
          {/* 允许的源 */}
          <div className="space-y-3">
            <Label>允许的源 (Origins)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入域名,例如: https://example.com"
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addOrigin()}
              />
              <Button onClick={addOrigin} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.watch("allowed_origins") || []).map((origin) => (
                <Badge key={origin} variant="secondary" className="gap-1">
                  {origin}
                  <button
                    onClick={() => removeOrigin(origin)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              使用 * 表示允许所有源(不推荐用于生产环境)
            </p>
          </div>

          {/* 允许的方法 */}
          <div className="space-y-3">
            <Label>允许的HTTP方法 (Methods)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入HTTP方法,例如: GET, POST"
                value={methodInput}
                onChange={(e) => setMethodInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMethod()}
              />
              <Button onClick={addMethod} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.watch("allowed_methods") || []).map((method) => (
                <Badge key={method} variant="secondary" className="gap-1">
                  {method}
                  <button
                    onClick={() => removeMethod(method)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              常用方法: GET, POST, PUT, DELETE, PATCH, OPTIONS
            </p>
          </div>

          {/* 允许的请求头 */}
          <div className="space-y-3">
            <Label>允许的请求头 (Headers)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入请求头,例如: Content-Type"
                value={headerInput}
                onChange={(e) => setHeaderInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHeader()}
              />
              <Button onClick={addHeader} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.watch("allowed_headers") || []).map((header) => (
                <Badge key={header} variant="secondary" className="gap-1">
                  {header}
                  <button
                    onClick={() => removeHeader(header)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              使用 * 表示允许所有请求头。常用: Content-Type, Authorization, X-Requested-With
            </p>
          </div>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            CORS配置会影响前端应用的跨域请求。请根据实际需求配置,避免过于宽松的设置。
          </AlertDescription>
        </Alert>
      </SettingsSection>

      {/* 速率限制配置 */}
      <SettingsSection
        title="速率限制"
        description="配置API和登录请求的速率限制"
        icon={<Zap className="h-5 w-5" />}
      >
        <FormInput
          form={form}
          name="login_limit"
          label="登录速率限制 (次/分钟)"
          description="每个IP地址每分钟允许的登录尝试次数 (1-100)"
          type="number"
          min={1}
          max={100}
          step={1}
          required
        />

        <FormInput
          form={form}
          name="api_limit"
          label="API速率限制 (次/分钟)"
          description="每个用户每分钟允许的API请求次数 (10-10000)"
          type="number"
          min={10}
          max={10000}
          step={10}
          required
        />

        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">当前配置预览:</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              • 每个IP每分钟最多尝试登录{" "}
              <span className="font-semibold text-foreground">
                {form.watch("login_limit")}
              </span>{" "}
              次
            </p>
            <p>
              • 每个用户每分钟最多发起{" "}
              <span className="font-semibold text-foreground">
                {form.watch("api_limit")}
              </span>{" "}
              次API请求
            </p>
          </div>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            速率限制可以有效防止暴力破解和API滥用。建议根据实际使用情况合理设置限制值。
          </AlertDescription>
        </Alert>
      </SettingsSection>

      {/* 统一的保存按钮区域 */}
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
