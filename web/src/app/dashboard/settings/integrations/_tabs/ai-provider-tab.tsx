"use client"

import { useState } from "react"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Eye, EyeOff, Zap } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"

type AIProviderFormValues = {
  use_system_config?: boolean
  system_enabled?: boolean
  system_provider?: string
  system_api_endpoint?: string
  system_default_model?: string
  system_rate_limit?: number
  provider?: string
  api_key?: string
  api_endpoint?: string
  default_model?: string
}

interface AIProviderTabProps {
  form: UseFormReturn<AIProviderFormValues>
  isAdmin?: boolean
}

const providerOptions = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic (Claude)", value: "anthropic" },
  { label: "Azure OpenAI", value: "azure" },
  { label: "自定义", value: "custom" },
]

export function AIProviderTab({ form, isAdmin = false }: AIProviderTabProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const useSystemConfig = form.watch("use_system_config")
  const provider = form.watch("provider")

  const handleTestConnection = async () => {
    setIsTesting(true)
    // 模拟测试连接
    setTimeout(() => {
      setIsTesting(false)
      alert("连接测试成功！")
    }, 1500)
  }

  return (
    <div className="space-y-6">
      {/* 系统配置（仅管理员可见） */}
      {isAdmin && (
        <>
          <SettingsSection
            title="系统配置（管理员）"
            description="配置全局AI服务，供所有用户使用"
            icon={<Bot className="h-5 w-5" />}
          >
            <FormSwitch
              form={form}
              name="system_enabled"
              label="启用系统AI服务"
              description="开启后，所有用户可使用系统配置的AI服务"
            />

            {form.watch("system_enabled") && (
              <>
                <div className="space-y-2">
                  <Label>AI服务提供商</Label>
                  <Select
                    value={form.watch("system_provider")}
                    onValueChange={(val) => form.setValue("system_provider", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择提供商" />
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
                  label="API端点"
                  description="AI服务的API地址"
                  type="url"
                  placeholder="https://api.openai.com/v1"
                />

                <FormInput
                  form={form}
                  name="system_default_model"
                  label="默认模型"
                  placeholder="gpt-4"
                />

                <FormInput
                  form={form}
                  name="system_rate_limit"
                  label="速率限制（请求/分钟）"
                  type="number"
                  min={1}
                  max={1000}
                />
              </>
            )}
          </SettingsSection>

          <Separator />
        </>
      )}

      {/* 个人API配置 */}
      <SettingsSection
        title="个人API配置"
        description="配置您自己的AI服务API密钥"
        icon={<Zap className="h-5 w-5" />}
      >
        {isAdmin && (
          <FormSwitch
            form={form}
            name="use_system_config"
            label="使用系统配置"
            description="开启后将使用管理员配置的系统AI服务"
          />
        )}

        {!useSystemConfig && (
          <>
            <div className="space-y-2">
              <Label>AI服务提供商 *</Label>
              <Select
                value={provider}
                onValueChange={(val) => form.setValue("provider", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择提供商" />
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

            <div className="space-y-2">
              <Label htmlFor="api_key">API密钥 *</Label>
              <div className="flex gap-2">
                <Input
                  id="api_key"
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk-..."
                  {...form.register("api_key")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {form.formState.errors.api_key && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.api_key.message as string}
                </p>
              )}
            </div>

            <FormInput
              form={form}
              name="api_endpoint"
              label="API端点"
              description="自定义API地址（可选）"
              type="url"
              placeholder={
                provider === "openai"
                  ? "https://api.openai.com/v1"
                  : provider === "anthropic"
                  ? "https://api.anthropic.com"
                  : "https://your-api-endpoint.com"
              }
            />

            <FormInput
              form={form}
              name="preferred_model"
              label="偏好模型"
              description="您希望使用的AI模型"
              placeholder={
                provider === "openai"
                  ? "gpt-4, gpt-3.5-turbo"
                  : provider === "anthropic"
                  ? "claude-3-opus, claude-3-sonnet"
                  : "your-model-name"
              }
              required
            />

            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Zap className="mr-2 h-4 w-4 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  测试连接
                </>
              )}
            </Button>
          </>
        )}

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            {useSystemConfig ? (
              <span>您正在使用系统配置的AI服务。如需使用自己的API，请关闭&ldquo;使用系统配置&rdquo;选项。</span>
            ) : (
              <span>
                API密钥将加密存储。不同的AI服务提供商有不同的定价策略，请根据您的需求选择合适的服务。
              </span>
            )}
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">提供商说明：</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>OpenAI:</strong> GPT-4, GPT-3.5 等模型</li>
            <li>• <strong>Anthropic:</strong> Claude 3 系列模型</li>
            <li>• <strong>Azure OpenAI:</strong> 微软Azure托管的OpenAI服务</li>
            <li>• <strong>自定义:</strong> 兼容OpenAI API格式的第三方服务</li>
          </ul>
        </div>
      </SettingsSection>
    </div>
  )
}
