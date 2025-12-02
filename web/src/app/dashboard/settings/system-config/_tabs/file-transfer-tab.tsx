"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormTextarea, FormSelect, FormSwitch, FormInput } from "@/components/settings/form-field"
import { Download, Upload, Filter, Save, Loader2, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { fileTransferSchema } from "@/schemas/settings/system-config.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function FileTransferTab() {
  const t = useTranslations("settingsSystemFileTransfer")
  const tCommon = useTranslations("common")
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: fileTransferSchema,
    loadFn: async () => {
      const data = await settingsApi.getSystemConfig()
      return {
        default_download_mode: data.default_download_mode,
        download_exclude_patterns: data.download_exclude_patterns,
        skip_excluded_on_upload: data.skip_excluded_on_upload,
        max_file_upload_size: data.max_file_upload_size,
      }
    },
    saveFn: async (data) => {
      const fullConfig = await settingsApi.getSystemConfig()
      const updatedConfig = {
        ...fullConfig,
        ...data,
      }
      await settingsApi.saveSystemConfig(updatedConfig)
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  // 计算排除规则数量
  const excludePatterns = form.watch("download_exclude_patterns") || ""
  const patternCount = excludePatterns.split("\n").filter(p => p.trim()).length

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* 可滚动内容区 - flex-1 + min-h-0 确保正确收缩 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-4">
        <div className="space-y-4">
          {/* 下载设置 */}
          <SettingsSection
            title={t("sectionDownloadTitle")}
            description={t("sectionDownloadDescription")}
            icon={<Download className="h-5 w-5" />}
          >
            <FormSelect
              form={form}
              name="default_download_mode"
              label={t("fieldDefaultDownloadMode")}
              description={t("fieldDefaultDownloadModeDesc")}
              options={[
                { label: t("optionDownloadModeFast"), value: "fast" },
                { label: t("optionDownloadModeCompatible"), value: "compatible" },
              ]}
              required
            />

            <div className="space-y-2">
              <FormTextarea
                form={form}
                name="download_exclude_patterns"
              label={t("fieldExcludePatternsLabel", { count: patternCount })}
                description={t("fieldExcludePatternsDesc")}
                rows={12}
                placeholder={t("fieldExcludePatternsPlaceholder")}
                required
              />

              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <div className="space-y-1">
                    <p className="font-medium">{t("alertExamplesTitle")}</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      <li>
                        <code className="text-xs bg-muted px-1 rounded">node_modules</code> -{" "}
                        {t("alertExampleNodeModules")}
                      </li>
                      <li>
                        <code className="text-xs bg-muted px-1 rounded">.git</code> - {t("alertExampleGitRepo")}
                      </li>
                      <li>
                        <code className="text-xs bg-muted px-1 rounded">dist / build / target</code> -{" "}
                        {t("alertExampleBuildOutputs")}
                      </li>
                      <li>
                        <code className="text-xs bg-muted px-1 rounded">__pycache__</code> -{" "}
                        {t("alertExamplePycache")}
                      </li>
                      <li>
                        <code className="text-xs bg-muted px-1 rounded">vendor</code> -{" "}
                        {t("alertExampleVendor")}
                      </li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          </SettingsSection>

          {/* 上传设置 */}
          <SettingsSection
            title={t("sectionUploadTitle")}
            description={t("sectionUploadDescription")}
            icon={<Upload className="h-5 w-5" />}
          >
            <FormInput
              form={form}
              name="max_file_upload_size"
              label={t("fieldMaxUploadSize")}
              description={t("fieldMaxUploadSizeDesc")}
              type="number"
              min={1}
              max={1024}
              step={1}
              required
            />

            <FormSwitch
              form={form}
              name="skip_excluded_on_upload"
              label={t("fieldSkipExcludedOnUpload")}
              description={t("fieldSkipExcludedOnUploadDesc")}
            />
          </SettingsSection>

          {/* 性能提示 */}
          <Alert>
            <Filter className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p className="font-medium">{t("performanceHintTitle")}</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>
                    <strong>快速下载模式：</strong>
                    {t("performanceHintFastMode")}
                  </li>
                  <li>
                    <strong>兼容下载模式：</strong>
                    {t("performanceHintCompatibleMode")}
                  </li>
                  <li>
                    <strong>排除规则：</strong>
                    {t("performanceHintExcludeRules")}
                  </li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
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
