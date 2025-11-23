"use client"

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
    <div className="space-y-4">
      {/* 下载设置 */}
      <SettingsSection
        title="下载设置"
        description="配置文件下载的默认行为和排除规则"
        icon={<Download className="h-5 w-5" />}
      >
        <FormSelect
          form={form}
          name="default_download_mode"
          label="默认下载模式"
          description="右键下载文件夹时的默认模式"
          options={[
            { label: "⚡ 快速下载 (推荐) - 使用远程 tar 压缩", value: "fast" },
            { label: "🔧 兼容下载 - 使用 SFTP 逐文件传输", value: "compatible" },
          ]}
          required
        />

        <div className="space-y-2">
          <FormTextarea
            form={form}
            name="download_exclude_patterns"
            label={`排除规则 (${patternCount} 个)`}
            description="下载文件夹时自动跳过的目录/文件，每行一个"
            rows={12}
            placeholder="node_modules&#10;.git&#10;dist&#10;build"
            required
          />

          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-1">
                <p className="font-medium">常见排除规则示例：</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li><code className="text-xs bg-muted px-1 rounded">node_modules</code> - Node.js 依赖</li>
                  <li><code className="text-xs bg-muted px-1 rounded">.git</code> - Git 仓库</li>
                  <li><code className="text-xs bg-muted px-1 rounded">dist / build / target</code> - 构建产物</li>
                  <li><code className="text-xs bg-muted px-1 rounded">__pycache__</code> - Python 缓存</li>
                  <li><code className="text-xs bg-muted px-1 rounded">vendor</code> - Go/PHP 依赖</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </SettingsSection>

      {/* 上传设置 */}
      <SettingsSection
        title="上传设置"
        description="配置文件上传时的过滤行为和大小限制"
        icon={<Upload className="h-5 w-5" />}
      >
        <FormInput
          form={form}
          name="max_file_upload_size"
          label="最大文件上传大小 (MB)"
          description="允许上传的单个文件最大大小 (1-1024 MB)"
          type="number"
          min={1}
          max={1024}
          step={1}
          required
        />

        <FormSwitch
          form={form}
          name="skip_excluded_on_upload"
          label="上传时跳过排除的文件"
          description="上传文件夹时，自动跳过上述排除规则中的文件和目录"
        />
      </SettingsSection>

      {/* 性能提示 */}
      <Alert>
        <Filter className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <div className="space-y-2">
            <p className="font-medium">性能提示：</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>快速下载模式：</strong>速度提升 10-50 倍，但需要服务器安装 <code className="text-xs bg-muted px-1 rounded">tar</code> 工具</li>
              <li><strong>兼容下载模式：</strong>兼容所有服务器，但速度较慢</li>
              <li><strong>排除规则：</strong>可大幅减少下载时间和文件大小（如 node_modules 通常占用数百 MB）</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* 保存按钮区域 */}
      <div className="flex justify-end gap-2 pt-6 pb-16 mt-6">
        <Button variant="outline" onClick={reload} disabled={isSaving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重置
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
