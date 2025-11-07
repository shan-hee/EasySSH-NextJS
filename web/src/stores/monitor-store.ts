/**
 * 监控连接全局状态管理
 * 负责管理所有监控 WebSocket 连接的生命周期
 */

import { create } from 'zustand'

/**
 * 监控数据结构（从 useMonitorWebSocket.ts 复制）
 */
export interface MonitorMetrics {
  systemInfo: {
    os: string
    hostname: string
    cpuModel: string
    arch: string
    loadAvg: string
    uptimeSeconds: number
    cpuCores: number
  }
  cpu: {
    usage: number
    cores: number
  }
  memory: {
    total: number
    used: number
    free: number
    usagePercent: number
  }
  disk: {
    total: number
    used: number
    free: number
    usagePercent: number
  }
  disks: Array<{
    mountPoint: string
    usedBytes: number
    totalBytes: number
  }>
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
  timestamp: number
  sshLatencyMs: number
  // 本地延迟数据（从客户端到EasySSH服务器）
  localLatencyMs?: number
  localLatencySmoothedMs?: number
  localLatencyJitter?: number
}

/**
 * WebSocket 连接状态
 */
export enum WSStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * 监控连接状态
 */
export interface MonitorConnectionState {
  ws: WebSocket
  metrics: MonitorMetrics | null
  status: WSStatus
  serverId: string
  createdAt: number
  lastUpdateAt: number
  // 独立存储延迟数据，不依赖于metrics对象
  localLatencyMs?: number
  localLatencySmoothedMs?: number
  localLatencyJitter?: number
}

/**
 * 订阅者回调函数类型
 */
type SubscriberCallback = (metrics: MonitorMetrics) => void

/**
 * 监控 Store 状态
 */
interface MonitorStoreState {
  // 监控连接映射 serverId -> MonitorConnectionState
  connections: Map<string, MonitorConnectionState>

  // ==================== 新增：订阅者管理 ====================
  // 订阅者映射 serverId -> Set<callback>
  subscribers: Map<string, Set<SubscriberCallback>>

  // 引用计数 serverId -> count（记录有多少个页签在使用此连接）
  refCount: Map<string, number>

  // 获取监控连接
  getConnection: (serverId: string) => MonitorConnectionState | undefined

  // 设置监控连接
  setConnection: (serverId: string, state: MonitorConnectionState) => void

  // 更新监控数据
  updateMetrics: (serverId: string, metrics: MonitorMetrics) => void

  // 更新本地延迟数据
  updateLocalLatency: (serverId: string, latency: {
    localLatencyMs: number
    localLatencySmoothedMs: number
    localLatencyJitter: number
  }) => void

  // 更新连接状态
  updateStatus: (serverId: string, status: WSStatus) => void

  // ==================== 新增：订阅者方法 ====================
  // 订阅监控数据更新（返回取消订阅函数）
  subscribe: (serverId: string, callback: SubscriberCallback) => () => void

  // 通知所有订阅者（WebSocket 消息到达时调用）
  notifySubscribers: (serverId: string, metrics: MonitorMetrics) => void

  // 销毁监控连接（只有引用计数为 0 时才真正断开）
  destroyConnection: (serverId: string) => void

  // 清理所有连接（应用关闭时调用）
  destroyAll: () => void
}

/**
 * 创建全局监控状态管理 Store
 */
