import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type {
  TerminalWebSocket,
  TerminalConnectionPhase,
} from '@/lib/websocket-terminal'
import type { WorkspaceTerminalSession } from "@/lib/session/workspace"

export type { TerminalConnectionPhase } from '@/lib/websocket-terminal'

export type SessionStatus = "connected" | "disconnected" | "reconnecting"

export interface TerminalSession extends WorkspaceTerminalSession {
  lastActivity: number // 时间戳（ms）
  status: SessionStatus
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
  latency?: {
    terminalWsLatencyMs?: number
    terminalWsLatencySmoothedMs?: number
    terminalWsLatencyJitterMs?: number
    terminalWsLatencyUpMs?: number
    terminalWsLatencyDownMs?: number
    terminalWsClockOffsetMs?: number
    terminalSshLatencyMs?: number
    terminalSshLatencyMeasuredAt?: number
    updatedAt?: number
  }
}
