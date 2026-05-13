import { apiFetch, getApiUrl, getAuthHeaders } from "@/lib/api-client"
import { createAuthTicket } from "@/lib/auth-ticket"
import { getWsUrl } from "@/lib/config"

export type PermissionMode = "readonly" | "balanced" | "privileged"
export type AgentSessionStatus = "idle" | "running" | "waiting_confirmation" | "closed"
export type AgentTaskStatus = "queued" | "waiting_confirm" | "running" | "succeeded" | "failed" | "cancelled"
export type AgentTransportType = "ws" | "sse"
export type AIEventType =
  | "session.started"
  | "assistant.delta"
  | "assistant.completed"
  | "task.created"
  | "task.updated"
  | "confirmation.requested"
  | "confirmation.resolved"
  | "error"
  | "session.completed"

export interface ToolView {
  name: string
  display_name?: string
  description: string
  dangerous: boolean
}

export interface MessageView {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  created_at: string
}

export interface TaskView {
  id: string
  tool_call_id: string
  tool_name: string
  tool_display_name?: string
  summary?: string
  status: AgentTaskStatus
  dangerous: boolean
  requires_confirmation: boolean
  arguments?: Record<string, unknown>
  result?: string
  error?: string
  created_at: string
  updated_at: string
  custom_title: boolean
}

export interface AssistantEventData {
  message_id: string
  delta?: string
  content?: string
}

export interface ConfirmationView {
  task_id: string
  status: string
  decision?: string
  created_at: string
}

export interface ErrorView {
  code: string
  message: string
}

export interface SessionListItem {
  id: string
  model: string
  permission_mode: PermissionMode
  status: AgentSessionStatus
  title: string
  custom_title: boolean
  message_count: number
  task_count: number
  created_at: string
  updated_at: string
}

export interface SessionView {
  id: string
  model: string
  permission_mode: PermissionMode
  status: AgentSessionStatus
  created_at: string
  updated_at: string
  messages: MessageView[]
  tasks: TaskView[]
  available_tools: ToolView[]
  default_transport: AgentTransportType
}

export interface AIEvent {
  id: string
  type: AIEventType
  session_id: string
  created_at: string
  session?: SessionView
  assistant?: AssistantEventData
  task?: TaskView
  confirmation?: ConfirmationView
  error?: ErrorView
}

export interface CreateSessionInput {
  model?: string
  permission_mode?: PermissionMode
}

export interface CreateSessionResponse {
  session_id: string
  session: SessionView
  default_transport: AgentTransportType
}

export interface ListSessionsResponse {
  items: SessionListItem[]
  total: number
}

export interface SendSessionMessageInput {
  content: string
  context?: string
  model?: string
  permission_mode?: PermissionMode
}

export interface ConfirmTaskInput {
  decision: "confirm" | "reject"
}

export async function listAISessions(input: { page?: number; limit?: number; q?: string } = {}): Promise<ListSessionsResponse> {
  const params = new URLSearchParams()
  if (input.page) {
    params.set("page", String(input.page))
  }
  if (input.limit) {
    params.set("limit", String(input.limit))
  }
  if (input.q?.trim()) {
    params.set("q", input.q.trim())
  }
  const query = params.toString()
  return apiFetch<ListSessionsResponse>(`/ai/sessions${query ? `?${query}` : ""}`)
}

export async function getLatestAISession(): Promise<CreateSessionResponse | null> {
  const sessions = await listAISessions({ limit: 1 })
  const latest = sessions.items[0]
  if (!latest) {
    return null
  }
  return getAISession(latest.id)
}

export async function getAISession(sessionId: string): Promise<CreateSessionResponse> {
  return apiFetch<CreateSessionResponse>(`/ai/sessions/${sessionId}`)
}

export async function createAISession(input: CreateSessionInput): Promise<CreateSessionResponse> {
  return apiFetch<CreateSessionResponse>("/ai/sessions", {
    method: "POST",
    body: input,
  })
}

export async function sendAISessionMessage(sessionId: string, input: SendSessionMessageInput): Promise<void> {
  await apiFetch<{ accepted: boolean }>(`/ai/sessions/${sessionId}/messages`, {
    method: "POST",
    body: input,
  })
}

