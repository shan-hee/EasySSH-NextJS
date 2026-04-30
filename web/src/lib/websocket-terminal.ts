/**
 * WebSocket 终端连接管理器
 * 支持二进制协议以提高性能
 */

import { getWsUrl } from './config'
import { createAuthTicket } from "@/lib/auth-ticket"

const TERMINAL_PING_INTERVAL_MS = 5000
const TERMINAL_PING_TIMEOUT_MS = 60000
const TERMINAL_MAX_PENDING_PINGS = 20

export interface TerminalWebSocketOptions {
  serverId: string
  cols: number
  rows: number
  onData: (data: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
  onHandshakeComplete?: () => void // 握手完成回调
  onConnecting?: () => void // 正在连接回调
  onCompletionData?: (data: CompletionDataResponse) => void // 补全数据回调
  onCompletionUpdate?: (data: CompletionUpdateResponse) => void // 补全增量更新回调
  onLatency?: (data: TerminalLatencyData) => void // 终端链路延迟回调
  enableCompletionFetch?: boolean // 是否在连接成功后自动拉取补全数据
}

export interface TerminalLatencyData {
  terminalWsLatencyMs: number
  terminalWsLatencySmoothedMs: number
  terminalWsLatencyJitterMs: number
  terminalWsLatencyUpMs?: number
  terminalWsLatencyDownMs?: number
  terminalWsClockOffsetMs?: number
  terminalSshLatencyMs?: number
  terminalSshLatencyMeasuredAt?: number
}

interface PongMessageData {
  id?: string
  ts?: number
  serverRecvTs?: number
  serverSendTs?: number
  sshLatencyMs?: number
  sshLatencyMeasuredAt?: number
}

// 补全数据响应接口
export interface CompletionDataResponse {
  history: string[]
  scripts: ScriptItem[]
  timestamp: number
}

export interface CompletionUpdateResponse {
  newCommand: string
}

export interface ScriptItem {
  name: string
  content: string
  description: string
  executions: number
  tags: string[]
}

export class TerminalWebSocket {
  private ws: WebSocket | null = null
  private serverId: string
  private cols: number
  private rows: number
  private onData: (data: string) => void
  private onConnected?: () => void
  private onDisconnected?: () => void
  private onError?: (error: Error) => void
  private onHandshakeComplete?: () => void
  private onConnecting?: () => void
  private onCompletionData?: (data: CompletionDataResponse) => void
  private onCompletionUpdate?: (data: CompletionUpdateResponse) => void
  private onLatency?: (data: TerminalLatencyData) => void
  private enableCompletionFetch: boolean
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 2000
  private isManualClose = false
  private isDestroyed = false // 防止销毁后重连
  private pingInterval: NodeJS.Timeout | null = null
  private pingSeq = 0
  private pendingPings = new Map<string, number>()
  private latencySmoothedMs = 0
  private latencyDevMs = 0
  // 复用 TextDecoder/TextEncoder 实例以提升性能
  private decoder = new TextDecoder("utf-8")
  private encoder = new TextEncoder()
  // 性能监控
  private connectStartTime = 0
  private handshakeTime = 0

  constructor(options: TerminalWebSocketOptions) {
    this.serverId = options.serverId
    this.cols = options.cols
    this.rows = options.rows
    this.onData = options.onData
    this.onConnected = options.onConnected
    this.onDisconnected = options.onDisconnected
    this.onError = options.onError
    this.onHandshakeComplete = options.onHandshakeComplete
    this.onConnecting = options.onConnecting
    this.onCompletionData = options.onCompletionData
    this.onCompletionUpdate = options.onCompletionUpdate
    this.onLatency = options.onLatency
    this.enableCompletionFetch = options.enableCompletionFetch ?? true
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): void {
    void this.connectInternal()
  }

  private async connectInternal(): Promise<void> {
    // 防止销毁后重连
    if (this.isDestroyed) {
      console.warn("[TerminalWS] WebSocket 已销毁，无法重连")
      return
    }
    // 防止并发重复连接
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN)
    ) {
      return
    }