export const useMonitorStore = create<MonitorStoreState>((set, get) => ({
  connections: new Map<string, MonitorConnectionState>(),
  subscribers: new Map<string, Set<SubscriberCallback>>(),
  refCount: new Map<string, number>(),

  getConnection: (serverId: string) => {
    return get().connections.get(serverId)
  },

  setConnection: (serverId: string, state: MonitorConnectionState) => {
    set((storeState) => {
      const newConnections = new Map(storeState.connections)
      newConnections.set(serverId, state)
      return { connections: newConnections }
    })
  },

  updateMetrics: (serverId: string, metrics: MonitorMetrics) => {
    set((storeState) => {
      const connection = storeState.connections.get(serverId)
      if (!connection) return storeState

      const newConnections = new Map(storeState.connections)
      newConnections.set(serverId, {
        ...connection,
        metrics,
        lastUpdateAt: Date.now()
      })
      return { connections: newConnections }
    })
  },

  updateLocalLatency: (serverId: string, latency: {
    localLatencyMs: number
    localLatencySmoothedMs: number
    localLatencyJitter: number
  }) => {
    set((storeState) => {
      const connection = storeState.connections.get(serverId)
      if (!connection) return storeState

      const newConnections = new Map(storeState.connections)

      // 更新连接对象中的延迟数据
      const updatedConnection: MonitorConnectionState = {
        ...connection,
        localLatencyMs: latency.localLatencyMs,
        localLatencySmoothedMs: latency.localLatencySmoothedMs,
        localLatencyJitter: latency.localLatencyJitter,
        lastUpdateAt: Date.now()
      }

      newConnections.set(serverId, updatedConnection)
      return { connections: newConnections }
    })

    // 通知订阅者（延迟数据变化也要通知）
    const connection = get().connections.get(serverId)
    if (connection?.metrics) {
      get().notifySubscribers(serverId, connection.metrics)
    }
  },

  updateStatus: (serverId: string, status: WSStatus) => {
    set((storeState) => {
      const connection = storeState.connections.get(serverId)
      if (!connection) return storeState

      const newConnections = new Map(storeState.connections)
      newConnections.set(serverId, {
        ...connection,
        status,
        lastUpdateAt: Date.now()
      })
      return { connections: newConnections }
    })
  },

  // ==================== 新增：订阅者管理实现 ====================
  subscribe: (serverId: string, callback: SubscriberCallback) => {
    // ==================== P0 修复：合并状态更新，确保原子性 ====================
    // 1. 增加引用计数 + 2. 添加订阅者（合并为单次 set() 调用）
    set((s) => {
      const newRefCount = new Map(s.refCount)
      const currentCount = newRefCount.get(serverId) || 0
      const newCount = currentCount + 1
      newRefCount.set(serverId, newCount)

      const newSubscribers = new Map(s.subscribers)
      const subscribers = newSubscribers.get(serverId) || new Set()
      subscribers.add(callback)
      newSubscribers.set(serverId, subscribers)

      return {
        refCount: newRefCount,
        subscribers: newSubscribers
      }
    })

    // 3. 返回取消订阅函数
    return () => {
      // ==================== P0 修复：同样合并状态更新 ====================
      set((s) => {
        // 移除订阅者
        const newSubscribers = new Map(s.subscribers)
        const subs = newSubscribers.get(serverId)
        if (subs) {
          subs.delete(callback)
        }

        // 减少引用计数
        const newRefCount = new Map(s.refCount)
        const count = Math.max(0, (newRefCount.get(serverId) || 1) - 1)
        newRefCount.set(serverId, count)

        // 如果引用计数归零，立即销毁连接（无延迟）
        if (count === 0) {
          // 注意：这里需要在状态更新后调用 destroyConnection
          // 使用 setTimeout 0 确保状态更新完成后再销毁
          setTimeout(() => get().destroyConnection(serverId), 0)
        }

        return {
          refCount: newRefCount,
          subscribers: newSubscribers
        }
      })
    }
  },

  notifySubscribers: (serverId: string, metrics: MonitorMetrics) => {
    const subscribers = get().subscribers.get(serverId)
    if (!subscribers || subscribers.size === 0) {
      return
    }

    // 通知所有订阅者
    subscribers.forEach((callback) => {
      try {
        callback(metrics)
      } catch (error) {
        console.error(`[MonitorStore] 订阅者回调执行失败:`, error)
      }
    })
  },

  destroyConnection: (serverId: string) => {
    const connection = get().connections.get(serverId)
    if (!connection) return

    // 1. 断开 WebSocket
    try {
      if (connection.ws.readyState === WebSocket.OPEN ||
          connection.ws.readyState === WebSocket.CONNECTING) {
        connection.ws.close(1000, '客户端主动断开')
      }
    } catch (error) {
      console.error(`[MonitorStore] 断开 WebSocket 失败:`, error)
    }

    // 2. 清理订阅者
    set((s) => {
      const newSubscribers = new Map(s.subscribers)
      newSubscribers.delete(serverId)
      return { subscribers: newSubscribers }
    })

    // 3. 清理引用计数
    set((s) => {
      const newRefCount = new Map(s.refCount)
      newRefCount.delete(serverId)
      return { refCount: newRefCount }
    })

    // 4. 从连接映射中移除
    set((storeState) => {
      const newConnections = new Map(storeState.connections)
      newConnections.delete(serverId)
      return { connections: newConnections }
    })
  },

  destroyAll: () => {
    const connections = get().connections

    // 销毁所有连接
    connections.forEach((connection, serverId) => {
      try {
        if (connection.ws.readyState === WebSocket.OPEN ||
            connection.ws.readyState === WebSocket.CONNECTING) {
          connection.ws.close(1000, '应用关闭')
        }
      } catch (error) {
        console.error(`[MonitorStore] 清理连接 ${serverId} 失败:`, error)
      }
    })

    // 清空所有映射
    set({
      connections: new Map(),
      subscribers: new Map(),
      refCount: new Map()
    })
  }
}))

/**
 * 应用卸载时清理所有监控连接
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useMonitorStore.getState().destroyAll()
  })
}
