"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Play,
  Pause,
  Server,
  Terminal,
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  Download,
  Zap,
  Library,
  Code2
} from "lucide-react"

// 模拟服务器数据
const mockServers = [
  { id: 1, name: "Web Server 01", host: "192.168.1.100", status: "在线", group: "Web服务器" },
  { id: 2, name: "Web Server 02", host: "192.168.1.101", status: "在线", group: "Web服务器" },
  { id: 3, name: "Database Server", host: "192.168.1.102", status: "在线", group: "数据库" },
  { id: 4, name: "Cache Server", host: "192.168.1.103", status: "在线", group: "缓存" },
  { id: 5, name: "App Server 01", host: "192.168.1.104", status: "离线", group: "应用服务器" },
  { id: 6, name: "App Server 02", host: "192.168.1.105", status: "在线", group: "应用服务器" },
]

// 模拟脚本库数据
const mockScripts = [
  {
    id: 1,
    name: "系统监控脚本",
    description: "监控CPU、内存、磁盘使用情况",
    content: "#!/bin/bash\ntop -bn1 | grep 'Cpu(s)'\nfree -h\ndf -h",
    tags: ["监控", "系统"],
    author: "管理员",
    updatedAt: "2024-01-15",
  },
  {
    id: 2,
    name: "备份数据库",
    description: "自动备份MySQL数据库",
    content: "#!/bin/bash\nmysqldump -u $USER -p$PASS $DB > backup_$(date +%Y%m%d).sql",
    tags: ["备份", "数据库"],
    author: "管理员",
    updatedAt: "2024-01-15",
  },
  {
    id: 3,
    name: "清理日志文件",
    description: "清理超过7天的日志文件",
    content: "#!/bin/bash\nfind /var/log -name '*.log' -mtime +7 -delete",
    tags: ["清理", "日志"],
    author: "管理员",
    updatedAt: "2024-01-14",
  },
  {
    id: 4,
    name: "Docker容器管理",
    description: "批量重启Docker容器",
    content: "#!/bin/bash\ndocker container ls -q | xargs docker restart",
    tags: ["Docker", "容器"],
    author: "管理员",
    updatedAt: "2024-01-13",
  },
  {
    id: 5,
    name: "Nginx配置检查",
    description: "检查Nginx配置并重载",
    content: "#!/bin/bash\nnginx -t && systemctl reload nginx",
    tags: ["Nginx", "配置"],
    author: "运维工程师",
    updatedAt: "2024-01-12",
  },
]

// 模拟执行历史
const mockExecutionHistory = [
  {
    id: 1,
    task: "系统更新",
    type: "命令",
    servers: 5,
    status: "completed",
    success: 5,
    failed: 0,
    startTime: "2024-01-15 14:30:00",
    duration: "2分35秒"
  },
  {
    id: 2,
    task: "部署配置文件",
    type: "文件",
    servers: 3,
    status: "completed",
    success: 3,
    failed: 0,
    startTime: "2024-01-15 13:15:00",
    duration: "1分12秒"
  },
  {
    id: 3,
    task: "重启服务",
    type: "命令",
    servers: 6,
    status: "failed",
    success: 5,
    failed: 1,
    startTime: "2024-01-15 12:00:00",
    duration: "45秒"
  },
  {
    id: 4,
    task: "日志收集",
    type: "脚本",
    servers: 8,
    status: "running",
    success: 6,
    failed: 0,
    startTime: "2024-01-15 11:30:00",
    duration: "进行中"
  }
]

