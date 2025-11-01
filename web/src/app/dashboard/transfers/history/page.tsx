"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Upload as UploadIcon, Download as DownloadIcon, RefreshCw, CheckCircle, XCircle, Clock, ArrowUpDown, Loader2 } from "lucide-react"
import { fileTransfersApi, type FileTransfer, type FileTransferStatistics } from "@/lib/api/file-transfers"
import { toast } from "@/components/ui/sonner"

const typeColors = {
  upload: "bg-blue-100 text-blue-800",
  download: "bg-green-100 text-green-800",
}

const statusColors = {
  completed: "bg-green-100 text-green-800",
  transferring: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 格式化速度
function formatSpeed(bytesPerSecond: number | undefined): string {
  if (!bytesPerSecond || bytesPerSecond === 0) return '-'
  return `${formatFileSize(bytesPerSecond)}/s`
}

// 格式化时长
function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒`
}

// 格式化时间
function formatTimestamp(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString('zh-CN'),
    time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
}

export default function TransfersHistoryPage() {
  const [transfers, setTransfers] = useState<FileTransfer[]>([])
  const [statistics, setStatistics] = useState<FileTransferStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // 获取 token
  const getToken = () => {
    return localStorage.getItem("token") || ""
  }

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      const token = getToken()

      // 并行加载传输列表和统计信息
      const [transfersResponse, statsResponse] = await Promise.all([
        fileTransfersApi.list(token, {
          page,
          limit: 20,
          status: selectedStatus !== "all" ? selectedStatus as any : undefined,
          transfer_type: selectedType !== "all" ? selectedType as any : undefined,
        }),
        fileTransfersApi.getStatistics(token),
      ])

      setTransfers(transfersResponse.data || [])
      setTotalPages(transfersResponse.total_pages || 1)
      setStatistics(statsResponse.data)
    } catch (error: any) {
      toast.error(error.message || "无法加载传输记录")
    } finally {
      setLoading(false)
    }
  }

  // 初始加载和筛选变化时重新加载
  useEffect(() => {
    loadData()
  }, [page, selectedType, selectedStatus])

  // 客户端搜索过滤
  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = transfer.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.source_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.dest_path.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  // 删除传输记录
  const handleDelete = async (id: string) => {
    try {
      const token = getToken()
      await fileTransfersApi.delete(token, id)
      toast.success("传输记录已删除")
      loadData()
    } catch (error: any) {
      toast.error(error.message || "无法删除传输记录")
    }
  }

  return (
    <>
      <PageHeader title="传输记录">
        <Button variant="outline" size="sm" onClick={() => loadData()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总传输</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.total_transfers || 0}</div>
              <p className="text-xs text-muted-foreground">
                成功 {statistics?.completed_transfers || 0} 次
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">上传</CardTitle>
              <UploadIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {statistics?.by_type?.upload || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(statistics?.total_bytes_uploaded || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">下载</CardTitle>
              <DownloadIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics?.by_type?.download || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(statistics?.total_bytes_downloaded || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">失败传输</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics?.failed_transfers || 0}
              </div>
              <p className="text-xs text-muted-foreground">需要重试</p>
            </CardContent>
          </Card>
        </div>

        {/* 筛选器 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">筛选器</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索文件名或路径..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="传输类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有类型</SelectItem>
                    <SelectItem value="upload">上传</SelectItem>
                    <SelectItem value="download">下载</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有状态</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="transferring">进行中</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                    <SelectItem value="pending">等待中</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 传输记录表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">传输记录</CardTitle>
            <CardDescription>
              显示 {filteredTransfers.length} 条记录，共 {transfers.length} 条
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无传输记录
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>文件名</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>路径</TableHead>
                      <TableHead>速度</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransfers.map(transfer => {
                      const { date, time } = formatTimestamp(transfer.created_at)
                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <div>
                                <div>{time}</div>
                                <div className="text-xs text-muted-foreground">{date}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={typeColors[transfer.transfer_type as keyof typeof typeColors]}>
                              {transfer.transfer_type === "upload" ? "上传" : "下载"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{transfer.file_name}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatFileSize(transfer.file_size)}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs max-w-xs">
                              <div className="text-muted-foreground truncate" title={transfer.source_path}>
                                源: {transfer.source_path}
                              </div>
                              <div className="text-muted-foreground truncate" title={transfer.dest_path}>
                                目标: {transfer.dest_path}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatSpeed(transfer.speed)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <Badge className={statusColors[transfer.status as keyof typeof statusColors]}>
                                {transfer.status === "completed" ? "已完成" :
                                  transfer.status === "transferring" ? "进行中" :
                                    transfer.status === "failed" ? "失败" : "等待中"}
                              </Badge>
                              {transfer.status === "transferring" && (
                                <div className="mt-1">
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${transfer.progress}%` }} />
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{transfer.progress}%</div>
                                </div>
                              )}
                              {transfer.error_message && (
                                <div className="text-xs text-red-600 mt-1">{transfer.error_message}</div>
                              )}
                              {transfer.duration && transfer.status === "completed" && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  耗时: {formatDuration(transfer.duration)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(transfer.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* 分页 */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  第 {page} 页，共 {totalPages} 页
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
