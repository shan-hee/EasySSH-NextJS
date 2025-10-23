"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus } from "lucide-react"
import { PrivateKeyInput } from "@/components/servers/private-key-input"

interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (data: ServerFormData) => void
}

export interface ServerFormData {
  name: string
  host: string
  port: string
  username: string
  authMethod: "password" | "privateKey"
  password: string
  privateKey: string
  rememberPassword: boolean
  tags: string[]
  description: string
  jumpServer: string
  autoConnect: boolean
  keepAlive: boolean
}

export function AddServerDialog({ open, onOpenChange, onSubmit }: AddServerDialogProps) {
  // 认证方式切换改为使用 shadcn Tabs，统一以 formData.authMethod 为单一数据源
  const [formData, setFormData] = useState<ServerFormData>({
    name: "",
    host: "",
    port: "22",
    username: "",
    authMethod: "password",
    password: "",
    privateKey: "",
    rememberPassword: false,
    tags: [],
    description: "",
    jumpServer: "",
    autoConnect: false,
    keepAlive: true,
  })

  const [newTag, setNewTag] = useState("")

  const handleInputChange = (field: keyof ServerFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleSave = () => {
    const normalized = {
      ...formData,
      jumpServer: formData.jumpServer === "none" ? "" : formData.jumpServer,
    }
    onSubmit?.(normalized)
    onOpenChange(false)
  }

  const handleSaveAndConnect = () => {
    const normalized = {
      ...formData,
      jumpServer: formData.jumpServer === "none" ? "" : formData.jumpServer,
    }
    onSubmit?.(normalized)
    // 这里可以添加连接逻辑
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
    // 重置表单
    setFormData({
      name: "",
      host: "",
      port: "22",
      username: "",
      authMethod: "password",
      password: "",
      privateKey: "",
      rememberPassword: false,
      tags: [],
      description: "",
      jumpServer: "",
      autoConnect: false,
      keepAlive: true,
    })
    setNewTag("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>新建连接</DialogTitle>
          {/* 为无障碍提供描述，避免控制台警告 */}
          <DialogDescription className="sr-only">
            填写服务器连接信息（主机、端口、用户名与认证方式），并选择是否自动连接与保持连接。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="server" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="server">云服务器</TabsTrigger>
            <TabsTrigger value="advanced">高级配置</TabsTrigger>
            <TabsTrigger value="settings">其他设置</TabsTrigger>
          </TabsList>

          {/* 云服务器标签 */}
          <TabsContent value="server" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">云服务器公网IP或域名</Label>
                <Input
                  id="host"
                  placeholder="请输入云服务器公网IP或域名"
                  value={formData.host}
                  onChange={(e) => handleInputChange("host", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">云服务器端口</Label>
                <Input
                  id="port"
                  placeholder="22"
                  value={formData.port}
                  onChange={(e) => handleInputChange("port", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="请输入用户名"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">备注 (选填)</Label>
                <Input
                  id="name"
                  placeholder="请输入备注"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>验证方式</Label>
              <Tabs
                className="w-full"
                value={formData.authMethod}
                onValueChange={(value) => handleInputChange("authMethod", value as "password" | "privateKey")}
              >
                <TabsList className="w-1/2">
                  <TabsTrigger value="password">密码验证</TabsTrigger>
                  <TabsTrigger value="privateKey">私钥验证</TabsTrigger>
                </TabsList>

                <TabsContent value="password" forceMount className="space-y-2 mt-4 data-[state=inactive]:hidden">
                  {/* 将密码输入包裹在 form 中，并提供隐藏的用户名字段，满足密码管理器与无障碍建议 */}
                  <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
                    <Label htmlFor="username-hidden" className="sr-only">用户名</Label>
                    <Input
                      id="username-hidden"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={formData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                      className="sr-only"
                    />
                    <Label htmlFor="password">密码 (选填)</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="请输入密码"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                    />
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="remember"
                        checked={formData.rememberPassword}
                        onCheckedChange={(checked) =>
                          handleInputChange("rememberPassword", checked === true)
                        }
                      />
                      <Label
                        htmlFor="remember"
                        className="text-sm font-normal cursor-pointer"
                      >
                        记住密码
                      </Label>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="privateKey" forceMount className="mt-4 data-[state=inactive]:hidden">
                  <PrivateKeyInput
                    id="privateKey"
                    label="私钥"
                    value={formData.privateKey}
                    onChange={(v) => handleInputChange("privateKey", v)}
                    placeholder="请输入或从文件导入私钥内容"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* 高级配置标签 */}
          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="description">服务器描述</Label>
              <Textarea
                id="description"
                placeholder="输入服务器描述信息..."
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jumpServer">跳板机</Label>
              <Select
                value={formData.jumpServer}
                onValueChange={(value) => handleInputChange("jumpServer", value)}
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

            <div className="space-y-2">
              <Label>标签</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag) => (
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
          </TabsContent>

          {/* 其他设置标签 */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>自动连接</Label>
                  <p className="text-sm text-muted-foreground">
                    在服务器列表中自动建立连接
                  </p>
                </div>
                <Switch
                  checked={formData.autoConnect}
                  onCheckedChange={(checked) => handleInputChange("autoConnect", checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>保持连接</Label>
                  <p className="text-sm text-muted-foreground">
                    启用TCP Keep-Alive保持连接活跃
                  </p>
                </div>
                <Switch
                  checked={formData.keepAlive}
                  onCheckedChange={(checked) => handleInputChange("keepAlive", checked)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button variant="outline" onClick={handleSave}>
            保存
          </Button>
          <Button onClick={handleSaveAndConnect}>
            保存并连接
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
