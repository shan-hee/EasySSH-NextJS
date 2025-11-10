"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import {
  Shield,
  Clock,
  Key,
  Globe,
  Save,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { securityConfigSchema } from "@/schemas/settings/security.schema"
import { settingsApi } from "@/lib/api/settings"
import { AccessControlTab } from "./_tabs/access-control-tab"
import { SessionManagementTab } from "./_tabs/session-management-tab"
import { JWTConfigTab } from "./_tabs/jwt-config-tab"
import { NetworkSecurityTab } from "./_tabs/network-security-tab"
import { SkeletonCard } from "@/components/ui/loading"

export default function SecurityCenterPage() {
  const [activeTab, setActiveTab] = useState("access")

  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: securityConfigSchema,
    loadFn: async (token) => {
      // 合并多个API调用
      const [sessionConfig, jwtConfig, corsConfig, rateLimitConfig] =
        await Promise.all([
          settingsApi.getTabSessionConfig(token),
          settingsApi.getJWTConfig(token),
          settingsApi.getCORSConfig(token),
          settingsApi.getRateLimitConfig(token),
        ])

      return {
        ...sessionConfig,
        ...jwtConfig,
        ...corsConfig,
        ...rateLimitConfig,
      }
    },
    saveFn: async (token, data) => {
      // 分别保存到不同的API
      const sessionData = {
        session_timeout: data.session_timeout,
        max_tabs: data.max_tabs,
        inactive_minutes: data.inactive_minutes,
        remember_login: data.remember_login,
        hibernate: data.hibernate,
      }

      const jwtData = {
        access_expire: data.access_expire,
        refresh_expire: data.refresh_expire,
      }

      const corsData = {
        allowed_origins: data.allowed_origins,
        allowed_methods: data.allowed_methods,
        allowed_headers: data.allowed_headers,
      }

      const rateLimitData = {
        login_limit: data.login_limit,
        api_limit: data.api_limit,
      }

      await Promise.all([
        settingsApi.saveTabSessionConfig(token, sessionData),
        settingsApi.saveJWTConfig(token, jwtData),
        settingsApi.saveCORSConfig(token, corsData),
        settingsApi.saveRateLimitConfig(token, rateLimitData),
      ])
    },
  })

  if (isLoading) {
    return (
      <>
        <PageHeader title="安全中心" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
          {/* 统计卡片骨架屏 */}
          <div className="grid gap-4 md:grid-cols-4">
            <SkeletonCard showHeader={false} lines={2} />
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
      <PageHeader title="安全中心">
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
          <Button size="sm" onClick={handleSave} disabled={isLoading || isSaving}>
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">访问控制</div>
            </div>
            <div className="mt-2 text-2xl font-bold">IP 白名单</div>
            <p className="text-xs text-muted-foreground mt-1">限制访问来源</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">会话超时</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("session_timeout")} 分钟
            </div>
            <p className="text-xs text-muted-foreground mt-1">自动退出时间</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">访问令牌</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("access_expire")} 小时
            </div>
            <p className="text-xs text-muted-foreground mt-1">JWT 有效期</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">登录限制</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("login_limit")} 次/分钟
            </div>
            <p className="text-xs text-muted-foreground mt-1">速率限制</p>
          </Card>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="access">
              <Shield className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">访问控制</span>
            </TabsTrigger>
            <TabsTrigger value="session">
              <Clock className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">会话管理</span>
            </TabsTrigger>
            <TabsTrigger value="jwt">
              <Key className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">JWT认证</span>
            </TabsTrigger>
            <TabsTrigger value="network">
              <Globe className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">网络安全</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="access">
            <AccessControlTab />
          </TabsContent>

          <TabsContent value="session">
            <SessionManagementTab form={form} />
          </TabsContent>

          <TabsContent value="jwt">
            <JWTConfigTab form={form} />
          </TabsContent>

          <TabsContent value="network">
            <NetworkSecurityTab form={form} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
