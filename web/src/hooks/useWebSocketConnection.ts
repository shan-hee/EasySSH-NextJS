/**
 * WebSocket 连接管理 Hook
 * 负责创建、管理和销毁 WebSocket 连接
 */

import { useEffect, useRef } from 'react'
import {
  TerminalWebSocket,
  type CompletionDataResponse,
  type CompletionUpdateResponse,
} from '@/lib/websocket-terminal'
import { useTerminalStore } from '@/stores/terminal-store'
import type { Terminal } from '@xterm/xterm'

export interface WebSocketConnectionConfig {
  sessionId: string
  serverId?: string
  isConnected: boolean
  terminal: Terminal | undefined
  cols: number
  rows: number
  onLoadingChange?: (isLoading: boolean) => void
  onCompletionData?: (data: CompletionDataResponse) => void
  onCompletionUpdate?: (data: CompletionUpdateResponse) => void
  enableCompletionFetch?: boolean
}

/**
 * 管理 WebSocket 连接的生命周期
 */
export function useWebSocketConnection(config: WebSocketConnectionConfig) {
  const {
    sessionId,
    serverId,
    isConnected,
    cols,
    rows,
    onLoadingChange,
    onCompletionData,
    onCompletionUpdate,
    enableCompletionFetch,
  } = config

  const wsRef = useRef<TerminalWebSocket | null>(null)
  const getTerminal = useTerminalStore(state => state.getTerminal)
  const updateWebSocket = useTerminalStore(state => state.updateWebSocket)
  const updateLatency = useTerminalStore(state => state.updateLatency)

  // ==================== 方案C：使用 ref 存储最新的回调 ====================
  const onLoadingChangeRef = useRef(onLoadingChange)
  const onCompletionDataRef = useRef(onCompletionData)
  const onCompletionUpdateRef = useRef(onCompletionUpdate)

  // 每次渲染时同步最新的回调到 ref
  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange
  }, [onLoadingChange])

  useEffect(() => {
    onCompletionDataRef.current = onCompletionData
  }, [onCompletionData])

  useEffect(() => {
    onCompletionUpdateRef.current = onCompletionUpdate
  }, [onCompletionUpdate])

  // ==================== 核心修复：从 Store 同步 wsRef ====================
  // 每次渲染时，先从 Store 获取现有连接
  const instance = getTerminal(sessionId)
  if (instance?.wsConnection && !wsRef.current) {
    // Store 中有连接，但 ref 未初始化，同步过来
    wsRef.current = instance.wsConnection
  }

  // ==================== 关键修复：检测终端实例是否准备好 ====================
  // 从 Store 获取终端实例状态，作为依赖项信号
  const terminalReady = !!instance?.terminal

  // 创建或更新 WebSocket 连接
  useEffect(() => {
    // 从 Store 动态获取终端实例（避免闭包过期问题）
    const currentInstance = getTerminal(sessionId)
    const terminalInstance = currentInstance?.terminal

    // 只有满足以下条件才创建连接：
    // 1. 有 serverId
    // 2. 服务器已连接
    // 3. 终端实例已创建
    if (!serverId || !isConnected || !terminalInstance) {
      // 如果连接断开，清理现有连接
      if (wsRef.current) {
        wsRef.current.disconnect()
        wsRef.current = null
        updateWebSocket(sessionId, null)
      }
      return
    }

    // 检查是否已有连接且 serverId 未变化（从 Store 和 ref 双重检查）
    if (wsRef.current && currentInstance?.serverId === serverId) {
      return
    }

    // 如果 Store 中有连接且 serverId 匹配，同步到 ref
    if (currentInstance?.wsConnection && currentInstance.serverId === serverId) {
      wsRef.current = currentInstance.wsConnection
      return
    }

    // 创建新连接
    try {
      onLoadingChangeRef.current?.(true)

      const ws = new TerminalWebSocket({
        serverId,
        cols,
        rows,
        onData: (data) => {
          // 动态获取终端实例，避免闭包过期
          const inst = getTerminal(sessionId)
          if (inst?.terminal) {
            inst.terminal.write(data)
          }
        },
        onConnected: () => {
          onLoadingChangeRef.current?.(false)
          // 连接成功后不再向终端注入额外提示，避免污染 SSH 输出
          // 并规避透明背景 + WebGL 场景下的局部黑底伪影
        },
        onDisconnected: () => {
          const inst = getTerminal(sessionId)
          if (inst?.terminal) {
            inst.terminal.writeln('\r\n\x1b[1;31m✗ Connection closed\x1b[0m')
          }
        },
        onError: (error) => {
          console.error('[useWebSocketConnection] WebSocket 错误:', error)
          const inst = getTerminal(sessionId)
          if (inst?.terminal) {
            inst.terminal.writeln(`\r\n\x1b[1;31m✗ Error: ${error.message}\x1b[0m`)
          }
        },
        onCompletionData: (data) => {
          onCompletionDataRef.current?.(data)
        },
        onCompletionUpdate: (data) => {
          onCompletionUpdateRef.current?.(data)
        },
        onLatency: (data) => {
          updateLatency(sessionId, data)
        },
        enableCompletionFetch: !!enableCompletionFetch,
      })

      ws.connect()
      wsRef.current = ws

      // 更新 Store 中的连接引用和 serverId
      const currentInstance = getTerminal(sessionId)
      if (currentInstance) {
        updateWebSocket(sessionId, ws)
        // 同时更新 serverId
        const updatedInstance = {
          ...currentInstance,
          wsConnection: ws,
          serverId
        }
        useTerminalStore.getState().setTerminal(sessionId, updatedInstance)
      }
    } catch (error) {
      console.error('[useWebSocketConnection] 创建 WebSocket 失败:', error)
      onLoadingChangeRef.current?.(false)
    }

    // 清理函数：组件卸载时不断开连接，保持 WebSocket 活跃
    return () => {
      // 注意：这里不调用 disconnect()，连接会保持活跃
      // 只有在页签关闭时才会通过 Store.destroySession() 真正断开
    }
    // 依赖项说明：
    // - sessionId: 会话变化时需要重新连接
    // - serverId: 服务器变化时需要重新连接
    // - isConnected: 连接状态变化时需要处理
    // - terminalReady: 终端实例创建完成时触发连接（关键修复！）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, serverId, isConnected, terminalReady])

  // 动态同步补全拉取开关，避免切换配置时必须重建连接
  useEffect(() => {
    if (!wsRef.current) {
      return
    }

    const shouldFetch = !!enableCompletionFetch
    wsRef.current.setCompletionFetchEnabled(shouldFetch)

    // 开关从关闭切到开启且连接已建立时，主动拉取一次补全数据
    if (shouldFetch && wsRef.current.isConnected()) {
      wsRef.current.fetchCompletionData(500)
    }
  }, [enableCompletionFetch, sessionId, serverId])

  // 返回当前连接引用
  return {
    ws: wsRef.current,
    sendInput: (data: string) => {
      if (wsRef.current && wsRef.current.isConnected()) {
        wsRef.current.sendInput(data)
      }
    },
    resize: (newCols: number, newRows: number) => {
      if (wsRef.current && wsRef.current.isConnected()) {
        wsRef.current.resize(newCols, newRows)
      }
    }
  }
}
