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
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 2000
  private isManualClose = false
  private pingInterval: NodeJS.Timeout | null = null
  // 复用 TextDecoder/TextEncoder 实例以提升性能
  private decoder = new TextDecoder("utf-8")
  private encoder = new TextEncoder()

  constructor(options: TerminalWebSocketOptions) {
    this.serverId = options.serverId
    this.cols = options.cols
    this.rows = options.rows
    this.onData = options.onData
    this.onConnected = options.onConnected
    this.onDisconnected = options.onDisconnected
    this.onError = options.onError
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): void {
    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        throw new Error("未找到访问令牌")
      }

      // 构建 WebSocket URL
      const wsUrl = getWsUrl(`/api/v1/ssh/terminal/${this.serverId}?cols=${this.cols}&rows=${this.rows}&token=${token}`)

      this.ws = new WebSocket(wsUrl)
      this.ws.binaryType = "arraybuffer" // 设置为二进制模式

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.onConnected?.()
        this.startPing()
      }

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // 二进制数据 - SSH 输出
          // 复用 decoder 实例，避免每次创建新的 TextDecoder
          const text = this.decoder.decode(event.data)
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

      this.ws.onerror = (event) => {
        console.error("[TerminalWS] WebSocket 错误:", event)
        this.onError?.(new Error("WebSocket 连接错误"))
      }

      this.ws.onclose = (event) => {
        this.stopPing()

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
    this.stopPing()

    if (this.ws) {
      this.ws.close(1000, "客户端主动断开")
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
  private handleControlMessage(message: any): void {
    switch (message.type) {
      case "connected":
        // 会话已建立
        break
      case "error":
        console.error("[TerminalWS] 服务器错误:", message.data)
        this.onError?.(new Error(message.data.message || "服务器错误"))
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
