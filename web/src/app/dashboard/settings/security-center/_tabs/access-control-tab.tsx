"use client"

import { useState, useEffect } from "react"
import { SettingsSection } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Shield, Trash2, Plus } from "lucide-react"
import { settingsApi, type IPWhitelist } from "@/lib/api/settings"
import { getAccessToken } from "@/contexts/auth-context"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function AccessControlTab() {
  const [ipWhitelists, setIpWhitelists] = useState<IPWhitelist[]>([])
  const [newIPAddress, setNewIPAddress] = useState("")
  const [newIPDescription, setNewIPDescription] = useState("")
  const [isAddingIP, setIsAddingIP] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 加载 IP 白名单配置
  useEffect(() => {
    loadIPWhitelistConfig()
  }, [])

  const loadIPWhitelistConfig = async () => {
    try {
      setIsLoading(true)
      const token = await getAccessToken()
      if (!token) {
        toast.error("未找到访问令牌")
        return
      }

      const whitelists = await settingsApi.getIPWhitelistList(token)
      setIpWhitelists(whitelists)
    } catch (error) {
      console.error("Failed to load IP whitelist config:", error)
      toast.error("加载 IP 白名单配置失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddIP = async () => {
    if (!newIPAddress.trim()) {
      toast.error("请输入 IP 地址")
      return
    }

    // 简单验证IP格式
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
    if (!ipRegex.test(newIPAddress.trim())) {
      toast.error("请输入有效的IP地址或CIDR格式")
      return
    }

    setIsAddingIP(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("未找到访问令牌")
        return
      }

      const newIP = await settingsApi.createIPWhitelist(token, {
        ip_address: newIPAddress.trim(),
        description: newIPDescription.trim(),
      })

      setIpWhitelists((prev) => [newIP, ...prev])
      setNewIPAddress("")
      setNewIPDescription("")
      toast.success("IP 地址添加成功")
    } catch (error) {
      console.error("Failed to add IP:", error)
      toast.error("添加 IP 地址失败")
    } finally {
      setIsAddingIP(false)
    }
  }

  const handleToggleIP = async (id: number) => {
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("未找到访问令牌")
        return
      }

      await settingsApi.toggleIPWhitelist(token, id)

      setIpWhitelists((prev) =>
        prev.map((ip) => (ip.id === id ? { ...ip, enabled: !ip.enabled } : ip))
      )
      toast.success("IP 状态切换成功")
    } catch (error) {
      console.error("Failed to toggle IP:", error)
      toast.error("切换 IP 状态失败")
    }
  }

  const handleDeleteIP = async (id: number) => {
    if (!confirm("确定要删除这个 IP 地址吗？")) {
      return
    }

    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("未找到访问令牌")
        return
      }

      await settingsApi.deleteIPWhitelist(token, id)

      setIpWhitelists((prev) => prev.filter((ip) => ip.id !== id))
      toast.success("IP 地址删除成功")
    } catch (error) {
      console.error("Failed to delete IP:", error)
      toast.error("删除 IP 地址失败")
    }
  }

  return (
    <SettingsSection
      title="IP 白名单管理"
      description="配置允许访问系统的IP地址"
      icon={<Shield className="h-5 w-5" />}
    >
      {/* 添加IP表单 */}
      <div className="rounded-lg border p-4 space-y-4">
        <h4 className="text-sm font-medium">添加新 IP 地址</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ip-address">IP 地址 / CIDR</Label>
            <Input
              id="ip-address"
              placeholder="192.168.1.1 或 192.168.1.0/24"
              value={newIPAddress}
              onChange={(e) => setNewIPAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddIP()
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip-description">描述（可选）</Label>
            <Input
              id="ip-description"
              placeholder="办公室网络"
              value={newIPDescription}
              onChange={(e) => setNewIPDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddIP()
                }
              }}
            />
          </div>
        </div>
        <Button onClick={handleAddIP} disabled={isAddingIP} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          添加 IP 地址
        </Button>
      </div>

      {/* IP白名单列表 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP 地址</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  加载中...
                </TableCell>
              </TableRow>
            ) : ipWhitelists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  暂无 IP 白名单配置
                </TableCell>
              </TableRow>
            ) : (
              ipWhitelists.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell className="font-mono">{ip.ip_address}</TableCell>
                  <TableCell>{ip.description || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={ip.enabled ? "default" : "secondary"}>
                      {ip.enabled ? "已启用" : "已禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(ip.created_at).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Switch
                        checked={ip.enabled}
                        onCheckedChange={() => handleToggleIP(ip.id)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteIP(ip.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">IP 白名单说明：</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>支持单个IP地址（如 192.168.1.1）或CIDR格式（如 192.168.1.0/24）</li>
          <li>只有白名单中启用的IP地址才能访问系统</li>
          <li>如果未配置任何IP白名单，则允许所有IP访问</li>
          <li>建议根据实际业务需求配置白名单，提高系统安全性</li>
        </ul>
      </div>
    </SettingsSection>
  )
}
