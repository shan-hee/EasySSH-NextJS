"use client"
import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Mail, Send } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { useSettingsAPI } from "@/hooks/settings/use-settings-api"
import { settingsApi } from "@/lib/api/settings"
import { toast } from "sonner"


import { type IntegrationsConfigFormData } from "@/schemas/settings/integrations.schema"

interface EmailNotificationTabProps {
  form: UseFormReturn<IntegrationsConfigFormData>
  enabledFieldName?: keyof IntegrationsConfigFormData
}

export function EmailNotificationTab({ form, enabledFieldName = "enabled" }: EmailNotificationTabProps) {
  const t = useTranslations("settingsIntegrationsEmail")
  const tCommon = useTranslations("common")
  const { execute: testConnection, isLoading: isTesting } = useSettingsAPI()
  const enabled = form.watch(enabledFieldName)

  const handleTestEmail = async () => {
    const data = form.getValues()
    const config = {
      enabled: data.enabled ?? false,
      host: data.host ?? "",
      port: data.port ?? 587,
      username: data.username ?? "",
      password: data.password ?? "",
      from_email: data.from_email ?? "",
      from_name: data.from_name ?? "",
      use_tls: data.use_tls ?? true,
    }

    await testConnection(async () => {
      await settingsApi.testSMTPConnection(config)
      toast.success(t("toastTestSuccess"))
    })
  }

  return (
    <SettingsSection
      title={t("sectionTitle")}
      description={t("sectionDescription")}
      icon={<Mail className="h-5 w-5" />}
    >
      <FormSwitch
        form={form}
        name={enabledFieldName}
        label={t("fieldEnabledLabel")}
        description={t("fieldEnabledDesc")}
      />

      {enabled && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              form={form}
              name="host"
              label={t("fieldHostLabel")}
              placeholder={t("fieldHostPlaceholder")}
              required
            />

            <FormInput
              form={form}
              name="port"
              label={t("fieldPortLabel")}
              type="number"
              placeholder={t("fieldPortPlaceholder")}
              min={1}
              max={65535}
              required
            />
          </div>

          <FormSwitch
            form={form}
            name="use_tls"
            label={t("fieldUseTlsLabel")}
            description={t("fieldUseTlsDesc")}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              form={form}
              name="username"
              label={t("fieldUsernameLabel")}
              placeholder={t("fieldUsernamePlaceholder")}
              required
            />

            <FormInput
              form={form}
              name="password"
              label={t("fieldPasswordLabel")}
              type="password"
              placeholder={t("fieldPasswordPlaceholder")}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              form={form}
              name="from_email"
              label={t("fieldFromEmailLabel")}
              type="email"
              placeholder={t("fieldFromEmailPlaceholder")}
              required
            />

            <FormInput
              form={form}
              name="from_name"
              label={t("fieldFromNameLabel")}
              placeholder={t("fieldFromNamePlaceholder")}
              required
            />
          </div>

          <Button type="button" variant="outline" onClick={handleTestEmail} disabled={isTesting}>
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
        <p className="text-sm font-medium mb-2">{t("commonConfigsTitle")}</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">{t("configGmailTitle")}</p>
            <p>{t("configGmailContent")}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t("configTencentTitle")}</p>
            <p>{t("configTencentContent")}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t("configAliyunTitle")}</p>
            <p>{t("configAliyunContent")}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t("configM365Title")}</p>
            <p>{t("configM365Content")}</p>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
