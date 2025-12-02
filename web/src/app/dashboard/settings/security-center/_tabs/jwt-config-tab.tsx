"use client"

import { useTranslations } from "next-intl"
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
  const t = useTranslations("settingsSecurityJwt")
  const accessHours = accessExpire ?? 0
  const refreshHours = refreshExpire ?? 0

  return (
    <SettingsSection
      title={t("sectionTitle")}
      description={t("sectionDescription")}
      icon={<Key className="h-5 w-5" />}
    >
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {t("alertRestart")}
        </AlertDescription>
      </Alert>

      <FormInput
        form={form}
        name="access_token_expire_minutes"
        label={t("fieldAccessExpireLabel")}
        description={t("fieldAccessExpireDescription")}
        type="number"
        min={1}
        max={168}
        step={1}
        required
      />

      <FormInput
        form={form}
        name="refresh_token_expire_days"
        label={t("fieldRefreshExpireLabel")}
        description={t("fieldRefreshExpireDescription")}
        type="number"
        min={24}
        max={720}
        step={24}
        required
      />

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">
          {t("summaryTitle")}
        </p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">
              {t("summaryAccessTitle")}
            </p>
            <p>
              {t("summaryAccessDescription", { hours: accessHours })}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("summaryRefreshTitle")}
            </p>
            <p>
              {t("summaryRefreshDescription", { hours: refreshHours })}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">
          {t("recommendTitle")}
        </p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">
              {t("recommendHighTitle")}
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>{t("recommendHighAccess")}</li>
              <li>{t("recommendHighRefresh")}</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("recommendBalancedTitle")}
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>{t("recommendBalancedAccess")}</li>
              <li>{t("recommendBalancedRefresh")}</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("recommendConvenienceTitle")}
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>{t("recommendConvenienceAccess")}</li>
              <li>{t("recommendConvenienceRefresh")}</li>
            </ul>
          </div>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-1">{t("notesTitle")}</p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>{t("notesItemOrder")}</li>
            <li>{t("notesItemTooShort")}</li>
            <li>{t("notesItemTooLong")}</li>
            <li>{t("notesItemRestart")}</li>
          </ul>
        </AlertDescription>
      </Alert>
    </SettingsSection>
  )
}
