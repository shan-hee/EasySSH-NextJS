"use client"

import { useState, useCallback } from "react"
import { getAccessToken } from "@/contexts/auth-context"
import { toast } from "sonner"

interface UseSettingsAPIOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface UseSettingsAPIReturn<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
  execute: (apiFn: (token: string) => Promise<T>) => Promise<T | null>
  reset: () => void
}

/**
 * 通用的设置API调用Hook
 *
 * @param options 配置选项
 * @returns API调用方法和状态
 *
 * @example
 * const { execute, isLoading } = useSettingsAPI({
 *   onSuccess: (data) => console.log('Success:', data),
 * })
 *
 * const testConnection = async () => {
 *   await execute((token) => settingsApi.testSMTPConnection(token, config))
 * }
 */
export function useSettingsAPI<T = any>(
  options: UseSettingsAPIOptions<T> = {}
): UseSettingsAPIReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async (apiFn: (token: string) => Promise<T>): Promise<T | null> => {
      try {
        setIsLoading(true)
        setError(null)

        const token = await getAccessToken()
        if (!token) {
          throw new Error("未找到访问令牌")
        }

        const result = await apiFn(token)
        setData(result)
        options.onSuccess?.(result)
        return result
      } catch (err) {
        const error = err as Error
        setError(error)
        options.onError?.(error)
        toast.error(error.message || "操作失败")
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [options]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    data,
    isLoading,
    error,
    execute,
    reset,
  }
}
