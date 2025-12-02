"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSelect, FormSwitch } from "@/components/settings/form-field"
import { Settings, Save, Loader2, RotateCcw, UserPlus, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { basicInfoSchema } from "@/schemas/settings/system-config.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function BasicTab() {
  const t = useTranslations("settingsSystemBasic")
  const tCommon = useTranslations("common")

  const languageOptions = [
    { label: t("languageZhCN"), value: "zh-CN" },
    { label: t("languageEnUS"), value: "en-US" },
  ]

  const timezoneOptions = [
    { label: t("timezoneAsiaShanghai"), value: "Asia/Shanghai" },
    { label: t("timezoneAsiaTokyo"), value: "Asia/Tokyo" },
    { label: t("timezoneAsiaHongKong"), value: "Asia/Hong_Kong" },
    { label: t("timezoneAmericaNewYork"), value: "America/New_York" },
    { label: t("timezoneAmericaLosAngeles"), value: "America/Los_Angeles" },
    { label: t("timezoneEuropeLondon"), value: "Europe/London" },
    { label: t("timezoneEuropeParis"), value: "Europe/Paris" },
    { label: t("timezoneUTC"), value: "UTC" },
  ]

  const dateFormatOptions = [
    { label: "YYYY-MM-DD HH:mm:ss", value: "YYYY-MM-DD HH:mm:ss" },
    { label: "YYYY/MM/DD HH:mm:ss", value: "YYYY/MM/DD HH:mm:ss" },
    { label: "DD/MM/YYYY HH:mm:ss", value: "DD/MM/YYYY HH:mm:ss" },
    { label: "MM/DD/YYYY HH:mm:ss", value: "MM/DD/YYYY HH:mm:ss" },
    { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
    { label: "DD-MM-YYYY", value: "DD-MM-YYYY" },
  ]

  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: basicInfoSchema,
    loadFn: async () => {
      const data = await settingsApi.getSystemConfig()
      return {
        system_name: data.system_name,
        system_logo: data.system_logo,
        system_favicon: data.system_favicon,
        default_language: data.default_language,
        default_timezone: data.default_timezone,
        date_format: data.date_format,
        allow_registration: data.allow_registration ?? false,
        oauth_enabled: data.oauth_enabled ?? false,
        google_client_id: data.google_client_id ?? "",
        google_client_secret: data.google_client_secret ?? "",
      }
    },
    saveFn: async (data) => {
      // 加载完整配置
      const fullConfig = await settingsApi.getSystemConfig()
      // 合并当前页签的修改
      const updatedConfig = {
        ...fullConfig,
        ...data,
      }
      // 全量保存
      await settingsApi.saveSystemConfig(updatedConfig)
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  const logoUrl = form.watch("system_logo")
  const faviconUrl = form.watch("system_favicon")
  const selectedFormat = form.watch("date_format")
  const currentDate = new Date()

  // 简单的日期格式化示例
  const formatPreview = (format: string) => {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, "0")
    const day = String(currentDate.getDate()).padStart(2, "0")
    const hours = String(currentDate.getHours()).padStart(2, "0")
    const minutes = String(currentDate.getMinutes()).padStart(2, "0")
    const seconds = String(currentDate.getSeconds()).padStart(2, "0")

    return format
      .replace("YYYY", String(year))
      .replace("MM", month)
      .replace("DD", day)
      .replace("HH", hours)
      .replace("mm", minutes)
      .replace("ss", seconds)
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* 可滚动内容区 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-4">
        <div className="space-y-4">
          <SettingsSection
            title={t("sectionTitle")}
            description={t("sectionDescription")}
            icon={<Settings className="h-5 w-5" />}
          >
            <FormInput
              form={form}
              name="system_name"
              label={t("fieldSystemName")}
              description={t("fieldSystemNameDesc")}
              required
              placeholder="EasySSH"
            />

            <FormInput
              form={form}
              name="system_logo"
              label={t("fieldSystemLogo")}
              description={t("fieldSystemLogoDesc")}
              type="url"
              placeholder="https://example.com/logo.svg"
            />

            {logoUrl && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-2">{t("logoPreviewTitle")}</p>
                <img
                  src={logoUrl}
                  alt={t("logoPreviewTitle")}
                  className="h-16 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              </div>
            )}

            <FormInput
              form={form}
              name="system_favicon"
              label={t("fieldFavicon")}
              description={t("fieldFaviconDesc")}
              type="url"
              placeholder="https://example.com/favicon.ico"
            />

            {faviconUrl && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-2">{t("faviconPreviewTitle")}</p>
                <img
                  src={faviconUrl}
                  alt={t("faviconPreviewTitle")}
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              </div>
            )}

            <FormSelect
              form={form}
              name="default_language"
              label={t("fieldDefaultLanguage")}
              description={t("fieldDefaultLanguageDesc")}
              required
              options={languageOptions}
              placeholder={t("fieldDefaultLanguage")}
            />

            <FormSelect
              form={form}
              name="default_timezone"
              label={t("fieldDefaultTimezone")}
              description={t("fieldDefaultTimezoneDesc")}
              required
              options={timezoneOptions}
              placeholder={t("fieldDefaultTimezone")}
            />

            <FormSelect
              form={form}
              name="date_format"
              label={t("fieldDateFormat")}
              description={t("fieldDateFormatDesc")}
              required
              options={dateFormatOptions}
              placeholder={t("fieldDateFormat")}
            />

            {selectedFormat && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-sm font-medium mb-1">{t("dateFormatPreviewTitle")}</p>
                <p className="text-lg font-mono">{formatPreview(selectedFormat)}</p>
              </div>
            )}
          </SettingsSection>

          {/* 注册配置 */}
          <SettingsSection
            title={t("registerSectionTitle")}
            description={t("registerSectionDescription")}
            icon={<UserPlus className="h-5 w-5" />}
          >
            <FormSwitch
              form={form}
              name="allow_registration"
              label={t("fieldAllowRegistration")}
              description={t("fieldAllowRegistrationDesc")}
            />
          </SettingsSection>

          {/* OAuth 配置 */}
          <SettingsSection
            title={t("oauthSectionTitle")}
            description={t("oauthSectionDescription")}
            icon={<Key className="h-5 w-5" />}
          >
            <FormSwitch
              form={form}
              name="oauth_enabled"
              label={t("fieldOAuthEnabled")}
              description={t("fieldOAuthEnabledDesc")}
            />

            {form.watch("oauth_enabled") && (
              <>
                <FormInput
                  form={form}
                  name="google_client_id"
                  label={t("fieldGoogleClientId")}
                  description={t("fieldGoogleClientIdDesc")}
                  placeholder="your-client-id.apps.googleusercontent.com"
                />

                <FormInput
                  form={form}
                  name="google_client_secret"
                  label={t("fieldGoogleClientSecret")}
                  description={t("fieldGoogleClientSecretDesc")}
                  type="password"
                  placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxx"
                />

                <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
                  <p className="text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">
                    {t("oauthHelpTitle")}
                  </p>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                    <li>
                      {t("oauthHelpStep1Prefix")}{" "}
                      <a
                        href="https://console.cloud.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Google Cloud Console
                      </a>
                    </li>
                    <li>{t("oauthHelpStep2")}</li>
                    <li>{t("oauthHelpStep3")}</li>
                    <li>{t("oauthHelpStep4")}</li>
                    <li>
                      {t("oauthHelpStep5Prefix")}：
                      <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/auth/google/callback`
                          : "https://your-domain.com/auth/google/callback"}
                      </code>
                    </li>
                    <li>{t("oauthHelpStep6")}</li>
                  </ol>
                </div>
              </>
            )}
          </SettingsSection>
        </div>
      </div>

      {/* 固定底部按钮区 - shrink-0 防止被压缩 */}
      <div className="shrink-0 flex justify-end gap-2 p-4 bg-background">
        <Button variant="outline" onClick={reload} disabled={isSaving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {tCommon("reset")}
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tCommon("saving")}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {tCommon("save")}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
