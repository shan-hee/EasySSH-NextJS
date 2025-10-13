"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  FileText,
  Play,
  Edit,
  Trash2,
  Calendar,
  User
} from "lucide-react"
import Link from "next/link"

// 模拟脚本数据
const mockScripts = [
  {
    id: 1,
    name: "系统监控脚本",
    description: "监控CPU、内存、磁盘使用情况",
    content: "#!/bin/bash\ntop -bn1 | grep 'Cpu(s)'\nfree -h\ndf -h",
    language: "bash",
    tags: ["监控", "系统"],
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
    author: "管理员",
    executions: 24,
  },
  {
    id: 2,
    name: "备份数据库",
    description: "自动备份MySQL数据库",
    content: "#!/bin/bash\nmysqldump -u $USER -p$PASS $DB > backup_$(date +%Y%m%d).sql",
    language: "bash",
    tags: ["备份", "数据库"],
    createdAt: "2024-01-14",
    updatedAt: "2024-01-15",
    author: "管理员",
    executions: 12,
  },
  {
    id: 3,
    name: "清理日志文件",
    description: "清理超过7天的日志文件",
    content: "#!/bin/bash\nfind /var/log -name '*.log' -mtime +7 -delete",
    language: "bash",
    tags: ["清理", "日志"],
    createdAt: "2024-01-13",
    updatedAt: "2024-01-14",
    author: "管理员",
    executions: 8,
  },
  {
    id: 4,
    name: "Docker容器管理",
    description: "批量重启Docker容器",
    content: "#!/bin/bash\ndocker container ls -q | xargs docker restart",
    language: "bash",
    tags: ["Docker", "容器"],
    createdAt: "2024-01-12",
    updatedAt: "2024-01-13",
    author: "管理员",
    executions: 15,
  },
]

export default function ScriptsPage() {
  const [scripts] = useState(mockScripts)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // 获取所有标签
  const allTags = Array.from(new Set(scripts.flatMap(script => script.tags)))

  // 过滤脚本
  const filteredScripts = scripts.filter(script => {
    const matchesSearch = script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         script.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTag = !selectedTag || script.tags.includes(selectedTag)
    return matchesSearch && matchesTag
  })

  const handleExecute = (scriptId: number) => {
    console.log("执行脚本:", scriptId)
    // 这里应该打开执行对话框
  }

  const handleEdit = (scriptId: number) => {
    console.log("编辑脚本:", scriptId)
    // 这里应该跳转到编辑页面
  }

  const handleDelete = (scriptId: number) => {
    console.log("删除脚本:", scriptId)
    // 这里应该显示确认对话框
  }

  return (
    <>
      <PageHeader
        title="脚本管理"
        breadcrumbs={[
          { title: "自动化", href: "#" },
          { title: "脚本管理" }
        ]}
      >
        <Link href="/dashboard/scripts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建脚本
          </Button>
        </Link>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 搜索和筛选 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索脚本..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* 标签筛选 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">标签:</span>
            <Button
              variant={selectedTag === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTag(null)}
            >
              全部
            </Button>
            {allTags.map(tag => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>

        {/* 脚本列表 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredScripts.map(script => (
            <Card key={script.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{script.name}</CardTitle>
                    <CardDescription className="mt-1">{script.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExecute(script.id)}
                      title="执行脚本"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(script.id)}
                      title="编辑脚本"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(script.id)}
                      title="删除脚本"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* 标签 */}
                <div className="flex items-center gap-1 mb-3">
                  {script.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* 代码预览 */}
                <div className="bg-muted rounded-md p-3 mb-3">
                  <pre className="text-xs text-muted-foreground font-mono overflow-hidden">
                    {script.content.length > 100
                      ? script.content.substring(0, 100) + "..."
                      : script.content
                    }
                  </pre>
                </div>

                {/* 元信息 */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {script.author}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {script.updatedAt}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    {script.executions}次
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 空状态 */}
        {filteredScripts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无匹配的脚本</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedTag ? "请尝试调整搜索条件" : "开始创建您的第一个脚本"}
            </p>
            <Link href="/dashboard/scripts/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新建脚本
              </Button>
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

