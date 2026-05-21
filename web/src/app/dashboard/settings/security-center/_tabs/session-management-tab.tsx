"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Clock, Save, Loader2, RotateCcw, KeyRound } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { sessionManagementSchema } from "@/schemas/settings/security.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"
import { isDesktopRuntime, useRuntimeInfo } from "@/shell/runtime"

export function SessionManagementTab() {
  const t = useTranslations("settingsSecuritySession")
  const tCommon = useTranslations("common")
  const { data: runtime, isLoading: isRuntimeLoading } = useRuntimeInfo()
  const isDesktop = isDesktopRuntime(runtime)
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: sessionManagementSchema,
    loadFn: async () => {
      const [tabConfig, systemConfig] = await Promise.all([
        settingsApi.getTabSessionConfig(),
        isDesktop ? Promise.resolve(null) : settingsApi.getSystemConfig(),
      ])
      return {
        session_timeout: tabConfig.session_timeout,
        max_tabs: tabConfig.max_tabs,
        inactive_minutes: tabConfig.inactive_minutes,
        remember_login: tabConfig.remember_login,
        hibernate: tabConfig.hibernate,
        jwt_access_expire_minutes: systemConfig?.jwt_access_expire_minutes ?? 15,
        jwt_refresh_idle_expire_days: systemConfig?.jwt_refresh_idle_expire_days ?? 7,
        jwt_refresh_absolute_expire_days: systemConfig?.jwt_refresh_absolute_expire_days ?? 30,
        jwt_refresh_rotate: systemConfig?.jwt_refresh_rotate ?? true,
        jwt_refresh_reuse_detection: systemConfig?.jwt_refresh_reuse_detection ?? true,
      }
    },
    saveFn: async (data) => {
      await settingsApi.saveTabSessionConfig({
        session_timeout: data.session_timeout,
        max_tabs: data.max_tabs,
        inactive_minutes: data.inactive_minutes,
        remember_login: data.remember_login,
        hibernate: data.hibernate,
      })

      if (!isDesktop) {
        await settingsApi.saveJWTSessionConfig({
          jwt_access_expire_minutes: data.jwt_access_expire_minutes,
          jwt_refresh_idle_expire_days: data.jwt_refresh_idle_expire_days,
          jwt_refresh_absolute_expire_days: data.jwt_refresh_absolute_expire_days,
          jwt_refresh_rotate: data.jwt_refresh_rotate,
          jwt_refresh_reuse_detection: data.jwt_refresh_reuse_detection,
        })
      }
    },
    enabled: !isRuntimeLoading,
  })

  if (isRuntimeLoading || isLoading) {
    return <SettingsLoading />
  }

  const sessionTimeout = form.watch("session_timeout")
  const maxTabs = form.watch("max_tabs")
  const accessExpireMinutes = form.watch("jwt_access_expire_minutes")
  const refreshIdleDays = form.watch("jwt_refresh_idle_expire_days")
  const refreshAbsoluteDays = form.watch("jwt_refresh_absolute_expire_days")

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* 可滚动内容区 - flex-1 + min-h-0 确保正确收缩 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-4">
        <div className="space-y-4">
          <SettingsSection
            title={isDesktop ? t("desktopSectionTitle") : t("sectionTitle")}
            description={isDesktop ? t("desktopSectionDescription") : t("sectionDescription")}
            icon={<Clock className="h-5 w-5" />}
          >
            <FormInput
              form={form}
              name="session_timeout"
              label={isDesktop ? t("desktopFieldSessionTimeout") : t("fieldSessionTimeout")}
              description={isDesktop ? t("desktopFieldSessionTimeoutDesc") : t("fieldSessionTimeoutDesc")}
              type="number"
              min={5}
              max={1440}
              step={5}
              required
            />

            <FormInput
              form={form}
              name="max_tabs"
              label={isDesktop ? t("desktopFieldMaxTabs") : t("fieldMaxTabs")}
              description={isDesktop ? t("desktopFieldMaxTabsDesc") : t("fieldMaxTabsDesc")}
              type="number"
              min={1}
              max={200}
              step={1}
              required
            />

            <FormInput
              form={form}
              name="inactive_minutes"
              label={isDesktop ? t("desktopFieldInactiveMinutes") : t("fieldInactiveMinutes")}
              description={isDesktop ? t("desktopFieldInactiveMinutesDesc") : t("fieldInactiveMinutesDesc")}
              type="number"
              min={5}
              max={1440}
              step={5}
              required
            />

            {!isDesktop && (
              <FormSwitch
                form={form}
                name="remember_login"
                label={t("fieldRememberLogin")}
                description={t("fieldRememberLoginDesc")}
              />
            )}

            <FormSwitch
              form={form}
              name="hibernate"
              label={isDesktop ? t("desktopFieldHibernate") : t("fieldHibernate")}
              description={isDesktop ? t("desktopFieldHibernateDesc") : t("fieldHibernateDesc")}
            />

            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">{isDesktop ? t("desktopPreviewTitle") : t("previewTitle")}</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  {isDesktop ? t("desktopPreviewSessionTimeoutPrefix") : t("previewSessionTimeoutPrefix")}
                  <span className="font-semibold text-foreground">{sessionTimeout}</span>
                  {isDesktop ? t("desktopPreviewSessionTimeoutSuffix") : t("previewSessionTimeoutSuffix")}
                </p>
                <p>
                  {isDesktop ? t("desktopPreviewMaxTabsPrefix") : t("previewMaxTabsPrefix")}
                  <span className="font-semibold text-foreground">{maxTabs}</span>
                  {isDesktop ? t("desktopPreviewMaxTabsSuffix") : t("previewMaxTabsSuffix")}
                </p>
                {!isDesktop && (
                  <p>
                    {t("previewRememberLoginPrefix")}
                    <span className="font-semibold text-foreground">
                      {form.watch("remember_login") ? t("previewEnabled") : t("previewDisabled")}
                    </span>
                  </p>
                )}
                <p>
                  {isDesktop ? t("desktopPreviewHibernatePrefix") : t("previewHibernatePrefix")}
                  <span className="font-semibold text-foreground">
                    {form.watch("hibernate") ? t("previewEnabled") : t("previewDisabled")}
                  </span>
                </p>
              </div>
            </div>

            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                {isDesktop ? t("desktopAlertContent") : t("alertContent")}
              </AlertDescription>
            </Alert>
          </SettingsSection>

          {!isDesktop && (
            <SettingsSection
              title={t("jwtSectionTitle")}
              description={t("jwtSectionDescription")}
              icon={<KeyRound className="h-5 w-5" />}
            >
              <FormInput
                form={form}
                name="jwt_access_expire_minutes"
                label={t("fieldJWTAccessExpire")}
                description={t("fieldJWTAccessExpireDesc")}
                type="number"
                min={5}
                max={1440}
                step={5}
                required
              />

              <FormInput
                form={form}
                name="jwt_refresh_idle_expire_days"
                label={t("fieldJWTRefreshIdleExpire")}
                description={t("fieldJWTRefreshIdleExpireDesc")}
                type="number"
                min={1}
                max={90}
                step={1}
                required
              />

              <FormInput
                form={form}
                name="jwt_refresh_absolute_expire_days"
                label={t("fieldJWTRefreshAbsoluteExpire")}
                description={t("fieldJWTRefreshAbsoluteExpireDesc")}
                type="number"
                min={1}
                max={365}
                step={1}
                required
              />

              <FormSwitch
                form={form}
                name="jwt_refresh_rotate"
                label={t("fieldJWTRefreshRotate")}
                description={t("fieldJWTRefreshRotateDesc")}
              />

              <FormSwitch
                form={form}
                name="jwt_refresh_reuse_detection"
                label={t("fieldJWTRefreshReuseDetection")}
                description={t("fieldJWTRefreshReuseDetectionDesc")}
              />

              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-sm font-medium mb-2">{t("jwtPreviewTitle")}</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    {t("previewJWTAccessPrefix")}
                    <span className="font-semibold text-foreground">{accessExpireMinutes}</span>
                    {t("previewJWTAccessSuffix")}
                  </p>
                  <p>
                    {t("previewJWTRefreshIdlePrefix")}
                    <span className="font-semibold text-foreground">{refreshIdleDays}</span>
                    {t("previewJWTRefreshIdleSuffix")}
                  </p>
                  <p>
                    {t("previewJWTRefreshAbsolutePrefix")}
                    <span className="font-semibold text-foreground">{refreshAbsoluteDays}</span>
                    {t("previewJWTRefreshAbsoluteSuffix")}
                  </p>
                  <p>
                    {t("previewJWTRefreshRotatePrefix")}
                    <span className="font-semibold text-foreground">
                      {form.watch("jwt_refresh_rotate") ? t("previewEnabled") : t("previewDisabled")}
                    </span>
                  </p>
                  <p>
                    {t("previewJWTReuseDetectionPrefix")}
                    <span className="font-semibold text-foreground">
                      {form.watch("jwt_refresh_reuse_detection") ? t("previewEnabled") : t("previewDisabled")}
                    </span>
                  </p>
                </div>
              </div>

              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  {t("jwtAlertContent")}
                </AlertDescription>
              </Alert>
            </SettingsSection>
          )}
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
