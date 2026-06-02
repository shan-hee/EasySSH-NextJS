/**
 * 全局终端状态管理
 * 负责管理所有终端实例的生命周期、WebSocket 连接和挂载状态
 */

import { create } from 'zustand'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import { TerminalWebSocket } from '@/lib/websocket-terminal'
import type { TerminalSession } from "@/components/terminal/types"
import type {
  SshWorkspaceSessionController,
  SshWorkspaceSessionStoreAdapter,
  SshWorkspaceTerminalSessionController,
  WorkspaceSessionListUpdater,
  WorkspaceSessionSnapshot,
  WorkspaceTerminalSession,
  WorkspaceTransferTask,
} from "@/lib/session/workspace"

type DisposableAddon = {
  dispose: () => void
}

type SessionUpdater =
  | TerminalSession[]
  | ((sessions: TerminalSession[]) => TerminalSession[])

/**
 * 终端链路延迟数据
 */
export interface TerminalLatencyData {
  // 浏览器到 EasySSH 后端的当前终端 WebSocket RTT
  terminalWsLatencyMs?: number
  terminalWsLatencySmoothedMs?: number
  terminalWsLatencyJitterMs?: number
  terminalWsLatencyUpMs?: number
  terminalWsLatencyDownMs?: number
  terminalWsClockOffsetMs?: number

  // EasySSH 后端到远端 SSH 服务的轻量 transport RTT
  terminalSshLatencyMs?: number
  terminalSshLatencyMeasuredAt?: number

  updatedAt?: number
}

/**
 * 终端实例状态
 */
export interface TerminalInstanceState {
  terminal: Terminal
  fitAddon: FitAddon
  webglAddon: DisposableAddon | null
  wsConnection: TerminalWebSocket | null
  isMounted: boolean
  container: HTMLDivElement | null
  createdAt: number
  serverId?: string  // 记录关联的服务器 ID
  latency?: TerminalLatencyData
}

/**
 * 终端 Store 状态
 */
interface TerminalStoreState {
  // 终端实例映射 sessionId -> TerminalInstanceState
  terminals: Map<string, TerminalInstanceState>

  // 终端页签状态。保持在内存中，用于路由切换后恢复当前浏览器页签内的终端。
  sessions: TerminalSession[]
  activeSessionId: string | null
  lastActivityBySession: Map<string, number>

  // 获取终端实例
  getTerminal: (sessionId: string) => TerminalInstanceState | undefined

  // 设置终端页签列表
  setSessions: (updater: SessionUpdater) => void

  // 设置当前激活页签
  setActiveSessionId: (sessionId: string | null) => void

  // 更新/读取会话最后活动时间
  updateSessionActivity: (sessionId: string, timestamp?: number) => void
  getSessionLastActivity: (sessionId: string) => number | undefined

  // 清理终端页签元数据
  clearTerminalSessionState: () => void

  // 设置终端实例
  setTerminal: (sessionId: string, instance: TerminalInstanceState) => void

  // 更新终端挂载状态
  updateMountState: (sessionId: string, isMounted: boolean, container?: HTMLDivElement | null) => void

  // 更新 WebSocket 连接
  updateWebSocket: (sessionId: string, ws: TerminalWebSocket | null) => void

  // 更新终端链路延迟
  updateLatency: (sessionId: string, latency: Partial<TerminalLatencyData>) => void

  // 销毁终端实例（页签关闭时调用）
  destroySession: (sessionId: string) => void

  // 清理所有实例（应用关闭时调用）
  destroyAll: () => void

  // 退出登录等显式场景：断开连接、销毁实例并清空页签状态
  resetAll: () => void
}

/**
 * 创建全局终端状态管理 Store
 */
