/**
 * WebSocket 终端连接管理器
 * 支持二进制协议以提高性能
 */

import { getWsUrl } from './config'
import { createAuthTicket } from "@/lib/auth-ticket"

const TERMINAL_PING_INTERVAL_MS = 5000
const TERMINAL_PING_TIMEOUT_MS = 60000
const TERMINAL_MAX_PENDING_PINGS = 20

export type TerminalConnectionPhase =
  | "idle"
  | "ticket"
  | "ws_connecting"
  | "ssh_connecting"
  | "authenticating"
  | "ready"
  | "reconnecting"
  | "failed"
  | "closed"

export interface TerminalConnectionError extends Error {
  code?: string
  rawMessage?: string
  retryable?: boolean
  details?: unknown
}

export interface TerminalHostKeyDetails {
  host: string
  port: number
  expected_key: string
  received_key: string
  expected_key_type: string
  received_key_type: string
  message?: string
}

export interface TerminalHostKeyPrompt extends TerminalHostKeyDetails {
  request_id: string
}

export type TerminalHostKeyResponder = (
  accepted: boolean,
  fingerprint?: string
) => void

export interface TerminalWebSocketOptions {
  serverId: string
  cols: number
  rows: number
  onData: (data: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: TerminalConnectionError) => void
  onHandshakeComplete?: () => void // 握手完成回调
  onConnecting?: () => void // 正在连接回调
  onCompletionData?: (data: CompletionDataResponse) => void // 补全数据回调
  onCompletionUpdate?: (data: CompletionUpdateResponse) => void // 补全增量更新回调
  onLatency?: (data: TerminalLatencyData) => void // 终端链路延迟回调
  onAuthPrompt?: (prompt: TerminalAuthPrompt, respond: TerminalAuthPromptResponder) => void // SSH交互式认证回调
  onHostKeyPrompt?: (prompt: TerminalHostKeyPrompt, respond: TerminalHostKeyResponder) => void // SSH主机密钥变更确认回调
  onConnectionPhase?: (phase: TerminalConnectionPhase) => void
  enableCompletionFetch?: boolean // 是否在连接成功后自动拉取补全数据
}

export interface TerminalAuthPromptItem {
  text: string
  echo: boolean
}

export type TerminalAuthMethod = "password" | "key"

export interface TerminalAuthPrompt {
  request_id: string
  kind?: "keyboard_interactive" | "credential_retry" | "private_key_passphrase" | string
  name?: string
  instruction?: string
  prompts: TerminalAuthPromptItem[]
  auth_method?: TerminalAuthMethod
  attempt?: number
  max_attempts?: number
  attempts_remaining?: number
}

export type TerminalAuthPromptResponder = (
  answers: string[],
  cancelled?: boolean,
  authMethod?: TerminalAuthMethod
) => void

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

function createTerminalConnectionError(
  message: string,
  code?: string,
  retryable: boolean = false,
  details?: unknown
): TerminalConnectionError {
  const error = new Error(message) as TerminalConnectionError
  error.code = code
  error.rawMessage = message
  error.retryable = retryable
  error.details = details
  return error
}