export default function AutomationBatchPage() {
  const [selectedServers, setSelectedServers] = useState<number[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [command, setCommand] = useState("")
  const [scriptContent, setScriptContent] = useState("")
  const [filePath, setFilePath] = useState("")
  const [targetPath, setTargetPath] = useState("")
  const [executionMode, setExecutionMode] = useState("parallel")
  const [isExecuting, setIsExecuting] = useState(false)
  const [isScriptLibraryOpen, setIsScriptLibraryOpen] = useState(false)
  const [scriptSearchTerm, setScriptSearchTerm] = useState("")

  // 过滤服务器
  const filteredServers = mockServers.filter(server =>
    server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    server.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
    server.group.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 过滤脚本
  const filteredScripts = mockScripts.filter(script =>
    script.name.toLowerCase().includes(scriptSearchTerm.toLowerCase()) ||
    script.description.toLowerCase().includes(scriptSearchTerm.toLowerCase()) ||
    script.tags.some(tag => tag.toLowerCase().includes(scriptSearchTerm.toLowerCase()))
  )

  // 切换服务器选择
  const toggleServer = (serverId: number) => {
    setSelectedServers(prev =>
      prev.includes(serverId)
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    )
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedServers.length === filteredServers.length) {
      setSelectedServers([])
    } else {
      setSelectedServers(filteredServers.map(s => s.id))
    }
  }

  // 执行批量命令
  const handleExecuteCommand = () => {
    if (selectedServers.length === 0 || !command.trim()) {
      return
    }
    setIsExecuting(true)
    console.log("执行命令:", { command, servers: selectedServers, mode: executionMode })
    // 模拟执行
    setTimeout(() => {
      setIsExecuting(false)
    }, 3000)
  }

  // 执行批量脚本
  const handleExecuteScript = () => {
    if (selectedServers.length === 0 || !scriptContent.trim()) {
      return
    }
    setIsExecuting(true)
    console.log("执行脚本:", { script: scriptContent, servers: selectedServers, mode: executionMode })
    setTimeout(() => {
      setIsExecuting(false)
    }, 3000)
  }

  // 执行文件分发
  const handleDistributeFile = () => {
    if (selectedServers.length === 0 || !filePath.trim() || !targetPath.trim()) {
      return
    }
    setIsExecuting(true)
    console.log("分发文件:", { from: filePath, to: targetPath, servers: selectedServers })
    setTimeout(() => {
      setIsExecuting(false)
    }, 3000)
  }

  // 选择脚本库中的脚本
  const handleSelectScript = (script: typeof mockScripts[0]) => {
    setScriptContent(script.content)
    setIsScriptLibraryOpen(false)
    setScriptSearchTerm("")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>
      case "running":
        return <Badge className="bg-blue-100 text-blue-800">执行中</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800">失败</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "命令":
        return <Terminal className="h-4 w-4" />
      case "文件":
        return <FileText className="h-4 w-4" />
      case "脚本":
        return <Zap className="h-4 w-4" />
      default:
        return <Server className="h-4 w-4" />
    }
  }

  return (
    <>
      <PageHeader
        title="批量操作"
        breadcrumbs={[
          { title: "自动化", href: "#" },
          { title: "批量操作" }
        ]}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => console.log("导出执行报告")}
        >
          <Download className="mr-2 h-4 w-4" />
          导出报告
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">在线服务器</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockServers.filter(s => s.status === "在线").length}
              </div>
              <p className="text-xs text-muted-foreground">
                共 {mockServers.length} 台服务器
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已选服务器</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {selectedServers.length}
              </div>
              <p className="text-xs text-muted-foreground">
                准备执行批量任务
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日任务</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockExecutionHistory.length}</div>
              <p className="text-xs text-muted-foreground">
                成功率 75%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">执行中任务</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {mockExecutionHistory.filter(h => h.status === "running").length}
              </div>
              <p className="text-xs text-muted-foreground">
                正在进行的任务
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* 左侧：服务器选择 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">选择服务器</CardTitle>
              <CardDescription>
                已选择 {selectedServers.length} 台服务器
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索服务器..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* 全选按钮 */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedServers.length === filteredServers.length ? "取消全选" : "全选"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {filteredServers.length} 台服务器
                </span>
              </div>

              {/* 服务器列表 */}
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-custom">
                {filteredServers.map(server => (
                  <div
                    key={server.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => toggleServer(server.id)}
                  >
                    <Checkbox
                      checked={selectedServers.includes(server.id)}
                      onCheckedChange={() => toggleServer(server.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{server.name}</div>
                        <Badge
                          variant="outline"
                          className={server.status === "在线" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-700"}
                        >
                          {server.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{server.host}</div>
                      <div className="text-xs text-muted-foreground">{server.group}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 右侧：操作面板 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">批量操作</CardTitle>
              <CardDescription>
                在选定的服务器上执行批量命令、脚本或文件分发
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="command" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="command">
                    <Terminal className="mr-2 h-4 w-4" />
                    批量命令
                  </TabsTrigger>
                  <TabsTrigger value="script">
                    <Zap className="mr-2 h-4 w-4" />
                    批量脚本
                  </TabsTrigger>
                  <TabsTrigger value="file">
                    <Upload className="mr-2 h-4 w-4" />
                    文件分发
                  </TabsTrigger>
                </TabsList>

                {/* 批量命令 */}
                <TabsContent value="command" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="command">命令内容</Label>
                    <Textarea
                      id="command"
                      placeholder="输入要执行的命令，例如：systemctl status nginx"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="exec-mode">执行模式</Label>
                    <Select value={executionMode} onValueChange={setExecutionMode}>
                      <SelectTrigger id="exec-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parallel">并行执行（同时执行）</SelectItem>
                        <SelectItem value="sequential">串行执行（按顺序执行）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      请确认命令安全性，批量操作可能影响多台服务器
                    </span>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={selectedServers.length === 0 || !command.trim() || isExecuting}
                    onClick={handleExecuteCommand}
                  >
                    {isExecuting ? (
                      <>
                        <Pause className="mr-2 h-4 w-4 animate-spin" />
                        执行中...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        执行命令（{selectedServers.length} 台服务器）
                      </>
                    )}
                  </Button>
                </TabsContent>

                {/* 批量脚本 */}
                <TabsContent value="script" className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="script">脚本内容</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsScriptLibraryOpen(true)}
                      >
                        <Library className="mr-2 h-4 w-4" />
                        从脚本库选择
                      </Button>
                    </div>
                    <Textarea
                      id="script"
                      placeholder="输入Shell脚本内容，或从脚本库选择..."
                      value={scriptContent}
                      onChange={(e) => setScriptContent(e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="script-mode">执行模式</Label>
                    <Select value={executionMode} onValueChange={setExecutionMode}>
                      <SelectTrigger id="script-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parallel">并行执行（同时执行）</SelectItem>
                        <SelectItem value="sequential">串行执行（按顺序执行）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={selectedServers.length === 0 || !scriptContent.trim() || isExecuting}
                    onClick={handleExecuteScript}
                  >
                    {isExecuting ? (
                      <>
                        <Pause className="mr-2 h-4 w-4 animate-spin" />
                        执行中...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        执行脚本（{selectedServers.length} 台服务器）
                      </>
                    )}
                  </Button>
                </TabsContent>

                {/* 文件分发 */}
                <TabsContent value="file" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-path">源文件路径</Label>
                    <Input
                      id="file-path"
                      placeholder="/path/to/local/file"
                      value={filePath}
                      onChange={(e) => setFilePath(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      本地文件或目录的绝对路径
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target-path">目标路径</Label>
                    <Input
                      id="target-path"
                      placeholder="/path/to/remote/destination"
                      value={targetPath}
                      onChange={(e) => setTargetPath(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      远程服务器上的目标路径
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Upload className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-800">
                      文件将使用SFTP协议传输到所有选定的服务器
                    </span>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={selectedServers.length === 0 || !filePath.trim() || !targetPath.trim() || isExecuting}
                    onClick={handleDistributeFile}
                  >
                    {isExecuting ? (
                      <>
                        <Pause className="mr-2 h-4 w-4 animate-spin" />
                        分发中...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        分发文件（{selectedServers.length} 台服务器）
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* 执行历史 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">执行历史</CardTitle>
            <CardDescription>
              最近的批量操作任务记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>服务器数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>成功/失败</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>耗时</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockExecutionHistory.map(history => (
                    <TableRow key={history.id}>
                      <TableCell className="font-medium">
                        {history.task}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(history.type)}
                          {history.type}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {history.servers} 台
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(history.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">
                            {history.success}
                          </span>
                          /
                          <span className="text-red-600 font-medium">
                            {history.failed}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {history.startTime}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {history.duration}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 脚本库选择对话框 */}
      <Dialog open={isScriptLibraryOpen} onOpenChange={setIsScriptLibraryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-custom">
          <DialogHeader>
            <DialogTitle>选择脚本</DialogTitle>
            <DialogDescription>
              从脚本库中选择一个脚本，将自动填充到脚本内容框
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索脚本名称、描述或标签..."
                className="pl-10"
                value={scriptSearchTerm}
                onChange={(e) => setScriptSearchTerm(e.target.value)}
              />
            </div>

            {/* 脚本列表 */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-custom">
              {filteredScripts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4" />
                  <p>暂无匹配的脚本</p>
                </div>
              ) : (
                filteredScripts.map(script => (
                  <div
                    key={script.id}
                    className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => handleSelectScript(script)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Code2 className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">{script.name}</h3>
                        </div>

                        {script.description && (
                          <p className="text-sm text-muted-foreground">
                            {script.description}
                          </p>
                        )}

                        <div className="bg-muted rounded-md p-3">
                          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap line-clamp-4">
                            {script.content}
                          </pre>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            <span>{script.author}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>更新于 {script.updatedAt}</span>
                          </div>
                        </div>

                        {script.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {script.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectScript(script)
                        }}
                      >
                        选择
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScriptLibraryOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
