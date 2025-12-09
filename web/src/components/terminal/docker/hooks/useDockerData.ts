/**
 * Docker 数据获取 Hook
 * 使用 WebSocket 获取数据（复用监控连接）
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMonitorStore } from '@/stores/monitor-store'
import type { DockerDataResponse } from '../types'

interface UseDockerDataOptions {
  serverId: string
  enabled?: boolean
  refreshInterval?: number // 毫秒，默认 15 秒
}

interface UseDockerDataReturn {
  data: DockerDataResponse | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useDockerData({
  serverId,
  enabled = true,
  refreshInterval = 15000,
}: UseDockerDataOptions): UseDockerDataReturn {
  const [data, setData] = useState<DockerDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // 从 Store 获取请求方法
  const requestDockerData = useMonitorStore(state => state.requestDockerData)
  const getConnection = useMonitorStore(state => state.getConnection)

  // 获取数据
  const fetchData = useCallback(async () => {
    if (!serverId || !enabled) return

    // 检查 WebSocket 连接状态
    const connection = getConnection(serverId)
    if (!connection?.ws || connection.ws.readyState !== WebSocket.OPEN) {
      if (isMountedRef.current) {
        setError('WebSocket not connected')
        setLoading(false)
      }
      return
    }

    try {
      const result = await requestDockerData(serverId)
      if (isMountedRef.current) {
        setData(result)
        setError(result.error || null)
        setLoading(false)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(String(err))
        setLoading(false)
      }
    }
  }, [serverId, enabled, requestDockerData, getConnection])

  // 刷新函数
  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchData()
  }, [fetchData])

  // 初始加载和定时刷新
  useEffect(() => {
    isMountedRef.current = true

    if (enabled && serverId) {
      // 初始加载
      fetchData()

      // 设置定时刷新
      if (refreshInterval > 0) {
        intervalRef.current = setInterval(fetchData, refreshInterval)
      }
    }

    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [serverId, enabled, refreshInterval, fetchData])

  return {
    data,
    loading,
    error,
    refresh,
  }
}
