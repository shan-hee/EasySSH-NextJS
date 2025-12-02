"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
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
import { type IntegrationsConfigFormData } from "@/schemas/settings/integrations.schema"

interface AIProviderTabProps {
  form: UseFormReturn<IntegrationsConfigFormData>
  isAdmin?: boolean
}

export function AIProviderTab({ form, isAdmin = false }: AIProviderTabProps) {
  const tAI = useTranslations("settingsIntegrationsAI")
  const tCommon = useTranslations("common")
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const useSystemConfig = form.watch("use_system_config")
  const provider = form.watch("provider")

  const handleTestConnection = async () => {
    setIsTesting(true)
    // 模拟测试连接
    setTimeout(() => {
      setIsTesting(false)
      alert(tAI("btnTestConnection"))
    }, 1500)
  }

  const providerOptions = [
    { label: tAI("providerOpenAI"), value: "openai" },
    { label: tAI("providerAnthropic"), value: "anthropic" },
    { label: tAI("providerAzure"), value: "azure" },
    { label: tAI("providerCustom"), value: "custom" },
  ]

  return (
    <div className="space-y-4">
      {/* 系统配置（仅管理员可见） */}
      {isAdmin && (
        <>
          <SettingsSection
            title={tAI("sectionTitle")}
            description={tAI("sectionDescription")}
            icon={<Bot className="h-5 w-5" />}
          >
            <FormSwitch
              form={form}
              name="system_enabled"
              label={tAI("fieldSystemEnabledLabel")}
              description={tAI("fieldSystemEnabledDesc")}
            />

            {form.watch("system_enabled") && (
              <>
                <div className="space-y-2">
                  <Label>{tAI("fieldProviderLabel")}</Label>
                  <Select
                    value={form.watch("system_provider")}
                    onValueChange={(val) => form.setValue("system_provider", val as "openai" | "anthropic" | "azure" | "custom")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tAI("fieldProviderPlaceholder")} />
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
                  label={tAI("fieldApiEndpointLabel")}
                  description={tAI("fieldApiEndpointDesc")}
                  type="url"
                  placeholder="https://api.openai.com/v1"
                />

                <FormInput
                  form={form}
                  name="system_default_model"
                  label={tAI("fieldDefaultModelLabel")}
                  placeholder="gpt-4"
                />

                <FormInput
                  form={form}
                  name="system_rate_limit"
                  label={tAI("fieldRateLimitLabel")}
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
        title={tAI("personalSectionTitle")}
        description={tAI("personalSectionDescription")}
        icon={<Zap className="h-5 w-5" />}
      >
        {isAdmin && (
          <FormSwitch
            form={form}
            name="use_system_config"
            label={tAI("fieldUseSystemConfigLabel")}
            description={tAI("fieldUseSystemConfigDesc")}
          />
        )}

        {!useSystemConfig && (
          <>
            <div className="space-y-2">
              <Label>{tAI("fieldPersonalProviderLabel")}</Label>
              <Select
                value={provider}
                onValueChange={(val) => form.setValue("provider", val as "openai" | "anthropic" | "azure" | "custom")}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={tAI("fieldPersonalProviderPlaceholder")}
                  />
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
              <Label htmlFor="api_key">
                {tAI("fieldPersonalApiKeyLabel")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="api_key"
                  type={showApiKey ? "text" : "password"}
                  placeholder={tAI("fieldPersonalApiKeyPlaceholder")}
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
              label={tAI("fieldPersonalApiEndpointLabel")}
              description={tAI("fieldPersonalApiEndpointDesc")}
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
              label={tAI("fieldPreferredModelLabel")}
              description={tAI("fieldPreferredModelDesc")}
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
                  {tAI("btnTestConnectionTesting")}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  {tAI("btnTestConnection")}
                </>
              )}
            </Button>
          </>
        )}

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            {useSystemConfig ? (
              <span>{tAI("alertUsingSystemConfig")}</span>
            ) : (
              <span>
                {tAI("alertUsingPersonalConfig")}
              </span>
            )}
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">
            {tAI("providerHelpTitle")}
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              • <strong>OpenAI:</strong> {tAI("providerHelpOpenAI")}
            </li>
            <li>
              • <strong>Anthropic:</strong> {tAI("providerHelpAnthropic")}
            </li>
            <li>
              • <strong>Azure OpenAI:</strong> {tAI("providerHelpAzure")}
            </li>
            <li>
              • <strong>{tAI("providerCustom")}:</strong>{" "}
              {tAI("providerHelpCustom")}
            </li>
          </ul>
        </div>
      </SettingsSection>
    </div>
  )
}
