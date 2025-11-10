"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import {
  Settings,
  Globe,
  Zap,
  Save,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { systemConfigSchema } from "@/schemas/settings/system-config.schema"
import { settingsApi } from "@/lib/api/settings"
import { BasicTab } from "./_tabs/basic-tab"
import { I18nTab } from "./_tabs/i18n-tab"
import { PerformanceTab } from "./_tabs/performance-tab"
import { SkeletonCard } from "@/components/ui/loading"

export default function SystemConfigPage() {
  const [activeTab, setActiveTab] = useState("basic")

  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: systemConfigSchema,
    loadFn: async (token) => {
      // 合并多个API调用
      const systemConfig = await settingsApi.getSystemConfig(token)
      const dbConfig = await settingsApi.getDatabasePoolConfig(token)

      return {
        ...systemConfig,
        ...dbConfig,
      }
    },
    saveFn: async (token, data) => {
      // 分别保存到不同的API
      const systemData = {
        system_name: data.system_name,
        system_logo: data.system_logo,
        system_favicon: data.system_favicon,
        default_language: data.default_language,
        default_timezone: data.default_timezone,
        date_format: data.date_format,
        default_page_size: data.default_page_size,
        max_file_upload_size: data.max_file_upload_size,
      }

      const dbData = {
        max_idle_conns: data.max_idle_conns,
        max_open_conns: data.max_open_conns,
        conn_max_lifetime: data.conn_max_lifetime,
        conn_max_idle_time: data.conn_max_idle_time,
      }

      await Promise.all([
        settingsApi.saveSystemConfig(token, systemData),
        settingsApi.saveDatabasePoolConfig(token, dbData),
      ])
    },
  })

  if (isLoading) {
    return (
      <>
        <PageHeader title="系统配置" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
          {/* 统计卡片骨架屏 */}
          <div className="grid gap-4 md:grid-cols-3">
            <SkeletonCard showHeader={false} lines={2} />
            <SkeletonCard showHeader={false} lines={2} />
            <SkeletonCard showHeader={false} lines={2} />
          </div>
          {/* 表单内容骨架屏 */}
          <SkeletonCard showHeader lines={8} className="flex-1" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="系统配置">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={isLoading || isSaving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            重置
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存设置
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">系统名称</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("system_name") || "未设置"}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">默认语言</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("default_language") === "zh-CN"
                ? "简体中文"
                : form.watch("default_language") === "en-US"
                ? "English"
                : "日本語"}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">分页大小</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("default_page_size")} 条/页
            </div>
          </Card>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">
              <Settings className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">基本信息</span>
            </TabsTrigger>
            <TabsTrigger value="i18n">
              <Globe className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">国际化</span>
            </TabsTrigger>
            <TabsTrigger value="performance">
              <Zap className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">性能设置</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <BasicTab form={form} />
          </TabsContent>

          <TabsContent value="i18n">
            <I18nTab form={form} />
          </TabsContent>

          <TabsContent value="performance">
            <PerformanceTab form={form} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
