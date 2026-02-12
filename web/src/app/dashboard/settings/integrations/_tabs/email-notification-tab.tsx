"use client"
import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Mail, Send } from "lucide-react"
import { type FieldValues, type Path, type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { useSettingsAPI } from "@/hooks/settings/use-settings-api"
import { settingsApi } from "@/lib/api/settings"
import { toast } from "sonner"

type EmailNotificationFields = {
  enabled?: boolean
  host?: string
  port?: number
  username?: string
  password?: string
  from_email?: string
  from_name?: string
  use_tls?: boolean
}

interface EmailNotificationTabProps<TFieldValues extends FieldValues & EmailNotificationFields> {
  form: UseFormReturn<TFieldValues>
  enabledFieldName?: Path<TFieldValues>
}

export function EmailNotificationTab<TFieldValues extends FieldValues & EmailNotificationFields>({
  form,
  enabledFieldName = "enabled" as Path<TFieldValues>,
}: EmailNotificationTabProps<TFieldValues>) {
  const t = useTranslations("settingsIntegrationsEmail")
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
              name={"host" as Path<TFieldValues>}
              label={t("fieldHostLabel")}
              placeholder={t("fieldHostPlaceholder")}
              required
            />

            <FormInput
              form={form}
              name={"port" as Path<TFieldValues>}
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
            name={"use_tls" as Path<TFieldValues>}
            label={t("fieldUseTlsLabel")}
            description={t("fieldUseTlsDesc")}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              form={form}
              name={"username" as Path<TFieldValues>}
              label={t("fieldUsernameLabel")}
              placeholder={t("fieldUsernamePlaceholder")}
              required
            />

            <FormInput
              form={form}
              name={"password" as Path<TFieldValues>}
              label={t("fieldPasswordLabel")}
              type="password"
              placeholder={t("fieldPasswordPlaceholder")}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              form={form}
              name={"from_email" as Path<TFieldValues>}
              label={t("fieldFromEmailLabel")}
              type="email"
              placeholder={t("fieldFromEmailPlaceholder")}
              required
            />

            <FormInput
              form={form}
              name={"from_name" as Path<TFieldValues>}
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
