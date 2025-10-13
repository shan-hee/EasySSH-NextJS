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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileTransfer } from "@/components/terminal/file-transfer"
import { FolderOpen, Server } from "lucide-react"

// 模拟服务器数据
const servers = [
  {
    id: 1,
    name: "Web Server 01",
    host: "192.168.1.100",
    status: "online" as const,
  },
  {
    id: 2,
    name: "Database Server",
    host: "192.168.1.101",
    status: "online" as const,
  },
  {
    id: 3,
    name: "Dev Server",
    host: "192.168.1.102",
    status: "offline" as const,
  },
]

// 模拟文件数据
const mockFiles = [
  {
    name: "..",
    type: "directory" as const,
    size: "-",
    modified: "2024-01-15 10:30",
    permissions: "drwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "var",
    type: "directory" as const,
    size: "-",
    modified: "2024-01-15 09:45",
    permissions: "drwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "etc",
    type: "directory" as const,
    size: "-",
    modified: "2024-01-14 16:20",
    permissions: "drwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "home",
    type: "directory" as const,
    size: "-",
    modified: "2024-01-13 14:30",
    permissions: "drwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "config.txt",
    type: "file" as const,
    size: "2.4 KB",
    modified: "2024-01-15 11:22",
    permissions: "-rw-r--r--",
    owner: "root",
    group: "root",
  },
  {
    name: "script.sh",
    type: "file" as const,
    size: "856 B",
    modified: "2024-01-14 15:45",
    permissions: "-rwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "data.json",
    type: "file" as const,
    size: "15.6 MB",
    modified: "2024-01-13 18:30",
    permissions: "-rw-r--r--",
    owner: "admin",
    group: "admin",
  },
  {
    name: "backup.tar.gz",
    type: "file" as const,
    size: "245.8 MB",
    modified: "2024-01-12 22:15",
    permissions: "-rw-r--r--",
    owner: "root",
    group: "root",
  },
]

export default function SftpPage() {
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null)
  const [currentPath, setCurrentPath] = useState("/")
  const [files, setFiles] = useState(mockFiles)
  const [isConnected, setIsConnected] = useState(false)

  const handleConnectToServer = () => {
    if (!selectedServerId) return

    setIsConnected(true)
    console.log("连接到服务器进行文件传输:", selectedServerId)
    // 这里应该建立SFTP连接
  }

  const handleNavigate = (path: string) => {
    setCurrentPath(path)
    console.log("导航到目录:", path)
    // 这里应该请求新目录的文件列表
  }

  const handleUpload = (uploadFiles: FileList) => {
    console.log("上传文件:", Array.from(uploadFiles).map(f => f.name))
    // 这里应该处理文件上传逻辑
  }

  const handleDownload = (fileName: string) => {
    console.log("下载文件:", fileName)
    // 这里应该处理文件下载逻辑
  }

  const handleDelete = (fileName: string) => {
    console.log("删除文件:", fileName)
    // 这里应该处理文件删除逻辑
    setFiles(prev => prev.filter(f => f.name !== fileName))
  }

  const handleCreateFolder = (name: string) => {
    console.log("创建文件夹:", name)
    // 这里应该处理创建文件夹逻辑
    const newFolder = {
      name,
      type: "directory" as const,
      size: "-",
      modified: new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Shanghai",
        hour12: false
      }).replace("T", " ").slice(0, 19),
      permissions: "drwxr-xr-x",
      owner: "root",
      group: "root",
    }
    setFiles(prev => [newFolder, ...prev])
  }

  const handleRename = (oldName: string, newName: string) => {
    console.log("重命名:", oldName, "->", newName)
    // 这里应该处理重命名逻辑
    setFiles(prev => prev.map(f =>
      f.name === oldName ? { ...f, name: newName } : f
    ))
  }

  const selectedServer = servers.find(s => s.id === selectedServerId)

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
                <BreadcrumbPage>文件传输</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {!isConnected ? (
          // 服务器选择页面
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center max-w-md">
              <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <h1 className="text-2xl font-bold mb-2">SFTP 文件传输</h1>
              <p className="text-muted-foreground mb-6">
                通过安全的SFTP协议管理服务器文件，支持上传、下载和文件管理
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">选择服务器</label>
                  <Select
                    value={selectedServerId?.toString()}
                    onValueChange={(value) => setSelectedServerId(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择要连接的服务器" />
                    </SelectTrigger>
                    <SelectContent>
                      {servers
                        .filter(server => server.status === "online")
                        .map(server => (
                          <SelectItem key={server.id} value={server.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4" />
                              <span>{server.name}</span>
                              <span className="text-muted-foreground">
                                ({server.host})
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleConnectToServer}
                  disabled={!selectedServerId}
                  size="lg"
                  className="w-full"
                >
                  连接到服务器
                </Button>

                {servers.filter(s => s.status === "offline").length > 0 && (
                  <div className="mt-6 text-sm text-muted-foreground">
                    <p className="mb-2">离线服务器:</p>
                    {servers
                      .filter(server => server.status === "offline")
                      .map(server => (
                        <div key={server.id} className="flex items-center gap-2 text-xs">
                          <div className="w-2 h-2 rounded-full bg-muted"></div>
                          {server.name} ({server.host})
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">安全传输</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      基于SSH的加密文件传输
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">文件管理</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      完整的文件和目录操作功能
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        ) : (
          // 文件传输界面
          <div className="space-y-4">
            {/* 连接信息 */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div>
                      <div className="font-medium">
                        已连接到 {selectedServer?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        SFTP - {selectedServer?.host}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsConnected(false)}
                  >
                    断开连接
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 文件传输组件 */}
            <FileTransfer
              currentPath={currentPath}
              files={files}
              onNavigate={handleNavigate}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onCreateFolder={handleCreateFolder}
              onRename={handleRename}
            />
          </div>
        )}
      </div>
    </>
  )
}