"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch, FormSelect } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Webhook, Send } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { useSettingsAPI } from "@/hooks/settings/use-settings-api"
import { settingsApi } from "@/lib/api/settings"
import { toast } from "sonner"

interface WebhookNotificationTabProps {
  form: UseFormReturn<any>
}

const methodOptions = [
  { label: "POST", value: "POST" },
  { label: "GET", value: "GET" },
]

export function WebhookNotificationTab({ form }: WebhookNotificationTabProps) {
  const { execute: testConnection, isLoading: isTesting } = useSettingsAPI()
  const enabled = form.watch("enabled")

  const handleTestWebhook = async () => {
    const data = form.getValues()
    const config = {
      enabled: data.enabled,
      url: data.url,
      method: data.method,
      secret: data.secret || "",
    }

    await testConnection(async (token) => {
      await settingsApi.testWebhookConnection(token, config)
      toast.success("测试请求发送成功！请检查您的Webhook端点。")
    })
  }

  return (
    <SettingsSection
      title="Webhook通知配置"
      description="配置自定义Webhook接收系统通知"
      icon={<Webhook className="h-5 w-5" />}
    >
      <FormSwitch
        form={form}
        name="enabled"
        label="启用Webhook通知"
        description="开启后系统将向配置的URL发送HTTP请求通知"
      />

      {enabled && (
        <>
          <FormInput
            form={form}
            name="url"
            label="Webhook URL"
            description="接收通知的HTTP端点地址"
            type="url"
            placeholder="https://your-domain.com/webhook/easyssh"
            required
          />

          <FormSelect
            form={form}
            name="method"
            label="请求方法"
            description="发送Webhook请求使用的HTTP方法"
            options={methodOptions}
            required
          />

          <FormInput
            form={form}
            name="secret"
            label="签名密钥（可选）"
            description="用于验证请求来源的密钥，将包含在请求头 X-Webhook-Signature 中"
            type="password"
            placeholder="your-secret-key"
          />

          <Button
            type="button"
            variant="outline"
            onClick={handleTestWebhook}
            disabled={isTesting}
          >
            {isTesting ? (
              <>
                <Send className="mr-2 h-4 w-4 animate-pulse" />
                发送中...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                发送测试请求
              </>
            )}
          </Button>

          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              测试请求将发送到配置的Webhook URL。请确保您的端点能够接收HTTP请求。
            </AlertDescription>
          </Alert>
        </>
      )}

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">Webhook请求格式：</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">请求头（Headers）：</p>
            <ul className="list-disc list-inside ml-2 font-mono text-xs">
              <li>Content-Type: application/json</li>
              <li>User-Agent: EasySSH-Webhook/1.0</li>
              <li>X-Webhook-Signature: [签名，如配置了密钥]</li>
              <li>X-Event-Type: [事件类型]</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">请求体（Body）示例：</p>
            <pre className="bg-background p-2 rounded text-xs overflow-x-auto mt-1">
{`{
  "event": "server.status.changed",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "server_id": 123,
    "server_name": "Production Server",
    "status": "online",
    "message": "服务器已成功连接"
  }
}`}
            </pre>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">签名验证（如配置了密钥）：</p>
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">签名使用 HMAC-SHA256 算法生成：</p>
          <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`signature = HMAC_SHA256(secret, request_body)
X-Webhook-Signature: sha256={signature}`}
          </pre>
          <p className="mt-2">验证示例（Node.js）：</p>
          <pre className="bg-background p-2 rounded text-xs overflow-x-auto mt-1">
{`const crypto = require('crypto');
const signature = req.headers['x-webhook-signature'];
const hash = crypto
  .createHmac('sha256', secret)
  .update(req.body)
  .digest('hex');
const expected = 'sha256=' + hash;
const isValid = signature === expected;`}
          </pre>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">支持的事件类型：</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside ml-2">
          <li><code className="text-xs">server.status.changed</code> - 服务器状态变更</li>
          <li><code className="text-xs">security.alert</code> - 安全告警</li>
          <li><code className="text-xs">backup.completed</code> - 备份完成</li>
          <li><code className="text-xs">user.login.anomaly</code> - 登录异常</li>
          <li><code className="text-xs">system.maintenance</code> - 系统维护通知</li>
        </ul>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">注意事项：</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside ml-2">
          <li>Webhook请求超时时间为10秒</li>
          <li>如果端点返回非2xx状态码，系统会重试最多3次</li>
          <li>建议实现幂等性处理，以应对可能的重复请求</li>
          <li>强烈建议配置签名密钥以验证请求来源</li>
        </ul>
      </div>
    </SettingsSection>
  )
}
