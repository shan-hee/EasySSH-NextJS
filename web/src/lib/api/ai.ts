import { apiFetch, getApiUrl, getAuthHeaders, getCsrfToken } from "@/lib/api-client"

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

/**
 * 聊天请求
 */
export interface ChatRequest {
  messages: ChatMessage[]
  model?: string
  stream?: boolean
}

/**
 * 使用统计
 */
export interface ChatUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/**
 * 聊天响应（非流式）
 */
export interface ChatResponse {
  content: string
  model?: string
  usage?: ChatUsage
}

/**
 * AI 配置状态
 */
export interface AIConfigStatus {
  configured: boolean
  provider?: string
  model?: string
  has_key?: boolean
  message?: string
}

/**
 * 流式响应事件
 */
export interface StreamEvent {
  content?: string
  done?: boolean
  error?: string
}

/**
 * AI API
 */
export const aiApi = {
  /**
   * 发送聊天请求（非流式）
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return apiFetch<ChatResponse>("/ai/chat", {
      method: "POST",
      body: { ...request, stream: false },
    })
  },

  /**
   * 发送流式聊天请求
   * @param request 聊天请求
   * @param onDelta 接收增量内容的回调
   * @param signal 可选的 AbortSignal 用于取消请求
   */
  async streamChat(
    request: ChatRequest,
    onDelta: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const url = getApiUrl("/ai/chat/stream")
    const csrfToken = getCsrfToken()
    const headers: Record<string, string> = {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    }

    // 添加 CSRF Token
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...request, stream: true }),
      credentials: "include",
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorJson.error || errorMessage
      } catch {
        // 使用默认错误消息
      }
      throw new Error(errorMessage)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")

        // 保留最后一个可能不完整的行
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue
          if (!line.startsWith("data: ")) continue

          const data = line.slice(6) // 移除 "data: " 前缀
          if (data === "[DONE]") {
            onDelta({ done: true })
            return
          }

          try {
            const event: StreamEvent = JSON.parse(data)
            onDelta(event)
            if (event.done) return
          } catch {
            // 跳过无法解析的行
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  },

  /**
   * 获取 AI 配置状态
   */
  async getConfig(): Promise<AIConfigStatus> {
    return apiFetch<AIConfigStatus>("/ai/config", {
      method: "GET",
    })
  },
}
