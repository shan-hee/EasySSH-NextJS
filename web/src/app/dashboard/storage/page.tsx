"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HardDrive, Trash2, FolderOpen, File, AlertCircle, Database } from "lucide-react"

const mockStorageData = [
  {
    id: 1,
    name: "临时文件",
    path: "/tmp/easyssh/",
    size: "2.3 GB",
    fileCount: 145,
    type: "temp",
    lastModified: "2024-01-15 14:30",
    canClean: true
  },
  {
    id: 2,
    name: "上传缓存",
    path: "/var/easyssh/uploads/",
    size: "5.8 GB",
    fileCount: 328,
    type: "cache",
    lastModified: "2024-01-15 13:45",
    canClean: true
  },
  {
    id: 3,
    name: "日志文件",
    path: "/var/log/easyssh/",
    size: "1.2 GB",
    fileCount: 892,
    type: "logs",
    lastModified: "2024-01-15 14:35",
    canClean: true
  },
  {
    id: 4,
    name: "会话录像",
    path: "/var/easyssh/recordings/",
    size: "15.6 GB",
    fileCount: 67,
    type: "recordings",
    lastModified: "2024-01-15 12:20",
    canClean: false
  },
  {
    id: 5,
    name: "备份文件",
    path: "/var/backups/easyssh/",
    size: "8.9 GB",
    fileCount: 23,
    type: "backups",
    lastModified: "2024-01-14 02:00",
    canClean: false
  },
]

const typeColors = {
  temp: "bg-yellow-100 text-yellow-800",
  cache: "bg-blue-100 text-blue-800",
  logs: "bg-purple-100 text-purple-800",
  recordings: "bg-green-100 text-green-800",
  backups: "bg-red-100 text-red-800",
}

const typeLabels = {
  temp: "临时",
  cache: "缓存",
  logs: "日志",
  recordings: "录像",
  backups: "备份",
}

export default function StoragePage() {
  const [storage] = useState(mockStorageData)

  const totalSize = storage.reduce((acc, item) => {
    const size = parseFloat(item.size)
    return acc + size
  }, 0)

  const cleanableSize = storage
    .filter(item => item.canClean)
    .reduce((acc, item) => acc + parseFloat(item.size), 0)

  return (
    <>
      <PageHeader
        title="存储空间"
        breadcrumbs={[
          { title: "文件传输", href: "#" },
          { title: "存储空间" }
        ]}
      >
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          清理空间
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总使用空间</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSize.toFixed(1)} GB</div>
              <p className="text-xs text-muted-foreground">系统总占用</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">可清理空间</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{cleanableSize.toFixed(1)} GB</div>
              <p className="text-xs text-muted-foreground">临时文件和缓存</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">文件总数</CardTitle>
              <File className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {storage.reduce((acc, item) => acc + item.fileCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">所有类型文件</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">磁盘使用率</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">42%</div>
              <p className="text-xs text-muted-foreground">剩余 58 GB</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>磁盘使用情况</CardTitle>
                <CardDescription>总容量 100 GB</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 rounded-lg overflow-hidden flex">
                <div className="bg-yellow-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "23%"}}>
                  临时 2.3GB
                </div>
                <div className="bg-blue-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "58%"}}>
                  缓存 5.8GB
                </div>
                <div className="bg-purple-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "12%"}}>
                  日志 1.2GB
                </div>
                <div className="bg-green-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "156%"}}>
                  录像 15.6GB
                </div>
                <div className="bg-red-500 flex items-center justify-center text-xs text-white font-medium" style={{width: "89%"}}>
                  备份 8.9GB
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>已使用: {totalSize.toFixed(1)} GB (42%)</span>
                <span>可用: 58 GB</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {storage.map(item => (
            <Card key={item.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <FolderOpen className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.name}</h3>
                        <Badge className={typeColors[item.type as keyof typeof typeColors]}>
                          {typeLabels[item.type as keyof typeof typeLabels]}
                        </Badge>
                        {item.canClean && (
                          <Badge variant="outline" className="text-xs">可清理</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.path}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        最后修改: {item.lastModified}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div>
                      <div className="text-2xl font-bold">{item.size}</div>
                      <div className="text-sm text-muted-foreground">{item.fileCount} 个文件</div>
                    </div>
                    {item.canClean && (
                      <Button variant="outline" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        清理
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">存储空间提示</h4>
                <p className="text-sm text-yellow-800 mt-1">
                  建议定期清理临时文件和缓存以释放磁盘空间。录像文件和备份文件请谨慎清理，确保已经完成归档或不再需要。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
