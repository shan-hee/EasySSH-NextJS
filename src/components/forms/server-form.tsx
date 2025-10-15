"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useFormValidation, validationRules } from "@/hooks/use-form-validation"
import { X, Plus, Save, TestTube } from "lucide-react"
import { PrivateKeyInput } from "@/components/servers/private-key-input"

interface ServerFormData {
  name: string
  host: string
  port: number
  username: string
  password: string
  privateKey: string
  authMethod: "password" | "privateKey"
  description: string
  tags: string[]
  autoConnect: boolean
  keepAlive: boolean
  jumpServer: string
}

interface ServerFormProps {
  initialData?: Partial<ServerFormData>
  onSubmit: (data: ServerFormData) => void
  onCancel?: () => void
  isLoading?: boolean
}

const defaultValues: ServerFormData = {
  name: "",
  host: "",
  port: 22,
  username: "",
  password: "",
  privateKey: "",
  authMethod: "password",
  description: "",
  tags: [],
  autoConnect: false,
  keepAlive: true,
  jumpServer: "",
}

export function ServerForm({ initialData, onSubmit, onCancel, isLoading }: ServerFormProps) {
  const [newTag, setNewTag] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  const {
    values,
    errors,
    setValue,
    validate,
    handleSubmit,
  } = useFormValidation<ServerFormData>(
    { ...defaultValues, ...initialData },
    {
      name: validationRules.required,
      host: {
        required: true,
        validate: (value: string) => {
          // 验证IP地址或域名
          const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
          const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/
          return ipPattern.test(value) || domainPattern.test(value) || "请输入有效的IP地址或域名"
        }
      },
      port: {
        required: true,
        validate: (value: number) => {
          return (value >= 1 && value <= 65535) || "端口号必须在1-65535之间"
        }
      },
      username: validationRules.required,
      password: values.authMethod === "password" ? validationRules.required : {},
      privateKey: values.authMethod === "privateKey" ? validationRules.required : {},
    }
  )

  const handleAddTag = () => {
    if (newTag.trim() && !values.tags.includes(newTag.trim())) {
      setValue("tags", [...values.tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setValue("tags", values.tags.filter(tag => tag !== tagToRemove))
  }

  const handleTestConnection = async () => {
    // 验证必要字段
    const isValid = validate("name") && validate("host") && validate("port") && validate("username")
    if (!isValid) return

    setIsConnecting(true)
    try {
      // 模拟连接测试
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log("连接测试成功")
      // 这里应该显示成功消息
    } catch (error) {
      console.error("连接测试失败:", error)
      // 这里应该显示错误消息
    } finally {
      setIsConnecting(false)
    }
  }

  const onFormSubmit = handleSubmit((data) => {
    const normalized = {
      ...data,
      jumpServer: data.jumpServer === "none" ? "" : data.jumpServer,
    }
    onSubmit(normalized)
  })


  return (
    <form onSubmit={onFormSubmit} className="space-y-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>配置服务器的基本连接参数</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">服务器名称 *</Label>
              <Input
                id="name"
                value={values.name}
                onChange={(e) => setValue("name", e.target.value)}
                placeholder="输入服务器名称"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="host">主机地址 *</Label>
              <Input
                id="host"
                value={values.host}
                onChange={(e) => setValue("host", e.target.value)}
                placeholder="IP地址或域名"
                className={errors.host ? "border-red-500" : ""}
              />
              {errors.host && (
                <p className="text-sm text-red-500">{errors.host}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">端口 *</Label>
              <Input
                id="port"
                type="number"
                value={values.port}
                onChange={(e) => setValue("port", parseInt(e.target.value) || 22)}
                placeholder="22"
                min="1"
                max="65535"
                className={errors.port ? "border-red-500" : ""}
              />
              {errors.port && (
                <p className="text-sm text-red-500">{errors.port}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">用户名 *</Label>
              <Input
                id="username"
                value={values.username}
                onChange={(e) => setValue("username", e.target.value)}
                placeholder="登录用户名"
                className={errors.username ? "border-red-500" : ""}
              />
              {errors.username && (
                <p className="text-sm text-red-500">{errors.username}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={values.description}
              onChange={(e) => setValue("description", e.target.value)}
              placeholder="服务器描述信息"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 认证信息 */}
      <Card>
        <CardHeader>
          <CardTitle>认证信息</CardTitle>
          <CardDescription>选择认证方式并配置相应的认证信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>认证方式</Label>
            <Select
              value={values.authMethod}
              onValueChange={(value: "password" | "privateKey") => setValue("authMethod", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">密码认证</SelectItem>
                <SelectItem value="privateKey">私钥认证</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {values.authMethod === "password" ? (
            <div className="space-y-2">
              <Label htmlFor="password">密码 *</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => setValue("password", e.target.value)}
                placeholder="登录密码"
                className={errors.password ? "border-red-500" : ""}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password}</p>
              )}
            </div>
          ) : (
            <PrivateKeyInput
              id="privateKey"
              label="私钥"
              required
              value={values.privateKey}
              onChange={(v) => setValue("privateKey", v)}
              placeholder="粘贴或从文件导入私钥内容"
              errorText={errors.privateKey as string | undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* 高级设置 */}
      <Card>
        <CardHeader>
          <CardTitle>高级设置</CardTitle>
          <CardDescription>配置标签、跳板机和连接选项</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 标签管理 */}
          <div className="space-y-2">
            <Label>标签</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {values.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTag(tag)}
                    className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="添加标签"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jumpServer">跳板机</Label>
            <Select
              value={values.jumpServer}
              onValueChange={(value) => setValue("jumpServer", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择跳板机（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                <SelectItem value="jump-01">跳板机01 (192.168.1.10)</SelectItem>
                <SelectItem value="jump-02">跳板机02 (192.168.1.11)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>自动连接</Label>
                <p className="text-sm text-muted-foreground">
                  在服务器列表中自动建立连接
                </p>
              </div>
              <Switch
                checked={values.autoConnect}
                onCheckedChange={(checked) => setValue("autoConnect", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>保持连接</Label>
                <p className="text-sm text-muted-foreground">
                  启用TCP Keep-Alive保持连接活跃
                </p>
              </div>
              <Switch
                checked={values.keepAlive}
                onCheckedChange={(checked) => setValue("keepAlive", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={isConnecting}
        >
          <TestTube className="mr-2 h-4 w-4" />
          {isConnecting ? "测试中..." : "测试连接"}
        </Button>

        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </form>
  )
}