export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  terminals: new Map<string, TerminalInstanceState>(),
  sessions: [],
  activeSessionId: null,
  lastActivityBySession: new Map<string, number>(),

  getTerminal: (sessionId: string) => {
    return get().terminals.get(sessionId)
  },

  setSessions: (updater: SessionUpdater) => {
    set((state) => ({
      sessions:
        typeof updater === 'function'
          ? updater(state.sessions)
          : updater,
    }))
  },

  setActiveSessionId: (sessionId: string | null) => {
    set({ activeSessionId: sessionId })
  },

  updateSessionActivity: (sessionId: string, timestamp: number = Date.now()) => {
    set((state) => {
      const next = new Map(state.lastActivityBySession)
      next.set(sessionId, timestamp)
      return { lastActivityBySession: next }
    })
  },

  getSessionLastActivity: (sessionId: string) => {
    return get().lastActivityBySession.get(sessionId)
  },

  clearTerminalSessionState: () => {
    set({
      sessions: [],
      activeSessionId: null,
      lastActivityBySession: new Map<string, number>(),
    })
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
        wsConnection: ws,
        latency: ws ? instance.latency : undefined
      })
      return { terminals: newTerminals }
    })
  },

  updateLatency: (sessionId: string, latency: Partial<TerminalLatencyData>) => {
    set((state) => {
      const instance = state.terminals.get(sessionId)
      if (!instance) return state

      const newTerminals = new Map(state.terminals)
      newTerminals.set(sessionId, {
        ...instance,
        latency: {
          ...instance.latency,
          ...latency,
          updatedAt: Date.now()
        }
      })
      return { terminals: newTerminals }
    })
  },

  destroySession: (sessionId: string) => {
    const instance = get().terminals.get(sessionId)
    if (!instance) return

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
      const newActivity = new Map(state.lastActivityBySession)
      newActivity.delete(sessionId)
      return { terminals: newTerminals, lastActivityBySession: newActivity }
    })
  },

  destroyAll: () => {
    const terminals = get().terminals

    // 销毁所有终端实例
    terminals.forEach((instance, sessionId) => {
      try {
        if (instance.wsConnection) {
          instance.wsConnection.disconnect()
        }
      } catch (error) {
        console.error(`[TerminalStore] 清理会话 ${sessionId} 失败:`, error)
      }
    })

    // 注意：这里不再主动清空 terminals 映射或调用 terminal.dispose()
    // 场景是浏览器刷新 / 关闭前的 beforeunload：
    // - 调用 wsConnection.disconnect() 可以优雅地通知服务端关闭会话
    // - 终端实例和 DOM 很快会随页面卸载一起被浏览器回收
    // - 避免在刷新前一瞬间调用 dispose() 导致终端 UI 立即被清空，看起来“闪一下”
  },

  resetAll: () => {
    const terminals = get().terminals

    terminals.forEach((instance, sessionId) => {
      try {
        if (instance.wsConnection) {
          instance.wsConnection.disconnect()
        }
      } catch (error) {
        console.error(`[TerminalStore] 断开会话 ${sessionId} 失败:`, error)
      }

      try {
        instance.terminal.dispose()
      } catch (error) {
        console.error(`[TerminalStore] 销毁会话 ${sessionId} 失败:`, error)
      }
    })

    set({
      terminals: new Map<string, TerminalInstanceState>(),
      sessions: [],
      activeSessionId: null,
      lastActivityBySession: new Map<string, number>(),
    })
  },
}))

/**
 * 应用卸载时清理所有终端实例
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useTerminalStore.getState().destroyAll()
  })
}

export function createTerminalWorkspaceSessionStoreAdapter(
  getTransferTasks: () => WorkspaceTransferTask[] = () => [],
): SshWorkspaceSessionStoreAdapter {
  return {
    getSnapshot: (): WorkspaceSessionSnapshot => {
      const state = useTerminalStore.getState()
      return {
        terminalSessions: state.sessions as WorkspaceTerminalSession[],
        sftpSessions: [],
        transferTasks: getTransferTasks(),
        activeSessionId: state.activeSessionId,
      }
    },
    subscribe: (listener: (snapshot: WorkspaceSessionSnapshot) => void) => (
      useTerminalStore.subscribe((state) => {
        listener({
          terminalSessions: state.sessions as WorkspaceTerminalSession[],
          sftpSessions: [],
          transferTasks: getTransferTasks(),
          activeSessionId: state.activeSessionId,
        })
      })
    ),
  }
}

const applyTerminalSessionUpdater = (
  updater: WorkspaceSessionListUpdater<WorkspaceTerminalSession>,
): SessionUpdater => (
  typeof updater === "function"
    ? (sessions) => updater(sessions) as TerminalSession[]
    : updater as TerminalSession[]
)

export function createTerminalWorkspaceSessionController(): SshWorkspaceTerminalSessionController {
  return {
    getSessions: () => useTerminalStore.getState().sessions,
    getActiveSessionId: () => useTerminalStore.getState().activeSessionId,
    setSessions: (updater) => {
      useTerminalStore.getState().setSessions(applyTerminalSessionUpdater(updater))
    },
    addSession: (session) => {
      useTerminalStore.getState().setSessions((sessions) => [...sessions, session as TerminalSession])
    },
    updateSession: (sessionId, update) => {
      useTerminalStore.getState().setSessions((sessions) => sessions.map((session) => (
        session.id === sessionId
          ? { ...session, ...update }
          : session
      )))
    },
    activateSession: (sessionId) => {
      useTerminalStore.getState().setActiveSessionId(sessionId)
    },
    closeSession: (sessionId) => {
      const state = useTerminalStore.getState()
      const sessions = state.sessions
      const currentIndex = sessions.findIndex((session) => session.id === sessionId)
      const isClosingActive = state.activeSessionId === sessionId

      state.destroySession(sessionId)
      state.setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionId))

      if (isClosingActive) {
        const nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : currentIndex - 1
        state.setActiveSessionId(sessions[nextIndex]?.id ?? null)
      }
    },
    reset: () => {
      useTerminalStore.getState().resetAll()
    },
  }
}

export function createTerminalWorkspaceSessionControllerAdapter(): SshWorkspaceSessionController {
  return {
    terminal: createTerminalWorkspaceSessionController(),
    resetAll: () => useTerminalStore.getState().resetAll(),
  }
}
