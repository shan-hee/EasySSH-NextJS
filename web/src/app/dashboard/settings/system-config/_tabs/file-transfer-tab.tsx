"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormTextarea, FormSelect, FormSwitch } from "@/components/settings/form-field"
import { Download, Upload, Filter } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { SystemConfigFormData } from "@/schemas/settings/system-config.schema"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

interface FileTransferTabProps {
  form: UseFormReturn<SystemConfigFormData>
}

export function FileTransferTab({ form }: FileTransferTabProps) {
  // 计算排除规则数量
  const excludePatterns = form.watch("download_exclude_patterns") || ""
  const patternCount = excludePatterns.split("\n").filter(p => p.trim()).length

  return (
    <div className="space-y-6">
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
        description="配置文件上传时的过滤行为"
        icon={<Upload className="h-5 w-5" />}
      >
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
    </div>
  )
}
