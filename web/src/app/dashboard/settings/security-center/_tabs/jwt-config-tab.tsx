"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput } from "@/components/settings/form-field"
import { Key } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { type SecurityConfigFormData } from "@/schemas/settings/security.schema"

interface JWTConfigTabProps {
  form: UseFormReturn<SecurityConfigFormData>
}

export function JWTConfigTab({ form }: JWTConfigTabProps) {
  const accessExpire = form.watch("access_token_expire_minutes")
  const refreshExpire = form.watch("refresh_token_expire_days")

  return (
    <SettingsSection
      title="JWT 认证配置"
      description="配置 JSON Web Token 的过期时间"
      icon={<Key className="h-5 w-5" />}
    >
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          修改 JWT 配置需要重启服务才能生效！修改后所有用户需要重新登录。
        </AlertDescription>
      </Alert>

      <FormInput
        form={form}
        name="access_token_expire_minutes"
        label="访问令牌过期时间（小时）"
        description="用户访问令牌（Access Token）的有效期 (1-168小时，即1小时-7天)"
        type="number"
        min={1}
        max={168}
        step={1}
        required
      />

      <FormInput
        form={form}
        name="refresh_token_expire_days"
        label="刷新令牌过期时间（小时）"
        description="刷新令牌（Refresh Token）的有效期 (24-720小时，即1天-30天)"
        type="number"
        min={24}
        max={720}
        step={24}
        required
      />

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">当前配置说明：</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">访问令牌（Access Token）：</p>
            <p>
              当前设置为 <span className="font-semibold text-foreground">{accessExpire ?? 0}</span>{" "}
              小时，即{" "}
              <span className="font-semibold text-foreground">
                {(accessExpire ?? 0) < 24
                  ? `${accessExpire ?? 0} 小时`
                  : `${Math.floor((accessExpire ?? 0) / 24)} 天${
                      (accessExpire ?? 0) % 24 > 0 ? ` ${(accessExpire ?? 0) % 24} 小时` : ""
                    }`}
              </span>
              。用于日常API请求的身份验证。
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">刷新令牌（Refresh Token）：</p>
            <p>
              当前设置为 <span className="font-semibold text-foreground">{refreshExpire ?? 0}</span>{" "}
              小时，即{" "}
              <span className="font-semibold text-foreground">
                {Math.floor((refreshExpire ?? 0) / 24)} 天
                {(refreshExpire ?? 0) % 24 > 0 ? ` ${(refreshExpire ?? 0) % 24} 小时` : ""}
              </span>
              。用于获取新的访问令牌。
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">推荐配置：</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">高安全性场景：</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>访问令牌：1-4 小时</li>
              <li>刷新令牌：24-72 小时（1-3 天）</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">平衡场景（推荐）：</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>访问令牌：24 小时（1 天）</li>
              <li>刷新令牌：168 小时（7 天）</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">便利性优先：</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>访问令牌：72-168 小时（3-7 天）</li>
              <li>刷新令牌：720 小时（30 天）</li>
            </ul>
          </div>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-1">注意事项：</p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>刷新令牌过期时间必须大于访问令牌过期时间</li>
            <li>过短的过期时间会影响用户体验（频繁重新登录）</li>
            <li>过长的过期时间会降低系统安全性</li>
            <li>修改配置后需要重启后端服务</li>
          </ul>
        </AlertDescription>
      </Alert>
    </SettingsSection>
  )
}
