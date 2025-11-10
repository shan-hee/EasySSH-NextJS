"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput } from "@/components/settings/form-field"
import { Zap, Database } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { SystemConfigFormData } from "@/schemas/settings/system-config.schema"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface PerformanceTabProps {
  form: UseFormReturn<SystemConfigFormData>
}

export function PerformanceTab({ form }: PerformanceTabProps) {
  return (
    <div className="space-y-6">
      {/* 基本性能设置 */}
      <SettingsSection
        title="基本性能设置"
        description="配置系统的基本性能参数"
        icon={<Zap className="h-5 w-5" />}
      >
        <FormInput
          form={form}
          name="default_page_size"
          label="默认分页大小"
          description="列表页面每页显示的默认条数 (10-100)"
          type="number"
          min={10}
          max={100}
          step={5}
          required
        />

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
      </SettingsSection>

      <Separator />

      {/* 数据库连接池配置 */}
      <SettingsSection
        title="数据库连接池配置"
        description="配置数据库连接池参数以优化性能"
        icon={<Database className="h-5 w-5" />}
      >
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            修改数据库连接池配置需要重启服务才能生效！请谨慎操作。
          </AlertDescription>
        </Alert>

        <FormInput
          form={form}
          name="max_idle_conns"
          label="最大空闲连接数"
          description="连接池中保持的最大空闲连接数 (1-1000)"
          type="number"
          min={1}
          max={1000}
          step={1}
          required
        />

        <FormInput
          form={form}
          name="max_open_conns"
          label="最大打开连接数"
          description="数据库的最大打开连接数 (1-10000)"
          type="number"
          min={1}
          max={10000}
          step={10}
          required
        />

        <FormInput
          form={form}
          name="conn_max_lifetime"
          label="连接最大生命周期 (分钟)"
          description="连接可重用的最长时间 (1-1440分钟)"
          type="number"
          min={1}
          max={1440}
          step={5}
          required
        />

        <FormInput
          form={form}
          name="conn_max_idle_time"
          label="连接最大空闲时间 (分钟)"
          description="连接在被关闭前可空闲的最长时间 (1-60分钟)"
          type="number"
          min={1}
          max={60}
          step={1}
          required
        />

        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">推荐配置：</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 最大空闲连接数: 10-50</li>
            <li>• 最大打开连接数: 50-200</li>
            <li>• 连接最大生命周期: 30-60分钟</li>
            <li>• 连接最大空闲时间: 5-15分钟</li>
          </ul>
        </div>
      </SettingsSection>
    </div>
  )
}
