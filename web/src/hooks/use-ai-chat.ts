import { useState, useCallback, useEffect, useRef } from "react"
import { streamChat, chat, streamChatWithTools, executeTool } from "@/lib/api/ai"
import type { ChatMessage, ToolCall, PermissionMode } from "@/lib/api/ai"
import { isApiError } from "@/lib/api-client"

export interface UseAIChatOptions {
  onError?: (error: Error) => void
  onStreamStart?: () => void
  onStreamEnd?: () => void
  onToolCalls?: (toolCalls: ToolCall[]) => void
}

export interface UseAIChatReturn {
  sendMessage: (messages: ChatMessage[], onDelta: (content: string) => void, model?: string, permissionMode?: PermissionMode) => Promise<void>
  sendMessageSync: (messages: ChatMessage[], model?: string, permissionMode?: PermissionMode) => Promise<string>
  sendMessageWithTools: (
    messages: ChatMessage[],
    onDelta: (content: string) => void,
    onToolCalls: (toolCalls: ToolCall[]) => void,
    model?: string,
    permissionMode?: PermissionMode
  ) => Promise<void>
  executeToolCall: (toolCall: ToolCall, permissionMode?: PermissionMode) => Promise<{ content: string; isError: boolean }>
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
    async (messages: ChatMessage[], onDelta: (content: string) => void, model?: string, permissionMode?: PermissionMode) => {
      if (isLoading) return

      setIsLoading(true)
      setError(null)
      onStreamStart?.()
      abortControllerRef.current = new AbortController()

      try {
        await streamChat({ messages, model, permission_mode: permissionMode }, onDelta, abortControllerRef.current.signal)
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
    async (messages: ChatMessage[], model?: string, permissionMode?: PermissionMode): Promise<string> => {
      if (isLoading) throw new Error("Another request is in progress")

      setIsLoading(true)
      setError(null)

      try {
        const response = await chat({ messages, model, permission_mode: permissionMode })
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

  const sendMessageWithTools = useCallback(
    async (
      messages: ChatMessage[],
      onDelta: (content: string) => void,
      onToolCalls: (toolCalls: ToolCall[]) => void,
      model?: string,
      permissionMode?: PermissionMode
    ) => {
      if (isLoading) return

      setIsLoading(true)
      setError(null)
      onStreamStart?.()
      abortControllerRef.current = new AbortController()

      try {
        await streamChatWithTools(
          { messages, model, enable_tools: true, permission_mode: permissionMode },
          onDelta,
          onToolCalls,
          abortControllerRef.current.signal
        )
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

  const executeToolCall = useCallback(
    async (toolCall: ToolCall, permissionMode?: PermissionMode): Promise<{ content: string; isError: boolean }> => {
      try {
        const result = await executeTool(toolCall, permissionMode)
        return { content: result.content, isError: result.is_error || false }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        let displayMessage = error.message
        if (isApiError(err) && typeof err.detail === "object" && err.detail !== null) {
          const detail = err.detail as { message?: string }
          if (detail.message) {
            displayMessage = detail.message
          }
        }
        return { content: `执行失败: ${displayMessage}`, isError: true }
      }
    },
    []
  )

  return { sendMessage, sendMessageSync, sendMessageWithTools, executeToolCall, isLoading, stop, error, clearError }
}
