import { useState, useCallback, useRef } from "react"
import { aiApi, ChatMessage, StreamEvent } from "@/lib/api/ai"

export interface UseAIChatOptions {
  onError?: (error: Error) => void
  onStreamStart?: () => void
  onStreamEnd?: () => void
}

export interface UseAIChatReturn {
  /** 发送消息并获取流式响应 */
  sendMessage: (
    messages: ChatMessage[],
    onDelta: (content: string) => void
  ) => Promise<void>
  /** 发送消息并获取完整响应（非流式） */
  sendMessageSync: (messages: ChatMessage[]) => Promise<string>
  /** 是否正在加载中 */
  isLoading: boolean
  /** 停止当前请求 */
  stop: () => void
  /** 错误信息 */
  error: Error | null
  /** 清除错误 */
  clearError: () => void
}

/**
 * AI 聊天 Hook
 * 提供流式和非流式聊天功能
 */
export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { onError, onStreamStart, onStreamEnd } = options
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
  }, [])

  /**
   * 发送消息并获取流式响应
   */
  const sendMessage = useCallback(
    async (messages: ChatMessage[], onDelta: (content: string) => void) => {
      if (isLoading) return

      setIsLoading(true)
      setError(null)
      onStreamStart?.()

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController()

      try {
        await aiApi.streamChat(
          { messages, stream: true },
          (event: StreamEvent) => {
            if (event.error) {
              throw new Error(event.error)
            }
            if (event.content) {
              onDelta(event.content)
            }
          },
          abortControllerRef.current.signal
        )
      } catch (err) {
        // 忽略用户取消的请求
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onError?.(error)
        throw error
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
        onStreamEnd?.()
      }
    },
    [isLoading, onError, onStreamStart, onStreamEnd]
  )

  /**
   * 发送消息并获取完整响应（非流式）
   */
  const sendMessageSync = useCallback(
    async (messages: ChatMessage[]): Promise<string> => {
      if (isLoading) throw new Error("Another request is in progress")

      setIsLoading(true)
      setError(null)

      try {
        const response = await aiApi.chat({ messages, stream: false })
        return response.content
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onError?.(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, onError]
  )

  return {
    sendMessage,
    sendMessageSync,
    isLoading,
    stop,
    error,
    clearError,
  }
}
