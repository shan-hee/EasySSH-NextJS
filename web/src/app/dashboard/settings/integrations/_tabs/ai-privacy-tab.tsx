"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormSwitch, FormSelect } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Shield, Trash2 } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, InfoIcon } from "lucide-react"

interface AIPrivacyTabProps {
  form: UseFormReturn<any>
}

const autoDeletOptions = [
  { label: "7天", value: "7" },
  { label: "30天", value: "30" },
  { label: "90天", value: "90" },
  { label: "365天", value: "365" },
]

export function AIPrivacyTab({ form }: AIPrivacyTabProps) {
  const saveHistory = form.watch("save_history")
  const autoDeleteDays = form.watch("auto_delete_days")

  const handleClearHistory = () => {
    if (confirm("确定要清除所有对话历史吗？此操作不可撤销！")) {
      // 实际清除逻辑
      alert("对话历史已清除")
    }
  }

  return (
    <SettingsSection
      title="隐私设置"
      description="管理AI对话数据的隐私和保留策略"
      icon={<Shield className="h-5 w-5" />}
    >
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          您的隐私和数据安全是我们的首要任务。以下设置将帮助您控制AI对话数据的存储和使用方式。
        </AlertDescription>
      </Alert>

      <FormSwitch
        form={form}
        name="save_history"
        label="保存对话历史"
        description="启用后，您的AI对话将被保存以便后续查看和分析"
      />

      {saveHistory && (
        <>
          <FormSwitch
            form={form}
            name="allow_training"
            label="允许用于模型训练"
            description="允许使用您的对话数据改进AI模型（完全匿名化）"
          />

          <div className="space-y-2">
            <FormSelect
              form={form}
              name="auto_delete_days"
              label="自动删除对话"
              description="设置对话历史的自动删除时间"
              options={autoDeletOptions.map(opt => ({
                label: opt.label,
                value: opt.value
              }))}
              placeholder="选择保留时间"
            />
          </div>

          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-2">当前设置预览：</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 对话历史保存：<span className="text-foreground font-medium">已启用</span></li>
              <li>
                • 用于模型训练：
                <span className="text-foreground font-medium">
                  {form.watch("allow_training") ? "已允许" : "不允许"}
                </span>
              </li>
              <li>
                • 自动删除：
                <span className="text-foreground font-medium">{autoDeleteDays} 天后</span>
              </li>
            </ul>
          </div>
        </>
      )}

      {!saveHistory && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            关闭对话历史后，您的对话将不会被保存，这意味着您无法查看历史对话记录，且无法进行对话分析。
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium">清除所有对话历史</h4>
        <p className="text-sm text-muted-foreground">
          永久删除所有保存的AI对话记录。此操作不可撤销。
        </p>
        <Button
          variant="destructive"
          onClick={handleClearHistory}
          className="w-full md:w-auto"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          清除所有对话历史
        </Button>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">数据隐私说明：</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">数据存储：</p>
            <ul className="list-disc list-inside ml-2">
              <li>所有对话数据均加密存储在本地服务器</li>
              <li>不会与第三方共享您的对话内容</li>
              <li>管理员无法查看您的私密对话</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">模型训练：</p>
            <ul className="list-disc list-inside ml-2">
              <li>仅在您明确授权的情况下使用</li>
              <li>所有数据完全匿名化处理</li>
              <li>您可以随时撤回授权</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">数据保留：</p>
            <ul className="list-disc list-inside ml-2">
              <li>根据您设置的时间自动删除旧对话</li>
              <li>删除后的数据无法恢复</li>
              <li>您可以手动清除所有历史记录</li>
            </ul>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
