import { apiFetch } from "@/lib/api-client"
import type { UIMessage } from "@ai-sdk/react"

export type PermissionMode = "readonly" | "balanced" | "privileged"
export type AgentSessionStatus = "idle" | "running" | "waiting_confirmation" | "closed"
export type AgentTaskStatus = "queued" | "waiting_confirm" | "running" | "succeeded" | "failed" | "cancelled"
export type AgentTransportType = "ai_sdk_ui"

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
  custom_title?: boolean
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

export interface AgentSessionScope {
  kind?: "global" | "terminal"
  terminal_session_id?: string
  server_id?: string
  server_name?: string
  host?: string
  port?: number
  username?: string
}

export interface SessionView {
  id: string
  model: string
  permission_mode: PermissionMode
  scope?: AgentSessionScope
  status: AgentSessionStatus
  created_at: string
  updated_at: string
  messages: MessageView[]
  tasks: TaskView[]
  ui_messages: UIMessage[]
  available_tools: ToolView[]
  default_transport: AgentTransportType
}

export interface CreateSessionInput {
  model?: string
  permission_mode?: PermissionMode
  scope?: AgentSessionScope
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

export async function listAISessions(input: {
  page?: number
  limit?: number
  q?: string
  scope?: AgentSessionScope
} = {}): Promise<ListSessionsResponse> {
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
  if (input.scope?.kind) {
    params.set("scope_kind", input.scope.kind)
  }
  if (input.scope?.terminal_session_id?.trim()) {
    params.set("terminal_session_id", input.scope.terminal_session_id.trim())
  }
  if (input.scope?.server_id?.trim()) {
    params.set("server_id", input.scope.server_id.trim())
  }
  const query = params.toString()
  return apiFetch<ListSessionsResponse>(`/ai/sessions${query ? `?${query}` : ""}`)
}

export async function getLatestAISession(scope?: AgentSessionScope): Promise<CreateSessionResponse | null> {
  const sessions = await listAISessions({ limit: 1, scope })
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