function getErrorPayload(data: unknown): { code?: string; message: string; details?: unknown } {
  if (!data || typeof data !== "object") {
    return { message: "服务器错误" }
  }

  const payload = data as Record<string, unknown>
  const code = typeof payload.error === "string" ? payload.error : undefined
  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : "服务器错误"
  const details = "details" in payload ? payload.details : undefined

  return { code, message, details }
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
  private onError?: (error: TerminalConnectionError) => void
  private onHandshakeComplete?: () => void
  private onConnecting?: () => void
  private onCompletionData?: (data: CompletionDataResponse) => void
  private onCompletionUpdate?: (data: CompletionUpdateResponse) => void
  private onLatency?: (data: TerminalLatencyData) => void
  private onAuthPrompt?: (prompt: TerminalAuthPrompt, respond: TerminalAuthPromptResponder) => void
  private onHostKeyPrompt?: (prompt: TerminalHostKeyPrompt, respond: TerminalHostKeyResponder) => void
  private onConnectionPhase?: (phase: TerminalConnectionPhase) => void
  private enableCompletionFetch: boolean
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 2000
  private isManualClose = false
  private isDestroyed = false // 防止销毁后重连
  private authCancelled = false
  private phase: TerminalConnectionPhase = "idle"
  private lastError: TerminalConnectionError | null = null
  private errorNotified = false
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
    this.onAuthPrompt = options.onAuthPrompt
    this.onHostKeyPrompt = options.onHostKeyPrompt
    this.onConnectionPhase = options.onConnectionPhase
    this.enableCompletionFetch = options.enableCompletionFetch ?? true
  }

  private setPhase(phase: TerminalConnectionPhase): void {
    if (this.phase === phase) {
      return
    }

    this.phase = phase
    this.onConnectionPhase?.(phase)
  }

  private notifyError(error: TerminalConnectionError): void {
    this.lastError = error
    this.errorNotified = true
    this.onError?.(error)
  }

  private shouldReconnect(event: CloseEvent): boolean {
    if (
      this.isManualClose ||
      this.isDestroyed ||
      this.authCancelled ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return false
    }

    // 正常关闭通常来自用户主动退出 shell 或服务端优雅关闭，不应自动重连。
    if (event.code === 1000 || event.code === 1001) {
      return false
    }

    return this.phase !== "failed"
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
      this.setPhase("ticket")

      // 触发正在连接回调
      this.onConnecting?.()

      // 一次性 ticket：用于 WebSocket 握手（避免在 URL 中暴露 access_token）
      const { ticket } = await createAuthTicket({
        type: "ws_terminal",
        server_id: this.serverId,
      })
      if (this.isDestroyed) return

      this.setPhase("ws_connecting")
      const params = new URLSearchParams()
      params.set("cols", String(this.cols))
      params.set("rows", String(this.rows))
      params.set("ticket", ticket)
      const wsUrl = getWsUrl(`/api/v1/ssh/terminal/${this.serverId}?${params.toString()}`)

      this.ws = new WebSocket(wsUrl)
      this.ws.binaryType = "arraybuffer" // 设置为二进制模式

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.lastError = null
        this.errorNotified = false
        this.setPhase("ssh_connecting")
        this.startPing()
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
        this.lastError = createTerminalConnectionError(
          "WebSocket 连接错误",
          "websocket_error",
          true
        )
      }

      this.ws.onclose = (event) => {
        this.stopPing()

        const remaining = this.decoder.decode()
        if (remaining) {
          this.onData(remaining)
        }

        // 防止销毁后重连
        if (this.isDestroyed) {
          return
        }

        if (this.shouldReconnect(event)) {
          // 自动重连
          this.reconnectAttempts++
          this.setPhase("reconnecting")
          setTimeout(() => this.connect(), this.reconnectDelay)
        } else {
          if (this.lastError && !this.errorNotified) {
            this.setPhase("failed")
            this.notifyError(this.lastError)
          } else if (this.phase !== "failed") {
            this.setPhase("closed")
          }
          this.onDisconnected?.()
        }
      }
    } catch (error) {
      console.error("[TerminalWS] 连接失败:", error)
      const terminalError = createTerminalConnectionError(
        error instanceof Error ? error.message : "连接失败",
        "connection_failed",
        true
      )
      this.setPhase("failed")
      this.notifyError(terminalError)
      this.onDisconnected?.()
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
      this.notifyError(
        createTerminalConnectionError(
          error instanceof Error ? error.message : "发送数据失败",
          "send_failed",
          false
        )
      )
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
   * 响应 SSH keyboard-interactive 认证提示
   */
  sendAuthResponse(
    requestId: string,
    answers: string[],
    cancelled: boolean = false,
    authMethod?: TerminalAuthMethod
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[TerminalWS] WebSocket 未连接，无法发送认证响应")
      return
    }

    try {
      if (cancelled) {
        this.isManualClose = true
        this.authCancelled = true
        this.setPhase("closed")
      }

      const message = {
        type: "auth_response",
        data: {
          request_id: requestId,
          answers,
          cancelled,
          auth_method: authMethod,
        },
      }
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error("[TerminalWS] 发送认证响应失败:", error)
      this.notifyError(
        createTerminalConnectionError(
          error instanceof Error ? error.message : "发送认证响应失败",
          "auth_response_failed",
          false
        )
      )
    }
  }

  /**
   * 响应 SSH 主机密钥变更确认
   */
  sendHostKeyResponse(
    requestId: string,
    accepted: boolean,
    fingerprint?: string
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[TerminalWS] WebSocket 未连接，无法发送主机密钥确认")
      return
    }

    try {
      const message = {
        type: "host_key_response",
        data: {
          request_id: requestId,
          accepted,
          fingerprint,
        },
      }
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error("[TerminalWS] 发送主机密钥确认失败:", error)
      this.notifyError(
        createTerminalConnectionError(
          error instanceof Error ? error.message : "发送主机密钥确认失败",
          "host_key_response_failed",
          false
        )
      )
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
    this.setPhase("closed")

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
    return (
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN &&
      this.phase === "ready"
    )
  }

  getPhase(): TerminalConnectionPhase {
    return this.phase
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

        this.setPhase("ready")
        this.lastError = null
        this.errorNotified = false
        this.authCancelled = false
        this.onConnected?.()

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
      case "auth_prompt":
        if (message.data && typeof message.data === "object") {
          this.setPhase("authenticating")
          const prompt = message.data as TerminalAuthPrompt
          const respond: TerminalAuthPromptResponder = (answers, cancelled = false, authMethod) => {
            this.sendAuthResponse(prompt.request_id, answers, cancelled, authMethod)
          }

          if (this.onAuthPrompt) {
            this.onAuthPrompt(prompt, respond)
          } else {
            respond([], true)
          }
        }
        break
      case "host_key_prompt":
        if (message.data && typeof message.data === "object") {
          this.setPhase("authenticating")
          const prompt = message.data as TerminalHostKeyPrompt
          const respond: TerminalHostKeyResponder = (accepted, fingerprint) => {
            this.sendHostKeyResponse(prompt.request_id, accepted, fingerprint)
          }

          if (this.onHostKeyPrompt) {
            this.onHostKeyPrompt(prompt, respond)
          } else {
            respond(false)
          }
        }
        break
      case "error":
        console.error("[TerminalWS] 服务器错误:", message.data)
        const {
          code: errorCode,
          message: errorMessage,
          details: errorDetails,
        } = getErrorPayload(message.data)
        if (
          errorCode === "initialization_failed" ||
          errorCode === "initialization_timeout" ||
          errorCode === "host_key_changed" ||
          errorCode === "auth_cancelled" ||
          errorCode === "auth_failed" ||
          errorCode === "private_key_passphrase_required" ||
          errorCode === "private_key_passphrase_invalid" ||
          errorCode === "private_key_invalid" ||
          errorCode === "private_key_decrypt_failed" ||
          errorCode === "password_decrypt_failed" ||
          errorCode === "connection_refused" ||
          errorCode === "no_route_to_host" ||
          errorCode === "network_unreachable" ||
          errorCode === "connection_timeout" ||
          errorCode === "host_key_revoked" ||
          errorCode === "ssh_algorithm_mismatch"
        ) {
          this.isManualClose = true
          this.setPhase("failed")
        }
        if (this.authCancelled && errorCode === "initialization_failed") {
          break
        }
        this.notifyError(
          createTerminalConnectionError(errorMessage, errorCode, false, errorDetails)
        )
        break
      case "closed":
        // 服务器关闭连接
        this.isManualClose = true
        this.isDestroyed = true
        this.stopPing()
        this.setPhase("closed")

        if (this.ws) {
          const socket = this.ws
          this.ws = null
          if (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
          ) {
            socket.close(1000, "服务器关闭连接")
          }
        }

        this.onDisconnected?.()
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
    if (this.pingInterval) {
      return
    }

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