export async function confirmAISessionTask(sessionId: string, taskId: string, input: ConfirmTaskInput): Promise<void> {
  await apiFetch<{ accepted: boolean }>(`/ai/sessions/${sessionId}/tasks/${taskId}/confirm`, {
    method: "POST",
    body: input,
  })
}

export async function cancelAISession(sessionId: string): Promise<void> {
  await apiFetch<{ cancelled: boolean }>(`/ai/sessions/${sessionId}/cancel`, {
    method: "POST",
  })
}

export async function renameAISession(sessionId: string, title: string): Promise<void> {
  await apiFetch<{ updated: boolean }>(`/ai/sessions/${sessionId}`, {
    method: "PATCH",
    body: { title },
  })
}

export async function deleteAISession(sessionId: string): Promise<void> {
  await apiFetch<string>(`/ai/sessions/${sessionId}`, {
    method: "DELETE",
  })
}

export async function closeAISession(sessionId: string): Promise<void> {
  await deleteAISession(sessionId)
}

export interface SessionEventStreamHandlers {
  onEvent: (event: AIEvent) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

export function openAISessionEventStream(sessionId: string, handlers: SessionEventStreamHandlers): AbortController {
  const controller = new AbortController()
  const url = getApiUrl(`/ai/sessions/${sessionId}/events`)
  const headers = getAuthHeaders()

  void fetch(url, {
    headers,
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
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
          if (done) {
            handlers.onDone?.()
            return
          }

          buffer += decoder.decode(value, { stream: true })

          const chunks = buffer.split("\n\n")
          buffer = chunks.pop() || ""

          for (const chunk of chunks) {
            const lines = chunk.split("\n")
            let payload = ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                payload += line.slice(6)
              }
            }

            if (!payload) {
              continue
            }

            const event = JSON.parse(payload) as AIEvent
            handlers.onEvent(event)
          }
        }
      } finally {
        try {
          await reader.cancel()
        } catch {
          // ignore
        }
        reader.releaseLock()
      }
    })
    .catch((error) => {
      if (error instanceof Error && error.name === "AbortError") {
        return
      }
      handlers.onError?.(error instanceof Error ? error : new Error(String(error)))
    })

  return controller
}

export interface SessionWebSocketHandlers {
  onEvent: (event: AIEvent) => void
  onError?: (error: Error) => void
  onClose?: () => void
}

export interface SessionWebSocketConnection {
  sendUserMessage: (input: SendSessionMessageInput) => void
  confirmTask: (taskId: string, decision: ConfirmTaskInput["decision"]) => void
  cancelSession: () => void
  ping: () => void
  close: () => void
}

export async function connectAISessionWebSocket(
  sessionId: string,
  handlers: SessionWebSocketHandlers
): Promise<SessionWebSocketConnection> {
  const { ticket } = await createAuthTicket({
    type: "ws_ai_session",
    session_id: sessionId,
  })

  const wsUrl = getWsUrl(`/api/v1/ai/sessions/${sessionId}/ws?ticket=${encodeURIComponent(ticket)}`)

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl)
    let settled = false
    let closedManually = false
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      socket.close()
      reject(new Error("WebSocket 连接超时"))
    }, 5000)

    socket.onopen = () => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeoutId)

      resolve({
        sendUserMessage(input) {
          socket.send(
            JSON.stringify({
              type: "user.message",
              content: input.content,
              context: input.context,
              model: input.model,
              permission_mode: input.permission_mode,
            })
          )
        },
        confirmTask(taskId, decision) {
          socket.send(
            JSON.stringify({
              type: "task.confirm",
              task_id: taskId,
              decision,
            })
          )
        },
        cancelSession() {
          socket.send(JSON.stringify({ type: "session.cancel" }))
        },
        ping() {
          socket.send(JSON.stringify({ type: "ping" }))
        },
        close() {
          closedManually = true
          socket.close()
        },
      })
    }

    socket.onerror = () => {
      const error = new Error("WebSocket 连接失败")
      if (!settled) {
        settled = true
        window.clearTimeout(timeoutId)
        reject(error)
        return
      }
      handlers.onError?.(error)
    }

    socket.onclose = () => {
      window.clearTimeout(timeoutId)
      if (!settled) {
        settled = true
        reject(new Error("WebSocket 连接已关闭"))
        return
      }
      if (!closedManually) {
        handlers.onClose?.()
      }
    }

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as AIEvent
        handlers.onEvent(event)
      } catch (error) {
        handlers.onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }
  })
}
