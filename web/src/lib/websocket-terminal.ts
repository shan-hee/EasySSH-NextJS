/**
 * WebSocket 终端连接管理器
 * 支持二进制协议以提高性能
 */

import { getWsUrl } from './config'

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
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 2000
  private isManualClose = false
  private isDestroyed = false // 防止销毁后重连
  private pingInterval: NodeJS.Timeout | null = null
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
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): void {
    // 防止销毁后重连
    if (this.isDestroyed) {
      console.warn("[TerminalWS] WebSocket 已销毁，无法重连")
      return
    }

    try {
      // 性能监控：记录连接开始时间
      this.connectStartTime = performance.now()
      performance.mark('ws-terminal-connect-start')

      // 触发正在连接回调
      this.onConnecting?.()

      // 构建 WebSocket URL（凭 HttpOnly Cookie 认证，不再拼接 token）
      const wsUrl = getWsUrl(`/api/v1/ssh/terminal/${this.serverId}?cols=${this.cols}&rows=${this.rows}`)

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
  private handleControlMessage(message: { type: string; data?: { message?: string; status?: string } }): void {
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
        break
      case "error":
        console.error("[TerminalWS] 服务器错误:", message.data)
        this.onError?.(new Error(message.data?.message || "服务器错误"))
        break
      case "closed":
        // 服务器关闭连接
        this.disconnect()
        break
      case "pong":
        // 心跳响应
        break
      default:
        console.warn("[TerminalWS] 未知消息类型:", message.type)
    }
  }

  /**
   * 启动心跳
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          const message = { type: "ping" }
          this.ws.send(JSON.stringify(message))
        } catch (error) {
          console.error("[TerminalWS] 发送心跳失败:", error)
        }
      }
    }, 30000) // 每30秒发送一次心跳
  }

  /**
   * 停止心跳
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}
