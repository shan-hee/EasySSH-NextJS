"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Sliders } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { type IntegrationsConfigFormData } from "@/schemas/settings/integrations.schema"

interface AIModelParamsTabProps {
  form: UseFormReturn<IntegrationsConfigFormData>
}

export function AIModelParamsTab({ form }: AIModelParamsTabProps) {
  const temperature = form.watch("temperature") || 0.7
  const maxTokens = form.watch("max_tokens") || 2048
  const topP = form.watch("top_p") || 1
  const frequencyPenalty = form.watch("frequency_penalty") || 0
  const presencePenalty = form.watch("presence_penalty") || 0

  return (
    <SettingsSection
      title="模型参数调整"
      description="调整AI模型的生成参数以获得最佳效果"
      icon={<Sliders className="h-5 w-5" />}
    >
      {/* Temperature */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Temperature（温度）</Label>
          <span className="text-sm text-muted-foreground">{temperature.toFixed(2)}</span>
        </div>
        <Slider
          value={[temperature]}
          onValueChange={(val) => form.setValue("temperature", val[0])}
          min={0}
          max={2}
          step={0.1}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          控制输出的随机性。较低的值（0-0.5）使输出更确定和一致，较高的值（1-2）使输出更有创造性和多样性。
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Max Tokens（最大长度）</Label>
          <span className="text-sm text-muted-foreground">{maxTokens}</span>
        </div>
        <Slider
          value={[maxTokens]}
          onValueChange={(val) => form.setValue("max_tokens", val[0])}
          min={256}
          max={8192}
          step={256}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          生成文本的最大长度（以token为单位）。较大的值允许更长的回复，但会消耗更多tokens。
        </p>
      </div>

      {/* Top P */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Top P（核心采样）</Label>
          <span className="text-sm text-muted-foreground">{topP.toFixed(2)}</span>
        </div>
        <Slider
          value={[topP]}
          onValueChange={(val) => form.setValue("top_p", val[0])}
          min={0}
          max={1}
          step={0.05}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          控制输出的多样性。值为1.0表示考虑所有可能的词，较小的值（如0.9）只考虑最可能的词。与temperature类似，通常只调整其中一个。
        </p>
      </div>

      {/* Frequency Penalty */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Frequency Penalty（频率惩罚）</Label>
          <span className="text-sm text-muted-foreground">{frequencyPenalty.toFixed(2)}</span>
        </div>
        <Slider
          value={[frequencyPenalty]}
          onValueChange={(val) => form.setValue("frequency_penalty", val[0])}
          min={-2}
          max={2}
          step={0.1}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          降低重复使用相同词语的可能性。正值会减少重复，负值会增加重复。范围：-2.0 到 2.0。
        </p>
      </div>

      {/* Presence Penalty */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Presence Penalty（存在惩罚）</Label>
          <span className="text-sm text-muted-foreground">{presencePenalty.toFixed(2)}</span>
        </div>
        <Slider
          value={[presencePenalty]}
          onValueChange={(val) => form.setValue("presence_penalty", val[0])}
          min={-2}
          max={2}
          step={0.1}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          鼓励模型谈论新话题。正值会增加谈论新话题的可能性，负值会使模型更专注于已有话题。范围：-2.0 到 2.0。
        </p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          这些参数会影响AI生成内容的质量和风格。建议根据具体使用场景进行调整，并通过测试找到最适合您的配置。
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">推荐配置场景：</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">创意写作（高随机性）：</p>
            <p>Temperature: 0.8-1.2, Top P: 0.95, Frequency Penalty: 0.5</p>
          </div>
          <div>
            <p className="font-medium text-foreground">代码生成（低随机性）：</p>
            <p>Temperature: 0.2-0.4, Top P: 0.9, Frequency Penalty: 0</p>
          </div>
          <div>
            <p className="font-medium text-foreground">问答对话（平衡）：</p>
            <p>Temperature: 0.7, Top P: 1.0, Frequency Penalty: 0, Presence Penalty: 0</p>
          </div>
          <div>
            <p className="font-medium text-foreground">摘要总结（确定性）：</p>
            <p>Temperature: 0.3, Top P: 0.9, Frequency Penalty: 0.3</p>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
