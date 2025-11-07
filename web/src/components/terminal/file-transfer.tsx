"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FolderOpen,
  File,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  ArrowLeft,
  Home,
  Eye,
  Edit,
  Copy
} from "lucide-react"

interface FileItem {
  name: string
  type: "file" | "directory"
  size: string
  modified: string
  permissions: string
  owner: string
  group: string
}

interface FileTransferProps {
  currentPath: string
  files: FileItem[]
  onNavigate: (path: string) => void
  onUpload: (files: FileList) => void
  onDownload: (fileName: string) => void
  onDelete: (fileName: string) => void
  onCreateFolder: (name: string) => void
  onRename: (oldName: string, newName: string) => void
}

export function FileTransfer({
  currentPath,
  files,
  onNavigate,
  onUpload,
  onDownload,
  onDelete,
  onCreateFolder,
}: FileTransferProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [transferProgress, setTransferProgress] = useState<Record<string, number>>({})
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 过滤和排序文件
  const filteredFiles = files
    .filter(file =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue = a[sortBy as keyof FileItem] as string
      let bValue = b[sortBy as keyof FileItem] as string

      if (sortBy === "size") {
        // 简单的大小比较（实际应该解析大小单位）
        aValue = a.size
        bValue = b.size
      }

      if (sortOrder === "asc") {
        return aValue.localeCompare(bValue)
      } else {
        return bValue.localeCompare(aValue)
      }
    })

  const handleFileSelect = (fileName: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileName)
        ? prev.filter(f => f !== fileName)
        : [...prev, fileName]
    )
  }

  const handleSelectAll = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(filteredFiles.map(f => f.name))
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      onUpload(files)
    }
  }

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim())
      setNewFolderName("")
      setShowCreateFolder(false)
    }
  }

  const getFileIcon = (file: FileItem) => {
    if (file.type === "directory") {
      return <FolderOpen className="h-4 w-4 text-blue-500" />
    }
    return <File className="h-4 w-4 text-muted-foreground" />
  }

  const formatFileSize = (size: string) => {
    // 这里应该有更复杂的文件大小格式化逻辑
    return size
  }

  const pathSegments = currentPath.split("/").filter(Boolean)

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("/")}
              >
                <Home className="h-4 w-4" />
              </Button>
              {pathSegments.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate(pathSegments.slice(0, -1).join("/") || "/")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="text-sm font-mono bg-muted px-3 py-1 rounded">
                {currentPath || "/"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateFolder(true)}
              >
                新建文件夹
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                上传文件
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索文件..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">名称</SelectItem>
                <SelectItem value="size">大小</SelectItem>
                <SelectItem value="modified">修改时间</SelectItem>
                <SelectItem value="type">类型</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </Button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  已选择 {selectedFiles.length} 个项目
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    下载
                  </Button>
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-1" />
                    复制
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 文件列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            文件管理器
          </CardTitle>
        </CardHeader>

        <CardContent>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">目录为空</h3>
              <p className="text-muted-foreground">
                此目录下没有文件或文件夹
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedFiles.length === filteredFiles.length}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>修改时间</TableHead>
                  <TableHead>权限</TableHead>
                  <TableHead>所有者</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiles.map((file) => (
                  <TableRow
                    key={file.name}
                    className={selectedFiles.includes(file.name) ? "bg-muted/50" : ""}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.name)}
                        onChange={() => handleFileSelect(file.name)}
                        className="rounded"
                      />
                    </TableCell>

                    <TableCell>
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:text-primary"
                        onClick={() => {
                          if (file.type === "directory") {
                            onNavigate(`${currentPath}/${file.name}`.replace(/\/+/g, "/"))
                          }
                        }}
                      >
                        {getFileIcon(file)}
                        <span className="font-medium">{file.name}</span>
                        {file.type === "directory" && (
                          <Badge variant="outline" className="text-xs">
                            目录
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-sm">
                        {file.type === "directory" ? "-" : formatFileSize(file.size)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">{file.modified}</span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-sm">{file.permissions}</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">{file.owner}:{file.group}</span>
                    </TableCell>

                    <TableCell>
                      <div className="flex gap-1">
                        {file.type === "file" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDownload(file.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => onDelete(file.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 传输进度 */}
      {Object.keys(transferProgress).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>文件传输</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(transferProgress).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{fileName}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 新建文件夹对话框 */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>
              在当前目录下创建一个新的文件夹
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="文件夹名称"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                取消
              </Button>
              <Button onClick={handleCreateFolder}>
                创建
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}