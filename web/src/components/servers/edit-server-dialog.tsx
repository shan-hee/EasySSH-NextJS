"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
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

interface EditServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (data: ServerFormData) => void
  initialData?: Partial<ServerFormData>
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
  group: string
  jumpServer: string
  autoConnect: boolean
  keepAlive: boolean
}

export function EditServerDialog({ open, onOpenChange, onSubmit, initialData }: EditServerDialogProps) {
  const tServers = useTranslations("servers")
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
    group: "",
    jumpServer: "",
    autoConnect: false,
    keepAlive: true,
  })

  // 当initialData变化时更新表单
  useEffect(() => {
    if (initialData && open) {
      const timer = setTimeout(() => {
        setFormData({
          name: initialData.name || "",
          host: initialData.host || "",
          port: initialData.port || "22",
          username: initialData.username || "",
          authMethod: initialData.authMethod || "password",
          password: initialData.password || "",
          privateKey: initialData.privateKey || "",
          rememberPassword: initialData.rememberPassword || false,
          tags: initialData.tags || [],
          description: initialData.description || "",
          group: initialData.group || "",
          jumpServer: initialData.jumpServer || "",
          autoConnect: initialData.autoConnect || false,
          keepAlive: initialData.keepAlive !== undefined ? initialData.keepAlive : true,
        })
      }, 0)

      return () => clearTimeout(timer)
    }
  }, [initialData, open])

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
    // 验证必填字段
    if (!formData.host.trim()) {
      alert(tServers("quickFormHostRequired"))
      return
    }
    if (!formData.username.trim()) {
      alert(tServers("quickFormUsernameRequired"))
      return
    }

    // 验证端口号
    const port = parseInt(formData.port)
    if (isNaN(port) || port < 1 || port > 65535) {
      alert(tServers("quickFormPortInvalid"))
      return
    }

    const normalized = {
      ...formData,
      jumpServer: formData.jumpServer === "none" ? "" : formData.jumpServer,
    }
    onSubmit?.(normalized)
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
      group: "",
      jumpServer: "",
      autoConnect: false,
      keepAlive: true,
    })
    setNewTag("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[580px] flex flex-col p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle>{tServers("editDialogTitle")}</DialogTitle>
            {/* 为无障碍提供描述，避免控制台警告 */}
            <DialogDescription className="sr-only">
              {tServers("editDialogDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="server" className="w-full flex-1 flex flex-col overflow-hidden px-6">
          <TabsList className="w-full">
            <TabsTrigger value="server">
              {tServers("quickFormTabServer")}
            </TabsTrigger>
            <TabsTrigger value="advanced">
              {tServers("quickFormTabAdvanced")}
            </TabsTrigger>
            <TabsTrigger value="settings">
              {tServers("quickFormTabSettings")}
            </TabsTrigger>
          </TabsList>

          {/* 云服务器标签 */}
          <TabsContent value="server" className="space-y-4 mt-4 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">
                  {tServers("quickFormHostLabel")}
                </Label>
                <Input
                  id="host"
                  placeholder={tServers("quickFormHostPlaceholder")}
                  value={formData.host}
                  onChange={(e) => handleInputChange("host", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">
                  {tServers("quickFormPortLabel")}
                </Label>
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
                <Label htmlFor="username">
                  {tServers("quickFormUsernameLabel")}
                </Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder={tServers("quickFormUsernamePlaceholder")}
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">
                  {tServers("quickFormNameLabel")}
                </Label>
                <Input
                  id="name"
                  placeholder={tServers("quickFormNamePlaceholder")}
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tServers("quickFormAuthMethodLabel")}</Label>
              <Tabs
                className="w-full"
                value={formData.authMethod}
                onValueChange={(value) => handleInputChange("authMethod", value as "password" | "privateKey")}
              >
                <TabsList className="w-1/2">
                  <TabsTrigger value="password">
                    {tServers("quickFormAuthMethodPassword")}
                  </TabsTrigger>
                  <TabsTrigger value="privateKey">
                    {tServers("quickFormAuthMethodPrivateKey")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="password" forceMount className="space-y-2 mt-4 data-[state=inactive]:hidden">
                  {/* 将密码输入包裹在 form 中，并提供隐藏的用户名字段，满足密码管理器与无障碍建议 */}
                  <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
                    <Label htmlFor="username-hidden" className="sr-only">
                      {tServers("quickFormUsernameLabel")}
                    </Label>
                    <Input
                      id="username-hidden"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={formData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                      className="sr-only"
                    />
                    <Label htmlFor="password">
                      {tServers("quickFormPasswordLabel")}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder={tServers("quickFormPasswordPlaceholder")}
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
                        {tServers("quickFormRememberPasswordLabel")}
                      </Label>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="privateKey" forceMount className="mt-4 data-[state=inactive]:hidden">
                  <PrivateKeyInput
                    id="privateKey"
                    label={tServers("quickFormPrivateKeyLabel")}
                    value={formData.privateKey}
                    onChange={(v) => handleInputChange("privateKey", v)}
                    placeholder={tServers("quickFormPrivateKeyPlaceholder")}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* 高级配置标签 */}
          <TabsContent value="advanced" className="space-y-4 mt-4 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="description">
                {tServers("quickFormDescriptionLabel")}
              </Label>
              <Textarea
                id="description"
                placeholder={tServers("quickFormDescriptionPlaceholder")}
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jumpServer">
                {tServers("quickFormJumpServerLabel")}
              </Label>
              <Select
                value={formData.jumpServer}
                onValueChange={(value) => handleInputChange("jumpServer", value)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={tServers("quickFormJumpServerPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {tServers("quickFormJumpServerNone")}
                  </SelectItem>
                  <SelectItem value="jump-01">Jump host 01 (192.168.1.10)</SelectItem>
                  <SelectItem value="jump-02">Jump host 02 (192.168.1.11)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tServers("quickFormTagsLabel")}</Label>
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
                  placeholder={tServers("quickFormTagsPlaceholder")}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 其他设置标签 */}
          <TabsContent value="settings" className="space-y-4 mt-4 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>{tServers("quickFormAutoConnectLabel")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {tServers("quickFormAutoConnectDescription")}
                  </p>
                </div>
                <Switch
                  checked={formData.autoConnect}
                  onCheckedChange={(checked) => handleInputChange("autoConnect", checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>{tServers("quickFormKeepAliveLabel")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {tServers("quickFormKeepAliveDescription")}
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
        <div className="flex justify-end gap-2 p-6">
          <Button variant="outline" onClick={handleCancel}>
            {tServers("quickFormCancelButton")}
          </Button>
          <Button onClick={handleSave}>
            {tServers("quickFormSaveButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
