"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { MessageCircle, Send } from "lucide-react"
import { type FieldValues, type Path, type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { useSettingsAPI } from "@/hooks/settings/use-settings-api"
import { settingsApi } from "@/lib/api/settings"
import { toast } from "sonner"

type WeComNotificationFields = {
  wecom_enabled?: boolean
  wecom_webhook_url?: string
}

interface WeComNotificationTabProps<TFieldValues extends FieldValues & WeComNotificationFields> {
  form: UseFormReturn<TFieldValues>
  enabledFieldName?: Path<TFieldValues>
}

export function WeComNotificationTab<TFieldValues extends FieldValues & WeComNotificationFields>({
  form,
  enabledFieldName = "wecom_enabled" as Path<TFieldValues>,
}: WeComNotificationTabProps<TFieldValues>) {
  const t = useTranslations("settingsIntegrationsWeCom")
  const { execute: testConnection, isLoading: isTesting } = useSettingsAPI()
  const enabled = form.watch(enabledFieldName)

  const handleTestMessage = async () => {
    const data = form.getValues()
    const config = {
      enabled: data.wecom_enabled ?? false,
      webhook_url: data.wecom_webhook_url ?? "",
    }

    await testConnection(async () => {
      await settingsApi.testWeComConnection(config)
      toast.success(t("toastTestSuccess"))
    })
  }

  return (
    <SettingsSection
      title={t("sectionTitle")}
      description={t("sectionDescription")}
      icon={<MessageCircle className="h-5 w-5" />}
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
            name={"wecom_webhook_url" as Path<TFieldValues>}
            label={t("fieldWebhookUrlLabel")}
            description={t("fieldWebhookUrlDesc")}
            type="url"
            placeholder={t("fieldWebhookUrlPlaceholder")}
            required
          />

          <Button
            type="button"
            variant="outline"
            onClick={handleTestMessage}
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
        <p className="text-sm font-medium mb-2">{t("howToTitle")}</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">{t("step1Title")}</p>
            <ul className="list-disc list-inside ml-2">
              <li>{t("step1Item1")}</li>
              <li>{t("step1Item2")}</li>
              <li>{t("step1Item3")}</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">{t("step2Title")}</p>
            <ul className="list-disc list-inside ml-2">
              <li>{t("step2Item1")}</li>
              <li>{t("step2Item2")}</li>
              <li>{t("step2Item3")}</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">{t("step3Title")}</p>
            <ul className="list-disc list-inside ml-2">
              <li>{t("step3Item1")}</li>
              <li>{t("step3Item2")}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">{t("featuresTitle")}</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside ml-2">
          <li>{t("featuresItem1")}</li>
          <li>{t("featuresItem2")}</li>
          <li>{t("featuresItem3")}</li>
          <li>{t("featuresItem4")}</li>
        </ul>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">{t("eventsTitle")}</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside ml-2">
          <li>{t("eventServerStatus")}</li>
          <li>{t("eventSecurityAlert")}</li>
          <li>{t("eventBackupCompleted")}</li>
          <li>{t("eventLoginAnomaly")}</li>
          <li>{t("eventSystemMaintenance")}</li>
        </ul>
      </div>
    </SettingsSection>
  )
}
