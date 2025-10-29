/**
 * 全局终端状态管理
 * 负责管理所有终端实例的生命周期、WebSocket 连接和挂载状态
 */

import { create } from 'zustand'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import { TerminalWebSocket } from '@/lib/websocket-terminal'

/**
 * 终端实例状态
 */
export interface TerminalInstanceState {
  terminal: Terminal
  fitAddon: FitAddon
  wsConnection: TerminalWebSocket | null
  isMounted: boolean
  container: HTMLDivElement | null
  createdAt: number
  serverId?: string  // 记录关联的服务器 ID
}

/**
 * 终端 Store 状态
 */
interface TerminalStoreState {
  // 终端实例映射 sessionId -> TerminalInstanceState
  terminals: Map<string, TerminalInstanceState>

  // 获取终端实例
  getTerminal: (sessionId: string) => TerminalInstanceState | undefined

  // 设置终端实例
  setTerminal: (sessionId: string, instance: TerminalInstanceState) => void

  // 更新终端挂载状态
  updateMountState: (sessionId: string, isMounted: boolean, container?: HTMLDivElement | null) => void

  // 更新 WebSocket 连接
  updateWebSocket: (sessionId: string, ws: TerminalWebSocket | null) => void

  // 销毁终端实例（页签关闭时调用）
  destroySession: (sessionId: string) => void

  // 清理所有实例（应用关闭时调用）
  destroyAll: () => void
}

/**
 * 创建全局终端状态管理 Store
 */
export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  terminals: new Map<string, TerminalInstanceState>(),

  getTerminal: (sessionId: string) => {
    return get().terminals.get(sessionId)
  },

  setTerminal: (sessionId: string, instance: TerminalInstanceState) => {
    set((state) => {
      const newTerminals = new Map(state.terminals)
      newTerminals.set(sessionId, instance)
      return { terminals: newTerminals }
    })
  },

  updateMountState: (sessionId: string, isMounted: boolean, container?: HTMLDivElement | null) => {
    set((state) => {
      const instance = state.terminals.get(sessionId)
      if (!instance) return state

      const newTerminals = new Map(state.terminals)
      newTerminals.set(sessionId, {
        ...instance,
        isMounted,
        container: container !== undefined ? container : instance.container
      })
      return { terminals: newTerminals }
    })
  },

  updateWebSocket: (sessionId: string, ws: TerminalWebSocket | null) => {
    set((state) => {
      const instance = state.terminals.get(sessionId)
      if (!instance) return state

      const newTerminals = new Map(state.terminals)
      newTerminals.set(sessionId, {
        ...instance,
        wsConnection: ws
      })
      return { terminals: newTerminals }
    })
  },

  destroySession: (sessionId: string) => {
    const instance = get().terminals.get(sessionId)
    if (!instance) return

    console.log(`[TerminalStore] 销毁会话: ${sessionId}`)

    // 1. 断开 WebSocket
    if (instance.wsConnection) {
      try {
        instance.wsConnection.disconnect()
      } catch (error) {
        console.error(`[TerminalStore] 断开 WebSocket 失败:`, error)
      }
    }

    // 2. 销毁终端实例
    try {
      instance.terminal.dispose()
    } catch (error) {
      console.error(`[TerminalStore] 销毁终端实例失败:`, error)
    }

    // 3. 从映射中移除
    set((state) => {
      const newTerminals = new Map(state.terminals)
      newTerminals.delete(sessionId)
      return { terminals: newTerminals }
    })
  },

  destroyAll: () => {
    const terminals = get().terminals
    console.log(`[TerminalStore] 清理所有终端实例，共 ${terminals.size} 个`)

    // 销毁所有终端实例
    terminals.forEach((instance, sessionId) => {
      try {
        if (instance.wsConnection) {
          instance.wsConnection.disconnect()
        }
        instance.terminal.dispose()
      } catch (error) {
        console.error(`[TerminalStore] 清理会话 ${sessionId} 失败:`, error)
      }
    })

    // 清空映射
    set({ terminals: new Map() })
  }
}))

/**
 * 应用卸载时清理所有终端实例
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useTerminalStore.getState().destroyAll()
  })
}
