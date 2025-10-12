"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Server,
  MoreHorizontal,
  Terminal,
  Eye,
  Edit,
  Settings,
  Trash2,
  Wifi,
  WifiOff,
  AlertTriangle
} from "lucide-react"

interface ServerData {
  id: number
  name: string
  host: string
  port: number
  username: string
  status: 'online' | 'offline' | 'warning'
  os: string
  cpu: string
  memory: string
  disk: string
  lastConnected: string
  uptime: string
  tags: string[]
}

interface ServerCardProps {
  server: ServerData
  onConnect?: (serverId: number) => void
  onEdit?: (serverId: number) => void
  onDelete?: (serverId: number) => void
  onViewDetails?: (serverId: number) => void
}

export function ServerCard({
  server,
  onConnect,
  onEdit,
  onDelete,
  onViewDetails
}: ServerCardProps) {
  const getStatusIcon = () => {
    switch (server.status) {
      case 'online':
        return <Wifi className="h-4 w-4 text-green-500" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = () => {
    switch (server.status) {
      case 'online':
        return <Badge className="bg-green-500 hover:bg-green-600">在线</Badge>
      case 'offline':
        return <Badge variant="destructive">离线</Badge>
      case 'warning':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">警告</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{server.name}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {getStatusBadge()}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>操作</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onConnect?.(server.id)}
                disabled={server.status === 'offline'}
              >
                <Terminal className="mr-2 h-4 w-4" />
                连接终端
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewDetails?.(server.id)}>
                <Eye className="mr-2 h-4 w-4" />
                查看详情
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(server.id)}>
                <Edit className="mr-2 h-4 w-4" />
                编辑配置
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                服务器设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete?.(server.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除服务器
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">主机:</span>
            <p className="font-mono">{server.host}:{server.port}</p>
          </div>
          <div>
            <span className="text-muted-foreground">用户:</span>
            <p className="font-mono">{server.username}</p>
          </div>
          <div>
            <span className="text-muted-foreground">系统:</span>
            <p>{server.os}</p>
          </div>
          <div>
            <span className="text-muted-foreground">运行时间:</span>
            <p>{server.uptime}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {server.tags.map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={server.status === 'offline'}
            onClick={() => onConnect?.(server.id)}
          >
            <Terminal className="mr-2 h-4 w-4" />
            连接
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails?.(server.id)}
          >
            <Eye className="mr-2 h-4 w-4" />
            详情
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// 服务器列表组件
interface ServerListProps {
  servers: ServerData[]
  onConnect?: (serverId: number) => void
  onEdit?: (serverId: number) => void
  onDelete?: (serverId: number) => void
  onViewDetails?: (serverId: number) => void
}

export function ServerList({
  servers,
  onConnect,
  onEdit,
  onDelete,
  onViewDetails
}: ServerListProps) {
  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Server className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">暂无服务器</h3>
        <p className="text-muted-foreground mb-4">开始添加您的第一台服务器</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {servers.map((server) => (
        <ServerCard
          key={server.id}
          server={server}
          onConnect={onConnect}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  )
}