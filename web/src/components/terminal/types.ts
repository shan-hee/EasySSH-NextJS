export type SessionStatus = "connected" | "disconnected" | "reconnecting"

export interface TerminalSession {
  id: string
  serverId: number
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
