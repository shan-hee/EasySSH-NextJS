import { useState, useCallback, useEffect, useRef } from "react"
import { streamChat, chat, ChatMessage } from "@/lib/api/ai"

export interface UseAIChatOptions {
  onError?: (error: Error) => void
  onStreamStart?: () => void
  onStreamEnd?: () => void
}

export interface UseAIChatReturn {
  sendMessage: (messages: ChatMessage[], onDelta: (content: string) => void, model?: string) => Promise<void>
  sendMessageSync: (messages: ChatMessage[], model?: string) => Promise<string>
  isLoading: boolean
  stop: () => void
  error: Error | null
  clearError: () => void
}

/**
 * AI 聊天 Hook - 提供流式和非流式聊天功能
 */
export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { onError, onStreamStart, onStreamEnd } = options
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 组件卸载时中止未完成的流式请求，避免残留连接占用浏览器/服务端资源
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsLoading(false)
  }, [])

  const sendMessage = useCallback(
    async (messages: ChatMessage[], onDelta: (content: string) => void, model?: string) => {
      if (isLoading) return

      setIsLoading(true)
      setError(null)
      onStreamStart?.()
      abortControllerRef.current = new AbortController()

      try {
        await streamChat({ messages, model }, onDelta, abortControllerRef.current.signal)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
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

  const sendMessageSync = useCallback(
    async (messages: ChatMessage[], model?: string): Promise<string> => {
      if (isLoading) throw new Error("Another request is in progress")

      setIsLoading(true)
      setError(null)

      try {
        const response = await chat({ messages, model })
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

  return { sendMessage, sendMessageSync, isLoading, stop, error, clearError }
}
