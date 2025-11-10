"use client"

import { useState } from "react"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput } from "@/components/settings/form-field"
import { Globe, Shield, Plus, X } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

interface NetworkSecurityTabProps {
  form: UseFormReturn<any>
}

export function NetworkSecurityTab({ form }: NetworkSecurityTabProps) {
  const [newOrigin, setNewOrigin] = useState("")
  const [newMethod, setNewMethod] = useState("")
  const [newHeader, setNewHeader] = useState("")

  const allowedOrigins = form.watch("allowed_origins") || []
  const allowedMethods = form.watch("allowed_methods") || []
  const allowedHeaders = form.watch("allowed_headers") || []

  const handleAddOrigin = () => {
    if (!newOrigin.trim()) return
    const current = form.getValues("allowed_origins") || []
    if (!current.includes(newOrigin.trim())) {
      form.setValue("allowed_origins", [...current, newOrigin.trim()])
      setNewOrigin("")
    }
  }

  const handleRemoveOrigin = (origin: string) => {
    const current = form.getValues("allowed_origins") || []
    form.setValue(
      "allowed_origins",
      current.filter((o: string) => o !== origin)
    )
  }

  const handleAddMethod = () => {
    if (!newMethod.trim()) return
    const current = form.getValues("allowed_methods") || []
    const method = newMethod.trim().toUpperCase()
    if (!current.includes(method)) {
      form.setValue("allowed_methods", [...current, method])
      setNewMethod("")
    }
  }

  const handleRemoveMethod = (method: string) => {
    const current = form.getValues("allowed_methods") || []
    form.setValue(
      "allowed_methods",
      current.filter((m: string) => m !== method)
    )
  }

  const handleAddHeader = () => {
    if (!newHeader.trim()) return
    const current = form.getValues("allowed_headers") || []
    if (!current.includes(newHeader.trim())) {
      form.setValue("allowed_headers", [...current, newHeader.trim()])
      setNewHeader("")
    }
  }

  const handleRemoveHeader = (header: string) => {
    const current = form.getValues("allowed_headers") || []
    form.setValue(
      "allowed_headers",
      current.filter((h: string) => h !== header)
    )
  }

  const addCommonMethods = () => {
    const commonMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    form.setValue("allowed_methods", commonMethods)
  }

  const addCommonHeaders = () => {
    const commonHeaders = [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ]
    form.setValue("allowed_headers", commonHeaders)
  }

  return (
    <div className="space-y-6">
      {/* CORS 配置 */}
      <SettingsSection
        title="CORS 跨域配置"
        description="配置跨域资源共享（CORS）策略"
        icon={<Globe className="h-5 w-5" />}
      >
        {/* 允许的域名 */}
        <div className="space-y-2">
          <Label>允许的域名</Label>
          <p className="text-sm text-muted-foreground">
            配置允许跨域访问的域名列表（支持通配符 *）
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={newOrigin}
              onChange={(e) => setNewOrigin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddOrigin()
                }
              }}
            />
            <Button onClick={handleAddOrigin} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {allowedOrigins.map((origin: string) => (
              <Badge key={origin} variant="secondary" className="gap-1">
                {origin}
                <button
                  onClick={() => handleRemoveOrigin(origin)}
                  className="ml-1 hover:bg-destructive/20 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* 允许的 HTTP 方法 */}
        <div className="space-y-2">
          <Label>允许的 HTTP 方法</Label>
          <p className="text-sm text-muted-foreground">
            配置允许的 HTTP 请求方法
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="GET, POST, PUT..."
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddMethod()
                }
              }}
            />
            <Button onClick={handleAddMethod} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
            <Button onClick={addCommonMethods} variant="outline" size="sm">
              常用方法
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {allowedMethods.map((method: string) => (
              <Badge key={method} variant="secondary" className="gap-1">
                {method}
                <button
                  onClick={() => handleRemoveMethod(method)}
                  className="ml-1 hover:bg-destructive/20 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* 允许的请求头 */}
        <div className="space-y-2">
          <Label>允许的请求头</Label>
          <p className="text-sm text-muted-foreground">
            配置允许的 HTTP 请求头
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Content-Type, Authorization..."
              value={newHeader}
              onChange={(e) => setNewHeader(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddHeader()
                }
              }}
            />
            <Button onClick={handleAddHeader} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
            <Button onClick={addCommonHeaders} variant="outline" size="sm">
              常用请求头
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {allowedHeaders.map((header: string) => (
              <Badge key={header} variant="secondary" className="gap-1">
                {header}
                <button
                  onClick={() => handleRemoveHeader(header)}
                  className="ml-1 hover:bg-destructive/20 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            CORS 配置不当可能导致前端无法正常访问 API。建议在开发环境使用宽松配置，生产环境严格限制域名。
          </AlertDescription>
        </Alert>
      </SettingsSection>

      <Separator />

      {/* 速率限制配置 */}
      <SettingsSection
        title="速率限制"
        description="配置 API 请求速率限制，防止恶意攻击"
        icon={<Shield className="h-5 w-5" />}
      >
        <FormInput
          form={form}
          name="login_limit"
          label="登录速率限制（次/分钟）"
          description="同一 IP 地址每分钟允许的最大登录尝试次数 (1-100)"
          type="number"
          min={1}
          max={100}
          step={1}
          required
        />

        <FormInput
          form={form}
          name="api_limit"
          label="API 速率限制（次/分钟）"
          description="同一用户每分钟允许的最大 API 请求次数 (10-10000)"
          type="number"
          min={10}
          max={10000}
          step={10}
          required
        />

        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">推荐配置：</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>登录速率限制：3-10 次/分钟（防止暴力破解）</li>
            <li>API 速率限制：100-1000 次/分钟（根据实际业务调整）</li>
            <li>超出限制后，系统将返回 429 Too Many Requests 错误</li>
          </ul>
        </div>
      </SettingsSection>
    </div>
  )
}
