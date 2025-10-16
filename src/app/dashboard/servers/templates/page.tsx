"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, Copy, Edit, Trash2, BookTemplate, Server, Key, User } from "lucide-react"

const mockTemplates = [
  {
    id: 1,
    name: "生产环境 Web 服务器",
    description: "生产环境 Nginx Web 服务器标准配置",
    host: "prod-web-{n}.example.com",
    port: 22,
    username: "deploy",
    authMethod: "SSH密钥",
    tags: ["生产", "Web", "Nginx"],
    usageCount: 12,
    createdBy: "管理员",
    createdAt: "2024-01-10"
  },
  {
    id: 2,
    name: "开发环境数据库",
    description: "开发环境 MySQL 数据库服务器",
    host: "dev-db-{n}.example.com",
    port: 22,
    username: "developer",
    authMethod: "密码",
    tags: ["开发", "Database", "MySQL"],
    usageCount: 8,
    createdBy: "DBA",
    createdAt: "2024-01-08"
  },
  {
    id: 3,
    name: "应用服务器集群",
    description: "Node.js 应用服务器集群模板",
    host: "app-{n}.example.com",
    port: 22,
    username: "nodejs",
    authMethod: "SSH密钥",
    tags: ["生产", "App", "Node.js"],
    usageCount: 15,
    createdBy: "运维工程师",
    createdAt: "2024-01-05"
  },
  {
    id: 4,
    name: "测试环境",
    description: "通用测试环境服务器",
    host: "test-{n}.example.com",
    port: 22,
    username: "tester",
    authMethod: "密码",
    tags: ["测试", "通用"],
    usageCount: 5,
    createdBy: "测试工程师",
    createdAt: "2024-01-12"
  },
]

const authMethodColors = {
  "SSH密钥": "bg-green-100 text-green-800",
  "密码": "bg-blue-100 text-blue-800",
}

export default function ServersTemplatesPage() {
  const [templates] = useState(mockTemplates)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <>
      <PageHeader
        title="连接模板"
        breadcrumbs={[
          { title: "服务器管理", href: "#" },
          { title: "连接模板" }
        ]}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新建模板
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">模板总数</CardTitle>
              <BookTemplate className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
              <p className="text-xs text-muted-foreground">可用模板</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">使用次数</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {templates.reduce((acc, t) => acc + t.usageCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">已创建服务器</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SSH密钥模板</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {templates.filter(t => t.authMethod === "SSH密钥").length}
              </div>
              <p className="text-xs text-muted-foreground">安全认证</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">最常用</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.max(...templates.map(t => t.usageCount))}
              </div>
              <p className="text-xs text-muted-foreground">应用服务器集群</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">筛选器</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索模板名称、描述或标签..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">模板列表</CardTitle>
            <CardDescription>显示 {filteredTemplates.length} 个模板，共 {templates.length} 个</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>模板名称</TableHead>
                    <TableHead>主机地址</TableHead>
                    <TableHead>端口</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>认证方式</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>使用次数</TableHead>
                    <TableHead>创建者</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-muted-foreground">{template.description}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{template.host}</TableCell>
                      <TableCell className="font-mono">{template.port}</TableCell>
                      <TableCell>{template.username}</TableCell>
                      <TableCell>
                        <Badge className={authMethodColors[template.authMethod as keyof typeof authMethodColors]}>
                          {template.authMethod}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{template.usageCount}</TableCell>
                      <TableCell>{template.createdBy}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Server className="mr-2 h-4 w-4" />
                              使用模板
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              复制模板
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
