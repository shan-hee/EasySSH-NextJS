"use client"

import { useState } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  TestTube,
  Save,
  ArrowLeft,
  Key,
  Shield,
  Settings,
  Tags,
  Plus,
  X
} from "lucide-react"
import Link from "next/link"

export default function AddServerPage() {
  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: "22",
    username: "",
    authType: "password", // password, key, both
    password: "",
    privateKey: "",
    description: "",
    tags: [] as string[],
    proxyJump: "",
    compression: true,
    keepAlive: true,
    timeout: "30",
    retries: "3"
  })

  const [newTag, setNewTag] = useState("")
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const testConnection = async () => {
    setIsTestingConnection(true)
    // 模拟测试连接
    setTimeout(() => {
      setIsTestingConnection(false)
      // 这里应该显示测试结果
    }, 2000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 处理表单提交
    console.log("提交服务器配置:", formData)
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">
                    EasySSH 控制台
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard/servers">
                    服务器列表
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>添加服务器</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">添加服务器</h1>
              <p className="text-muted-foreground">配置新的SSH服务器连接</p>
            </div>
            <Link href="/dashboard/servers">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回列表
              </Button>
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="max-w-4xl">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">基本信息</TabsTrigger>
                <TabsTrigger value="auth">认证配置</TabsTrigger>
                <TabsTrigger value="advanced">高级设置</TabsTrigger>
                <TabsTrigger value="tags">标签管理</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      基本配置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">服务器名称 *</Label>
                        <Input
                          id="name"
                          placeholder="例如: Web Server 01"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="host">主机地址 *</Label>
                        <Input
                          id="host"
                          placeholder="IP地址或域名"
                          value={formData.host}
                          onChange={(e) => handleInputChange('host', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="port">端口号</Label>
                        <Input
                          id="port"
                          type="number"
                          placeholder="22"
                          value={formData.port}
                          onChange={(e) => handleInputChange('port', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">用户名 *</Label>
                        <Input
                          id="username"
                          placeholder="root"
                          value={formData.username}
                          onChange={(e) => handleInputChange('username', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">描述</Label>
                      <Textarea
                        id="description"
                        placeholder="服务器描述信息..."
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="auth" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      认证方式
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>认证类型</Label>
                      <Select
                        value={formData.authType}
                        onValueChange={(value) => handleInputChange('authType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="password">密码认证</SelectItem>
                          <SelectItem value="key">密钥认证</SelectItem>
                          <SelectItem value="both">密码+密钥</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(formData.authType === 'password' || formData.authType === 'both') && (
                      <div className="space-y-2">
                        <Label htmlFor="password">密码</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="SSH登录密码"
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                        />
                      </div>
                    )}

                    {(formData.authType === 'key' || formData.authType === 'both') && (
                      <div className="space-y-2">
                        <Label htmlFor="privateKey">私钥</Label>
                        <Textarea
                          id="privateKey"
                          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                          value={formData.privateKey}
                          onChange={(e) => handleInputChange('privateKey', e.target.value)}
                          className="font-mono text-sm h-32"
                        />
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm">
                            <Key className="mr-2 h-4 w-4" />
                            选择密钥文件
                          </Button>
                          <Button type="button" variant="outline" size="sm">
                            生成新密钥
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>高级设置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="proxyJump">代理跳板</Label>
                      <Input
                        id="proxyJump"
                        placeholder="user@proxy-server"
                        value={formData.proxyJump}
                        onChange={(e) => handleInputChange('proxyJump', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="timeout">连接超时 (秒)</Label>
                        <Input
                          id="timeout"
                          type="number"
                          placeholder="30"
                          value={formData.timeout}
                          onChange={(e) => handleInputChange('timeout', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="retries">重试次数</Label>
                        <Input
                          id="retries"
                          type="number"
                          placeholder="3"
                          value={formData.retries}
                          onChange={(e) => handleInputChange('retries', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>启用压缩</Label>
                          <p className="text-sm text-muted-foreground">减少网络传输数据量</p>
                        </div>
                        <Switch
                          checked={formData.compression}
                          onCheckedChange={(checked) => handleInputChange('compression', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>保持连接</Label>
                          <p className="text-sm text-muted-foreground">定期发送心跳包保持连接</p>
                        </div>
                        <Switch
                          checked={formData.keepAlive}
                          onCheckedChange={(checked) => handleInputChange('keepAlive', checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tags" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tags className="h-5 w-5" />
                      标签管理
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入标签名称"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button type="button" onClick={addTag}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {tag}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                            onClick={() => removeTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>建议标签:</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {["生产环境", "测试环境", "开发环境", "Web服务器", "数据库", "缓存服务器"].map((suggestion) => (
                          <Badge
                            key={suggestion}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => {
                              if (!formData.tags.includes(suggestion)) {
                                setFormData(prev => ({
                                  ...prev,
                                  tags: [...prev.tags, suggestion]
                                }))
                              }
                            }}
                          >
                            {suggestion}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={isTestingConnection}
              >
                <TestTube className="mr-2 h-4 w-4" />
                {isTestingConnection ? "测试中..." : "测试连接"}
              </Button>

              <div className="flex gap-2">
                <Link href="/dashboard/servers">
                  <Button type="button" variant="outline">
                    取消
                  </Button>
                </Link>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  保存服务器
                </Button>
              </div>
            </div>
          </form>
        </div>
    </>
  )
}
