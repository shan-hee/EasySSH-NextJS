"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch, FormSelect } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Webhook, Send } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { useSettingsAPI } from "@/hooks/settings/use-settings-api"
import { settingsApi } from "@/lib/api/settings"
import { toast } from "sonner"

import { type IntegrationsConfigFormData } from "@/schemas/settings/integrations.schema"

interface WebhookNotificationTabProps {
  form: UseFormReturn<IntegrationsConfigFormData>
  enabledFieldName?: keyof IntegrationsConfigFormData
}

const methodOptions = [
  { label: "POST", value: "POST" },
  { label: "GET", value: "GET" },
]

export function WebhookNotificationTab({ form, enabledFieldName = "webhook_enabled" }: WebhookNotificationTabProps) {
  const t = useTranslations("settingsIntegrationsWebhook")
  const { execute: testConnection, isLoading: isTesting } = useSettingsAPI()
  const enabled = form.watch(enabledFieldName)

  const handleTestWebhook = async () => {
    const data = form.getValues()
    const config = {
      enabled: data.webhook_enabled ?? false,
      url: data.webhook_url ?? "",
      method: data.webhook_method ?? "POST",
      secret: data.webhook_secret ?? "",
    }

    await testConnection(async () => {
      await settingsApi.testWebhookConnection(config)
      toast.success(t("toastTestSuccess"))
    })
  }

  return (
    <SettingsSection
      title={t("sectionTitle")}
      description={t("sectionDescription")}
      icon={<Webhook className="h-5 w-5" />}
    >
      <FormSwitch
        form={form}
        name={enabledFieldName}
        label={t("fieldEnabledLabel")}
        description={t("fieldEnabledDesc")}
      />

      {enabled && (
        <>
          <FormInput
            form={form}
            name="webhook_url"
            label={t("fieldUrlLabel")}
            description={t("fieldUrlDesc")}
            type="url"
            placeholder={t("fieldUrlPlaceholder")}
            required
          />

          <FormSelect
            form={form}
            name="webhook_method"
            label={t("fieldMethodLabel")}
            description={t("fieldMethodDesc")}
            options={methodOptions}
            required
          />

          <FormInput
            form={form}
            name="webhook_secret"
            label={t("fieldSecretLabel")}
            description={t("fieldSecretDesc")}
            type="password"
            placeholder={t("fieldSecretPlaceholder")}
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
                {t("btnTesting")}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t("btnTest")}
              </>
            )}
          </Button>

          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              {t("alertDescription")}
            </AlertDescription>
          </Alert>
        </>
      )}

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">{t("formatTitle")}</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">{t("headersTitle")}</p>
            <ul className="list-disc list-inside ml-2 font-mono text-xs">
              <li>Content-Type: application/json</li>
              <li>User-Agent: EasySSH-Webhook/1.0</li>
              <li>X-Webhook-Signature: [signature, if secret configured]</li>
              <li>X-Event-Type: [event type]</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">{t("bodyTitle")}</p>
            <pre className="bg-background p-2 rounded text-xs overflow-x-auto mt-1">
{`{
  "event": "server.status.changed",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "server_id": 123,
    "server_name": "Production Server",
    "status": "online",
    "message": "Server connected successfully"
  }
}`}
            </pre>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">{t("signTitle")}</p>
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">{t("signIntro")}</p>
          <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
{`signature = HMAC_SHA256(secret, request_body)
X-Webhook-Signature: sha256={signature}`}
          </pre>
          <p className="mt-2">{t("signNodeExampleTitle")}</p>
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
        <p className="text-sm font-medium">{t("eventsTitle")}</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside ml-2">
          <li>
            <code className="text-xs">server.status.changed</code> - {t("eventServerStatus")}
          </li>
          <li>
            <code className="text-xs">security.alert</code> - {t("eventSecurityAlert")}
          </li>
          <li>
            <code className="text-xs">backup.completed</code> - {t("eventBackupCompleted")}
          </li>
          <li>
            <code className="text-xs">user.login.anomaly</code> - {t("eventLoginAnomaly")}
          </li>
          <li>
            <code className="text-xs">system.maintenance</code> - {t("eventSystemMaintenance")}
          </li>
        </ul>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">{t("notesTitle")}</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside ml-2">
          <li>{t("noteTimeout")}</li>
          <li>{t("noteRetry")}</li>
          <li>{t("noteIdempotent")}</li>
          <li>{t("noteSecret")}</li>
        </ul>
      </div>
    </SettingsSection>
  )
}
