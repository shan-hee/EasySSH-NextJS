"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bell, Mail, MessageSquare, Webhook, Send, Save, Loader2 } from "lucide-react"
import { settingsApi, type SMTPConfig, type WebhookConfig, type DingTalkConfig, type WeComConfig } from "@/lib/api/settings"
import { getAccessToken } from "@/contexts/auth-context"
import { toast } from "sonner"

export default function SettingsNotificationsPage() {
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [dingdingEnabled, setDingdingEnabled] = useState(false)
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [wechatEnabled, setWechatEnabled] = useState(false)
  const [currentTab, setCurrentTab] = useState("email")

  // SMTP 配置状态
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    enabled: false,
    host: "",
    port: 587,
    username: "",
    password: "",
    from_email: "",
    from_name: "EasySSH",
    use_tls: true,
  })
  const [smtpLoading, setSmtpLoading] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)

  // Webhook 配置状态
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    enabled: false,
    url: "",
    secret: "",
    method: "POST",
  })
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookTesting, setWebhookTesting] = useState(false)

  // 钉钉配置状态
  const [dingTalkConfig, setDingTalkConfig] = useState<DingTalkConfig>({
    enabled: false,
    webhook_url: "",
    secret: "",
  })
  const [dingTalkLoading, setDingTalkLoading] = useState(false)
  const [dingTalkTesting, setDingTalkTesting] = useState(false)

  // 企业微信配置状态
  const [weComConfig, setWeComConfig] = useState<WeComConfig>({
    enabled: false,
    webhook_url: "",
  })
  const [weComLoading, setWeComLoading] = useState(false)
  const [weComTesting, setWeComTesting] = useState(false)

  const [isSaving, setIsSaving] = useState(false)

  // 加载所有配置
  useEffect(() => {
    loadSMTPConfig()
    loadWebhookConfig()
    loadDingTalkConfig()
    loadWeComConfig()
  }, [])

  const loadSMTPConfig = async () => {
    const token = getAccessToken()
    if (!token) return

    setSmtpLoading(true)
    try {
      const config = await settingsApi.getSMTPConfig(token)
      setSmtpConfig(config)
      setEmailEnabled(config.enabled)
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "加载 SMTP 配置失败"
      toast.error(errorMessage)
    } finally {
      setSmtpLoading(false)
    }
  }

  // 保存 SMTP 配置
  const handleSaveSMTPConfig = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setIsSaving(true)
    try {
      await settingsApi.saveSMTPConfig(token, smtpConfig)
      toast.success("SMTP 配置已保存")
      await loadSMTPConfig() // 重新加载配置
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "保存 SMTP 配置失败"
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  // 测试 SMTP 连接
  const handleTestSMTPConnection = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setSmtpTesting(true)
    try {
      await settingsApi.testSMTPConnection(token, smtpConfig)
      toast.success("SMTP 连接测试成功")
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "SMTP 连接测试失败"
      toast.error(errorMessage)
    } finally {
      setSmtpTesting(false)
    }
  }

  // 加载 Webhook 配置
  const loadWebhookConfig = async () => {
    const token = getAccessToken()
    if (!token) return

    setWebhookLoading(true)
    try {
      const config = await settingsApi.getWebhookConfig(token)
      setWebhookConfig(config)
      setWebhookEnabled(config.enabled)
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "加载 Webhook 配置失败"
      toast.error(errorMessage)
    } finally {
      setWebhookLoading(false)
    }
  }

  // 保存 Webhook 配置
  const handleSaveWebhookConfig = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setIsSaving(true)
    try {
      await settingsApi.saveWebhookConfig(token, webhookConfig)
      toast.success("Webhook 配置已保存")
      await loadWebhookConfig()
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "保存 Webhook 配置失败"
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  // 测试 Webhook 连接
  const handleTestWebhookConnection = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setWebhookTesting(true)
    try {
      await settingsApi.testWebhookConnection(token, webhookConfig)
      toast.success("Webhook 连接测试成功")
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "Webhook 连接测试失败"
      toast.error(errorMessage)
    } finally {
      setWebhookTesting(false)
    }
  }

  // 加载钉钉配置
  const loadDingTalkConfig = async () => {
    const token = getAccessToken()
    if (!token) return

    setDingTalkLoading(true)
    try {
      const config = await settingsApi.getDingTalkConfig(token)
      setDingTalkConfig(config)
      setDingdingEnabled(config.enabled)
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "加载钉钉配置失败"
      toast.error(errorMessage)
    } finally {
      setDingTalkLoading(false)
    }
  }

  // 保存钉钉配置
  const handleSaveDingTalkConfig = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setIsSaving(true)
    try {
      await settingsApi.saveDingTalkConfig(token, dingTalkConfig)
      toast.success("钉钉配置已保存")
      await loadDingTalkConfig()
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "保存钉钉配置失败"
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  // 测试钉钉连接
  const handleTestDingTalkConnection = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setDingTalkTesting(true)
    try {
      await settingsApi.testDingTalkConnection(token, dingTalkConfig)
      toast.success("钉钉连接测试成功")
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "钉钉连接测试失败"
      toast.error(errorMessage)
    } finally {
      setDingTalkTesting(false)
    }
  }

  // 加载企业微信配置
  const loadWeComConfig = async () => {
    const token = getAccessToken()
    if (!token) return

    setWeComLoading(true)
    try {
      const config = await settingsApi.getWeComConfig(token)
      setWeComConfig(config)
      setWechatEnabled(config.enabled)
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "加载企业微信配置失败"
      toast.error(errorMessage)
    } finally {
      setWeComLoading(false)
    }
  }

  // 保存企业微信配置
  const handleSaveWeComConfig = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setIsSaving(true)
    try {
      await settingsApi.saveWeComConfig(token, weComConfig)
      toast.success("企业微信配置已保存")
      await loadWeComConfig()
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "保存企业微信配置失败"
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  // 测试企业微信连接
  const handleTestWeComConnection = async () => {
    const token = getAccessToken()
    if (!token) {
      toast.error("未登录，请重新登录")
      return
    }

    setWeComTesting(true)
    try {
      await settingsApi.testWeComConnection(token, weComConfig)
      toast.success("企业微信连接测试成功")
    } catch (error: any) {
      const errorMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.detail?.message || error?.message || "企业微信连接测试失败"
      toast.error(errorMessage)
    } finally {
      setWeComTesting(false)
    }
  }

  // 统一保存按钮处理
  const handleSaveCurrentConfig = async () => {
    switch (currentTab) {
      case "email":
        await handleSaveSMTPConfig()
        break
      case "webhook":
        await handleSaveWebhookConfig()
        break
      case "dingding":
        await handleSaveDingTalkConfig()
        break
      case "wechat":
        await handleSaveWeComConfig()
        break
    }
  }

  return (
    <>
      <PageHeader title="通知设置">
        <Button onClick={handleSaveCurrentConfig} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          保存设置
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">邮件通知</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${emailEnabled ? "text-green-600" : "text-gray-600"}`}>
                {emailEnabled ? "已启用" : "未启用"}
              </div>
              <p className="text-xs text-muted-foreground">
                {emailEnabled ? "SMTP已配置" : "需要配置"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">钉钉通知</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${dingdingEnabled ? "text-green-600" : "text-gray-600"}`}>
                {dingdingEnabled ? "已启用" : "未启用"}
              </div>
              <p className="text-xs text-muted-foreground">
                {dingdingEnabled ? "Webhook已配置" : "需要配置"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">企业微信</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${wechatEnabled ? "text-green-600" : "text-gray-600"}`}>
                {wechatEnabled ? "已启用" : "未启用"}
              </div>
              <p className="text-xs text-muted-foreground">
                {wechatEnabled ? "Webhook已配置" : "需要配置"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Webhook</CardTitle>
              <Webhook className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${webhookEnabled ? "text-green-600" : "text-gray-600"}`}>
                {webhookEnabled ? "已启用" : "未启用"}
              </div>
              <p className="text-xs text-muted-foreground">
                {webhookEnabled ? "已配置" : "需要配置"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="email" className="w-full" value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="email">邮件通知</TabsTrigger>
            <TabsTrigger value="dingding">钉钉</TabsTrigger>
            <TabsTrigger value="wechat">企业微信</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>邮件服务器配置</CardTitle>
                    <CardDescription>配置 SMTP 服务器用于发送系统邮件通知</CardDescription>
                  </div>
                  <Badge className={smtpConfig.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {smtpConfig.enabled ? "已启用" : "未启用"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {smtpLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email-enabled">启用邮件通知</Label>
                      <Switch
                        id="email-enabled"
                        checked={smtpConfig.enabled}
                        onCheckedChange={(checked) => {
                          setSmtpConfig((prev) => ({ ...prev, enabled: checked }))
                          setEmailEnabled(checked)
                        }}
                      />
                    </div>
                    {smtpConfig.enabled && (
                      <>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>SMTP 服务器</Label>
                            <Input
                              placeholder="smtp.gmail.com"
                              value={smtpConfig.host}
                              onChange={(e) => setSmtpConfig((prev) => ({ ...prev, host: e.target.value }))}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>端口</Label>
                              <Input
                                type="number"
                                placeholder="587"
                                value={smtpConfig.port}
                                onChange={(e) =>
                                  setSmtpConfig((prev) => ({ ...prev, port: parseInt(e.target.value) || 587 }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>加密方式</Label>
                              <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                  id="use-tls"
                                  checked={smtpConfig.use_tls}
                                  onCheckedChange={(checked) => setSmtpConfig((prev) => ({ ...prev, use_tls: checked }))}
                                />
                                <Label htmlFor="use-tls" className="font-normal">
                                  {smtpConfig.use_tls ? "TLS" : "无加密"}
                                </Label>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>用户名</Label>
                            <Input
                              placeholder="your-email@gmail.com"
                              value={smtpConfig.username}
                              onChange={(e) => setSmtpConfig((prev) => ({ ...prev, username: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>密码</Label>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              value={smtpConfig.password}
                              onChange={(e) => setSmtpConfig((prev) => ({ ...prev, password: e.target.value }))}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>发件人邮箱</Label>
                              <Input
                                placeholder="noreply@easyssh.com"
                                value={smtpConfig.from_email}
                                onChange={(e) => setSmtpConfig((prev) => ({ ...prev, from_email: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>发件人名称</Label>
                              <Input
                                placeholder="EasySSH 系统"
                                value={smtpConfig.from_name}
                                onChange={(e) => setSmtpConfig((prev) => ({ ...prev, from_name: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" onClick={handleTestSMTPConnection} disabled={smtpTesting}>
                            {smtpTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Send className="mr-2 h-4 w-4" />
                            发送测试邮件
                          </Button>
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-xs text-muted-foreground">
                            💡 提示: 常见 SMTP 服务商配置
                            <br />• Gmail: smtp.gmail.com:587 (需要应用专用密码)
                            <br />• QQ 邮箱: smtp.qq.com:587 (需要授权码)
                            <br />• 163 邮箱: smtp.163.com:465
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>用户通知偏好</CardTitle>
                <CardDescription>用户可以在个人设置中配置自己的邮件通知偏好</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">
                    💡 提示：用户可以在个人设置中配置以下通知偏好：
                    <br />• 登录邮件通知
                    <br />• 告警邮件通知
                    <br />• 浏览器推送通知
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>系统通知事件</CardTitle>
                <CardDescription>配置系统级邮件通知事件（功能开发中）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>服务器离线告警</Label>
                  <Switch defaultChecked disabled />
                </div>
                <div className="flex items-center justify-between">
                  <Label>高风险操作告警</Label>
                  <Switch defaultChecked disabled />
                </div>
                <div className="flex items-center justify-between">
                  <Label>登录失败告警</Label>
                  <Switch defaultChecked disabled />
                </div>
                <div className="flex items-center justify-between">
                  <Label>定时任务失败</Label>
                  <Switch disabled />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dingding" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>钉钉机器人配置</CardTitle>
                    <CardDescription>配置钉钉群机器人 Webhook 地址</CardDescription>
                  </div>
                  <Badge className={dingTalkConfig.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {dingTalkConfig.enabled ? "已启用" : "未启用"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {dingTalkLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="dingtalk-enabled">启用钉钉通知</Label>
                      <Switch
                        id="dingtalk-enabled"
                        checked={dingTalkConfig.enabled}
                        onCheckedChange={(checked) => {
                          setDingTalkConfig((prev) => ({ ...prev, enabled: checked }))
                          setDingdingEnabled(checked)
                        }}
                      />
                    </div>
                    {dingTalkConfig.enabled && (
                      <>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input
                              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                              value={dingTalkConfig.webhook_url}
                              onChange={(e) => setDingTalkConfig((prev) => ({ ...prev, webhook_url: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>签名密钥 (可选)</Label>
                            <Input
                              type="password"
                              placeholder="SEC..."
                              value={dingTalkConfig.secret}
                              onChange={(e) => setDingTalkConfig((prev) => ({ ...prev, secret: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                              如果机器人启用了加签，需要填写此项
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" onClick={handleTestDingTalkConnection} disabled={dingTalkTesting}>
                            {dingTalkTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Send className="mr-2 h-4 w-4" />
                            发送测试消息
                          </Button>
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-xs text-muted-foreground">
                            💡 配置步骤:
                            <br />1. 在钉钉群聊中创建自定义机器人
                            <br />2. 复制 Webhook URL 填写到上方
                            <br />3. 如果启用了加签,填写密钥
                            <br />4. 点击"发送测试消息"验证配置
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wechat" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>企业微信机器人配置</CardTitle>
                    <CardDescription>配置企业微信群机器人 Webhook 地址</CardDescription>
                  </div>
                  <Badge className={weComConfig.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {weComConfig.enabled ? "已启用" : "未启用"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {weComLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wecom-enabled">启用企业微信通知</Label>
                      <Switch
                        id="wecom-enabled"
                        checked={weComConfig.enabled}
                        onCheckedChange={(checked) => {
                          setWeComConfig((prev) => ({ ...prev, enabled: checked }))
                          setWechatEnabled(checked)
                        }}
                      />
                    </div>
                    {weComConfig.enabled && (
                      <>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input
                              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                              value={weComConfig.webhook_url}
                              onChange={(e) => setWeComConfig((prev) => ({ ...prev, webhook_url: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" onClick={handleTestWeComConnection} disabled={weComTesting}>
                            {weComTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Send className="mr-2 h-4 w-4" />
                            发送测试消息
                          </Button>
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-xs text-muted-foreground">
                            💡 配置步骤:
                            <br />1. 在企业微信群聊中创建群机器人
                            <br />2. 复制 Webhook URL 填写到上方
                            <br />3. 点击"发送测试消息"验证配置
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhook" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>自定义 Webhook</CardTitle>
                    <CardDescription>配置自定义 Webhook 接收通知</CardDescription>
                  </div>
                  <Badge className={webhookConfig.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {webhookConfig.enabled ? "已启用" : "未启用"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {webhookLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="webhook-enabled">启用 Webhook 通知</Label>
                      <Switch
                        id="webhook-enabled"
                        checked={webhookConfig.enabled}
                        onCheckedChange={(checked) => {
                          setWebhookConfig((prev) => ({ ...prev, enabled: checked }))
                          setWebhookEnabled(checked)
                        }}
                      />
                    </div>
                    {webhookConfig.enabled && (
                      <>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input
                              placeholder="https://your-domain.com/webhook"
                              value={webhookConfig.url}
                              onChange={(e) => setWebhookConfig((prev) => ({ ...prev, url: e.target.value }))}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>请求方法</Label>
                              <Select
                                value={webhookConfig.method}
                                onValueChange={(value) => setWebhookConfig((prev) => ({ ...prev, method: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="选择请求方法" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="POST">POST</SelectItem>
                                  <SelectItem value="GET">GET</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>签名密钥 (可选)</Label>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                value={webhookConfig.secret}
                                onChange={(e) => setWebhookConfig((prev) => ({ ...prev, secret: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" onClick={handleTestWebhookConnection} disabled={webhookTesting}>
                            {webhookTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Send className="mr-2 h-4 w-4" />
                            发送测试请求
                          </Button>
                        </div>
                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-xs text-muted-foreground">
                            💡 提示:
                            <br />• 系统会将事件通知发送到配置的 URL
                            <br />• 如果配置了密钥,请求头会包含 HMAC-SHA256 签名
                            <br />• 请求格式: {"{"}"event": "test", "data": {"{...}"}{"}"}
                            <br />• 支持自动重试(最多3次)
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
