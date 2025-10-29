import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import { TerminalWebSocket } from '@/lib/websocket-terminal'

export type SessionStatus = "connected" | "disconnected" | "reconnecting"

export interface TerminalSession {
  id: string
  serverId: number | string  // 支持数字和 UUID 字符串
  serverName: string
  host: string
  port?: number
  username: string
  // 向后兼容旧接口
  isConnected: boolean
  status: SessionStatus
  lastActivity: number // 时间戳（ms）
  group?: string
  tags?: string[]
  pinned?: boolean
  // 新增：会话类型，quick 表示快速连接页签（无工具栏）
  type?: "quick" | "terminal"
}

/**
 * 终端实例状态（用于全局 Store）
 * 包含终端实例、插件、WebSocket 连接和挂载状态
 */
export interface TerminalInstanceState {
  terminal: Terminal
  fitAddon: FitAddon
  wsConnection: TerminalWebSocket | null
  isMounted: boolean
  container: HTMLDivElement | null
  createdAt: number
  serverId?: string  // 记录关联的服务器 ID，用于连接复用判断
}
