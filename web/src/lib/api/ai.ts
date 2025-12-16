import { apiFetch, getApiUrl, getAuthHeaders, getCsrfToken } from "@/lib/api-client"

// ========== 类型定义 ==========

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  model?: string
}

export interface ChatUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatResponse {
  content: string
  model?: string
  usage?: ChatUsage
}

export interface AIConfigStatus {
  configured: boolean
  provider?: string
  model?: string
  models?: string[] // 可用的模型列表
  has_key?: boolean
  message?: string
}

interface StreamEvent {
  content?: string
  done?: boolean
  error?: string
}

// ========== API 实现 ==========

/**
 * 发送非流式聊天请求
 */
export async function chat(request: ChatRequest): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/ai/chat", {
    method: "POST",
    body: { ...request, stream: false },
  })
}

/**
 * 发送流式聊天请求
 */
export async function streamChat(
  request: ChatRequest,
  onDelta: (content: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = getApiUrl("/ai/chat/stream")
  const csrfToken = getCsrfToken()

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  }
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
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.trim() || !line.startsWith("data: ")) continue

        const data = line.slice(6)
        if (data === "[DONE]") return

        try {
          const event: StreamEvent = JSON.parse(data)
          if (event.error) throw new Error(event.error)
          if (event.content) onDelta(event.content)
          if (event.done) return
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }
  } finally {
    // 主动取消读取，确保 SSE 连接尽快释放（尤其是我们在收到 done 后提前 return 的情况）
    try {
      await reader.cancel()
    } catch {
      // ignore
    }
    reader.releaseLock()
  }
}

/**
 * 获取 AI 配置状态
 */
export async function getAIConfig(): Promise<AIConfigStatus> {
  return apiFetch<AIConfigStatus>("/ai/config", { method: "GET" })
}