    try {
      // 性能监控：记录连接开始时间
      this.connectStartTime = performance.now()
      performance.mark('ws-terminal-connect-start')

      // 触发正在连接回调
      this.onConnecting?.()

      // 一次性 ticket：用于 WebSocket 握手（避免在 URL 中暴露 access_token）
      const { ticket } = await createAuthTicket({
        type: "ws_terminal",
        server_id: this.serverId,
      })
      if (this.isDestroyed) return

      const params = new URLSearchParams()
      params.set("cols", String(this.cols))
      params.set("rows", String(this.rows))
      params.set("ticket", ticket)
      const wsUrl = getWsUrl(`/api/v1/ssh/terminal/${this.serverId}?${params.toString()}`)

      this.ws = new WebSocket(wsUrl)
      this.ws.binaryType = "arraybuffer" // 设置为二进制模式

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        // 注意：onopen只表示WebSocket握手完成，SSH连接可能还在建立中
        // 真正的连接成功由服务器的"connected"消息通知
      }

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // 二进制数据 - SSH 输出
          // 复用 decoder 实例，避免每次创建新的 TextDecoder
          const text = this.decoder.decode(event.data, { stream: true })
          this.onData(text)
        } else if (typeof event.data === "string") {
          // JSON 控制消息
          try {
            const message = JSON.parse(event.data)
            this.handleControlMessage(message)
          } catch (error) {
            console.error("[TerminalWS] 解析消息失败:", error)
          }
        }
      }

      this.ws.onerror = () => {
        console.error("[TerminalWS] WebSocket 错误")
        this.onError?.(new Error("WebSocket 连接错误"))
      }

      this.ws.onclose = () => {
        this.stopPing()

        const remaining = this.decoder.decode()
        if (remaining) {
          this.onData(remaining)
        }

        // 防止销毁后重连
        if (this.isDestroyed) {
          return
        }

        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          // 自动重连
          this.reconnectAttempts++
          setTimeout(() => this.connect(), this.reconnectDelay)
        } else {
          this.onDisconnected?.()
        }
      }
    } catch (error) {
      console.error("[TerminalWS] 连接失败:", error)
      this.onError?.(error as Error)
    }
  }

  /**
   * 发送输入数据（二进制）
   */
  sendInput(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[TerminalWS] WebSocket 未连接，无法发送数据")
      return
    }

    try {
      // 使用二进制传输以提高性能，复用 encoder 实例
      const binaryData = this.encoder.encode(data)
      this.ws.send(binaryData.buffer)
    } catch (error) {
      console.error("[TerminalWS] 发送数据失败:", error)
      this.onError?.(error as Error)
    }
  }

  /**
   * 调整终端大小
   */
  resize(cols: number, rows: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    this.cols = cols
    this.rows = rows

    try {
      const message = {
        type: "resize",
        data: { cols, rows }
      }
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error("[TerminalWS] 发送调整大小消息失败:", error)
    }
  }

  /**
   * 请求补全数据
   */
  fetchCompletionData(historyLimit: number = 500): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[TerminalWS] WebSocket 未连接，无法请求补全数据")
      return
    }

    try {
      const message = {
        type: "fetch_completion_data",
        data: { historyLimit }
      }
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error("[TerminalWS] 发送补全数据请求失败:", error)
    }
  }

  /**
   * 上报补全增量更新（命令执行后）
   */
  sendCompletionUpdate(newCommand: string): void {
    if (!newCommand.trim()) {
      return
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      const message = {
        type: "completion_update",
        data: { newCommand },
      }
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error("[TerminalWS] 发送补全增量更新失败:", error)
    }
  }

  /**
   * 动态更新补全拉取开关
   */
  setCompletionFetchEnabled(enabled: boolean): void {
    this.enableCompletionFetch = enabled
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.isManualClose = true
    this.isDestroyed = true // 标记为已销毁
    this.stopPing()

    if (this.ws) {
      const readyState = this.ws.readyState

      // 根据 WebSocket 状态执行不同的清理逻辑
      if (readyState === WebSocket.OPEN || readyState === WebSocket.CLOSING) {
        // 连接已建立或正在关闭,安全关闭连接
        this.ws.close(1000, "客户端主动断开")
      } else if (readyState === WebSocket.CONNECTING) {
        // 连接正在建立中,清除所有回调防止后续执行
        this.ws.onopen = null
        this.ws.onmessage = null
        this.ws.onerror = null
        this.ws.onclose = null
      }
      // CLOSED 状态无需处理

      this.ws = null
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * 处理控制消息
   */
  private handleControlMessage(message: { type: string; data?: unknown }): void {
    switch (message.type) {
      case "handshake_complete":
        // WebSocket握手完成，SSH连接正在建立
        this.handshakeTime = performance.now() - this.connectStartTime
        performance.mark('ws-terminal-handshake-complete')
        performance.measure('ws-terminal-handshake', 'ws-terminal-connect-start', 'ws-terminal-handshake-complete')

        this.onHandshakeComplete?.()
        break
      case "connected":
        // SSH会话已建立，可以开始使用
        performance.mark('ws-terminal-connected')
        performance.measure('ws-terminal-total', 'ws-terminal-connect-start', 'ws-terminal-connected')
        performance.measure('ws-terminal-ssh-init', 'ws-terminal-handshake-complete', 'ws-terminal-connected')

        this.onConnected?.()
        this.startPing()

        // SSH连接建立后按需请求补全数据
        if (this.enableCompletionFetch) {
          this.fetchCompletionData(500)
        }
        break
      case "completion_data":
        // 补全数据响应
        if (this.onCompletionData && message.data) {
          this.onCompletionData(message.data as CompletionDataResponse)
        }
        break
      case "completion_update":
        if (this.onCompletionUpdate && message.data) {
          this.onCompletionUpdate(message.data as CompletionUpdateResponse)
        }
        break
      case "error":
        console.error("[TerminalWS] 服务器错误:", message.data)
        this.onError?.(
          new Error(
            message.data &&
              typeof message.data === "object" &&
              "message" in message.data &&
              typeof message.data.message === "string"
              ? message.data.message
              : "服务器错误"
          )
        )
        break
      case "closed":
        // 服务器关闭连接
        this.disconnect()
        break
      case "pong":
        this.handlePong(message.data as PongMessageData | undefined)
        break
      default:
        console.warn("[TerminalWS] 未知消息类型:", message.type)
    }
  }

  /**
   * 启动心跳
   */
  private startPing(): void {
    this.sendPing()
    this.pingInterval = setInterval(() => {
      this.sendPing()
    }, TERMINAL_PING_INTERVAL_MS)
  }

  /**
   * 停止心跳
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.pendingPings.clear()
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      const startedAt = performance.now()
      this.prunePendingPings(startedAt)
      const id = `${Date.now()}-${++this.pingSeq}`
      this.pendingPings.set(id, startedAt)
      const message = {
        type: "ping",
        data: {
          id,
          ts: Date.now(),
        },
      }
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error("[TerminalWS] 发送心跳失败:", error)
    }
  }

  private prunePendingPings(now: number = performance.now()): void {
    for (const [id, startedAt] of this.pendingPings) {
      if (now - startedAt > TERMINAL_PING_TIMEOUT_MS) {
        this.pendingPings.delete(id)
      }
    }

    while (this.pendingPings.size >= TERMINAL_MAX_PENDING_PINGS) {
      const oldestId = this.pendingPings.keys().next().value as string | undefined
      if (!oldestId) {
        break
      }
      this.pendingPings.delete(oldestId)
    }
  }

  private handlePong(data?: PongMessageData): void {
    if (!data) {
      return
    }

    let rtt: number | null = null
    if (data.id && this.pendingPings.has(data.id)) {
      const startedAt = this.pendingPings.get(data.id)!
      this.pendingPings.delete(data.id)
      rtt = Math.max(0, Math.round(performance.now() - startedAt))
    } else if (typeof data.ts === "number") {
      rtt = Math.max(0, Math.round(Date.now() - data.ts))
    }

    if (rtt === null) {
      return
    }

    const ALPHA = 1 / 8
    const BETA = 1 / 4

    if (!this.latencySmoothedMs || this.latencySmoothedMs <= 0) {
      this.latencySmoothedMs = rtt
      this.latencyDevMs = 0
    } else {
      const smoothed = this.latencySmoothedMs + ALPHA * (rtt - this.latencySmoothedMs)
      this.latencySmoothedMs = Math.max(0, Math.round(smoothed))
      this.latencyDevMs = Math.max(
        0,
        Math.round(this.latencyDevMs + BETA * (Math.abs(rtt - smoothed) - this.latencyDevMs))
      )
    }

    const latency: TerminalLatencyData = {
      terminalWsLatencyMs: rtt,
      terminalWsLatencySmoothedMs: this.latencySmoothedMs,
      terminalWsLatencyJitterMs: this.latencyDevMs,
    }

    if (
      typeof data.serverRecvTs === "number" &&
      typeof data.serverSendTs === "number" &&
      typeof data.ts === "number"
    ) {
      const t0 = data.ts
      const t3 = Date.now()
      const t1 = data.serverRecvTs
      const t2 = data.serverSendTs
      const offset = ((t1 - t0) + (t2 - t3)) / 2
      const up = t1 - (t0 + offset)
      const down = t3 - (t2 + offset)

      latency.terminalWsClockOffsetMs = Math.round(offset)
      latency.terminalWsLatencyUpMs = Math.max(0, Math.round(up))
      latency.terminalWsLatencyDownMs = Math.max(0, Math.round(down))
    }

    if (typeof data.sshLatencyMs === "number" && data.sshLatencyMs >= 0) {
      latency.terminalSshLatencyMs = Math.round(data.sshLatencyMs)
    }
    if (typeof data.sshLatencyMeasuredAt === "number" && data.sshLatencyMeasuredAt > 0) {
      latency.terminalSshLatencyMeasuredAt = data.sshLatencyMeasuredAt
    }

    this.onLatency?.(latency)
  }
}
