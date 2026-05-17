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
import { X } from "lucide-react"
import { PrivateKeyInput } from "@/components/servers/private-key-input"
import { useTranslations } from "next-intl"
import { toast } from "@/components/ui/sonner"
import { ServerTagCombobox } from "@/components/servers/server-tag-combobox"
interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (data: ServerFormData) => void
  availableGroups?: string[]
  availableTags?: string[]
}

export interface ServerFormData {
  name?: string
  host: string
  port: string
  username: string
  authMethod: "password" | "privateKey"
  password: string
  privateKey: string
  rememberPassword: boolean
  tags: string[]
  description: string
  group?: string
  jumpServer: string
  autoConnect: boolean
  keepAlive: boolean
}

export function AddServerDialog({
  open,
  onOpenChange,
  onSubmit,
  availableGroups = [],
  availableTags = [],
}: AddServerDialogProps) {
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

  const [newTag, setNewTag] = useState("")
  const tServers = useTranslations("servers")

  const getEmptyFormData = (): ServerFormData => ({
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

  const handleInputChange = (field: keyof ServerFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.trim()
    const tagExists = formData.tags.some(
      (existingTag) => existingTag.trim().toLowerCase() === normalizedTag.toLowerCase()
    )

    if (normalizedTag && !tagExists) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, normalizedTag]
      }))
    }

    setNewTag("")
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
      toast.error(tServers("quickFormHostRequired"))
      return
    }
    if (!formData.username.trim()) {
      toast.error(tServers("quickFormUsernameRequired"))
      return
    }

    // 验证端口号
    const port = parseInt(formData.port)
    if (isNaN(port) || port < 1 || port > 65535) {
      toast.error(tServers("quickFormPortInvalid"))
      return
    }

    const normalized = {
      ...formData,
      jumpServer: formData.jumpServer === "none" ? "" : formData.jumpServer,
    }
    onSubmit?.(normalized)
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setFormData(getEmptyFormData())
    setNewTag("")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  const handleCancel = () => {
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-none flex flex-col gap-0 p-0"
        style={{
          width: 'min(920px, calc(100vw - 2rem))',
          height: 'min(680px, calc(100vh - 3rem))'
        }}
      >
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle>{tServers("quickFormDialogTitle")}</DialogTitle>
            {/* 为无障碍提供描述，避免控制台警告 */}
            <DialogDescription className="sr-only">
              {tServers("quickFormDialogDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="server" className="w-full flex-1 flex flex-col overflow-hidden px-6 pt-4">
          <TabsList className="w-full">
            <TabsTrigger value="server">{tServers("quickFormTabServer")}</TabsTrigger>
            <TabsTrigger value="advanced">{tServers("quickFormTabAdvanced")}</TabsTrigger>
            <TabsTrigger value="settings">{tServers("quickFormTabSettings")}</TabsTrigger>
          </TabsList>

          {/* 云服务器标签 */}
          <TabsContent value="server" className="flex-1 overflow-y-auto mt-4 pr-1 pl-0.5">
            <div className="space-y-4 px-1">
              {/* 连接信息 */}
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="host">{tServers("quickFormHostLabel")}</Label>
                  <Input
                    id="host"
                    placeholder={tServers("quickFormHostPlaceholder")}
                    value={formData.host}
                    onChange={(e) => handleInputChange("host", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="port">{tServers("quickFormPortLabel")}</Label>
                  <Input
                    id="port"
                    placeholder="22"
                    value={formData.port}
                    onChange={(e) => handleInputChange("port", e.target.value)}
                  />
                </div>
              </div>

              {/* 用户信息 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username">{tServers("quickFormUsernameLabel")}</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    placeholder={tServers("quickFormUsernamePlaceholder")}
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">{tServers("quickFormNameLabel")}</Label>
                  <Input
                    id="name"
                    placeholder={tServers("quickFormNamePlaceholder")}
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                  />
                </div>
              </div>

              {/* 分组和标签 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="server-group">{tServers("quickFormGroupLabel")}</Label>
                  <Input
                    id="server-group"
                    list="server-group-options"
                    placeholder={tServers("quickFormGroupPlaceholder")}
                    value={formData.group || ""}
                    onChange={(e) => handleInputChange("group", e.target.value)}
                  />
                  {availableGroups.length > 0 && (
                    <datalist id="server-group-options">
                      {availableGroups.map((group) => (
                        <option key={group} value={group} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="server-tags">{tServers("quickFormTagsLabel")}</Label>
                  <ServerTagCombobox
                    id="server-tags"
                    value={newTag}
                    onValueChange={setNewTag}
                    selectedTags={formData.tags}
                    availableTags={availableTags}
                    placeholder={tServers("quickFormTagsPlaceholder")}
                    createLabel={(tag) => tServers("quickFormCreateTag", { tag })}
                    onAddTag={handleAddTag}
                  />
                </div>
              </div>

              {/* 标签显示 */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTag(tag)}
                        className="h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* 认证方式 */}
              <div className="space-y-3 pt-2">
                <Label>{tServers("quickFormAuthMethodLabel")}</Label>
                <Tabs
                  className="w-full"
                  value={formData.authMethod}
                  onValueChange={(value) => handleInputChange("authMethod", value as "password" | "privateKey")}
                >
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="password">
                      {tServers("quickFormAuthMethodPassword")}
                    </TabsTrigger>
                    <TabsTrigger value="privateKey">
                      {tServers("quickFormAuthMethodPrivateKey")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="password" forceMount className="mt-3 data-[state=inactive]:hidden">
                    {/* 将密码输入包裹在 form 中，并提供隐藏的用户名字段，满足密码管理器与无障碍建议 */}
                    <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
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
                      <div className="space-y-1.5">
                        <Label htmlFor="password">{tServers("quickFormPasswordLabel")}</Label>
                        <Input
                          id="password"
                          type="password"
                          autoComplete="new-password"
                          placeholder={tServers("quickFormPasswordPlaceholder")}
                          value={formData.password}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
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

                  <TabsContent value="privateKey" forceMount className="mt-3 data-[state=inactive]:hidden">
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
            </div>
          </TabsContent>

          {/* 高级配置标签 */}
          <TabsContent value="advanced" className="flex-1 overflow-y-auto mt-4 pr-1 pl-0.5">
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="description">{tServers("quickFormDescriptionLabel")}</Label>
              <Textarea
                id="description"
                placeholder={tServers("quickFormDescriptionPlaceholder")}
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jumpServer">{tServers("quickFormJumpServerLabel")}</Label>
              <Select
                value={formData.jumpServer}
                onValueChange={(value) => handleInputChange("jumpServer", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tServers("quickFormJumpServerPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tServers("quickFormJumpServerNone")}</SelectItem>
                  <SelectItem value="jump-01">跳板机01 (192.168.1.10)</SelectItem>
                  <SelectItem value="jump-02">跳板机02 (192.168.1.11)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
          </TabsContent>

          {/* 其他设置标签 */}
          <TabsContent value="settings" className="flex-1 overflow-y-auto mt-4 pr-1 pl-0.5">
            <div className="space-y-4 px-1">
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
        <div className="flex justify-end gap-2 px-6 py-4">
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
