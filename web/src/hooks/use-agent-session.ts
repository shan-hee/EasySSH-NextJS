import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat, type UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport, isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai"
import {
  cancelAISession,
  closeAISession,
  createAISession,
  getAISession,
  getLatestAISession,
  type AgentSessionScope,
  type CreateSessionResponse,
  type PermissionMode,
  type SessionView,
  type ToolView,
} from "@/lib/api/ai-agent"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

type TransportState = "idle" | "connecting" | "ai_sdk_ui"

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptySessionMessages(session: SessionView | null) {
  return session?.ui_messages ?? []
}

function collectApprovalIds(messages: UIMessage[]) {
  const pending = new Set<string>()
  const responded = new Set<string>()
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue
    }
    for (const part of message.parts) {
      if (isToolUIPart(part) && part.state === "approval-requested") {
        pending.add(part.approval.id)
      }
      if (isToolUIPart(part) && part.state === "approval-responded") {
        responded.add(part.approval.id)
      }
    }
  }
  return { pending, responded }
}

export function useAgentSession() {
  const [session, setSession] = useState<SessionView | null>(null)
  const [transport, setTransport] = useState<TransportState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [localErrorMessages, setLocalErrorMessages] = useState<UIMessage[]>([])

  const sessionRef = useRef<SessionView | null>(null)
  const latestRestoreAttemptedRef = useRef(false)
  const closingSessionIdRef = useRef<string | null>(null)
  const restoredMessagesSessionIdRef = useRef<string | null>(null)
  const idleChatIdRef = useRef(createLocalId("agent-chat"))

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const sessionId = session?.id ?? null
  const chatId = sessionId ?? idleChatIdRef.current

  const chatTransport = useMemo(
    () => new DefaultChatTransport<UIMessage>({
      api: sessionId ? getApiUrl(`/ai/sessions/${sessionId}/chat`) : getApiUrl("/ai/sessions/__idle__/chat"),
      headers: () => getAuthHeaders(),
    }),
    [sessionId]
  )

  const refreshSessionSnapshot = useCallback(async (targetSessionId = sessionRef.current?.id) => {
    if (!targetSessionId || closingSessionIdRef.current === targetSessionId) {
      return null
    }

    try {
      const response = await getAISession(targetSessionId)
      if (closingSessionIdRef.current === targetSessionId) {
        return null
      }
      setSession(response.session)
      setTransport("ai_sdk_ui")
      return response.session
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError)
      setError(message)
      return null
    }
  }, [])

  const chat = useChat<UIMessage>({
    id: chatId,
    messages: emptySessionMessages(session),
    transport: chatTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError(chatError) {
      setError(chatError.message)
      setTransport(sessionRef.current ? "ai_sdk_ui" : "idle")
    },
    onFinish() {
      void refreshSessionSnapshot()
    },
  })

  useEffect(() => {
    if (!session?.id) {
      restoredMessagesSessionIdRef.current = null
      return
    }

    if (restoredMessagesSessionIdRef.current === session.id) {
      return
    }

    chat.setMessages(session.ui_messages || [])
    restoredMessagesSessionIdRef.current = session.id
  }, [chat, session?.id, session?.ui_messages])

  const pushLocalError = useCallback((message: string) => {
    setError(message)
    setLocalErrorMessages((current) => [
      ...current,
      {
        id: createLocalId("error"),
        role: "assistant",
        metadata: {
          source: "local-error",
          createdAt: new Date().toISOString(),
        },
        parts: [
          {
            type: "data-error",
            id: createLocalId("error-part"),
            data: { message },
          },
        ],
      } satisfies UIMessage,
    ])
  }, [])

  const applySessionResponse = useCallback((response: CreateSessionResponse) => {
    closingSessionIdRef.current = null
    setError(null)
    setLocalErrorMessages([])
    setSession(response.session)
    setTransport("ai_sdk_ui")
    restoredMessagesSessionIdRef.current = null
    return response
  }, [])

  const restoreLatestSession = useCallback(async (scope?: AgentSessionScope) => {
    if (latestRestoreAttemptedRef.current || sessionRef.current || transport !== "idle") {
      return false
    }

    latestRestoreAttemptedRef.current = true
    setTransport("connecting")

    try {
      const response = await getLatestAISession(scope)
      if (!response) {
        setTransport("idle")
        return false
      }

      applySessionResponse(response)
      return true
    } catch (restoreError) {
      setTransport("idle")
      pushLocalError(restoreError instanceof Error ? restoreError.message : String(restoreError))
      return false
    }
  }, [applySessionResponse, pushLocalError, transport])

  const restoreSession = useCallback(async (targetSessionId: string, input: { silent?: boolean } = {}) => {
    if (!targetSessionId) {
      return false
    }

    setTransport("connecting")

    try {
      const response = await getAISession(targetSessionId)
      applySessionResponse(response)
      return true
    } catch (restoreError) {
      setTransport(sessionRef.current ? "ai_sdk_ui" : "idle")
      if (!input.silent) {
        pushLocalError(restoreError instanceof Error ? restoreError.message : String(restoreError))
      }
      return false
    }
  }, [applySessionResponse, pushLocalError])

  const startNewSession = useCallback(async (input: { model?: string; permissionMode?: PermissionMode; scope?: AgentSessionScope }) => {
    latestRestoreAttemptedRef.current = true
    setError(null)
    setLocalErrorMessages([])
    setTransport("connecting")

    const currentSession = sessionRef.current
    if (currentSession?.status === "running") {
      try {
        await cancelAISession(currentSession.id)
      } catch {
        // ignore cancellation race when starting a replacement session
      }
    }

    try {
      const response = await createAISession({
        model: input.model,
        permission_mode: input.permissionMode,
        scope: input.scope,
      })
      applySessionResponse(response)
      return response
    } catch (createError) {
      setTransport(currentSession ? "ai_sdk_ui" : "idle")
      pushLocalError(createError instanceof Error ? createError.message : String(createError))
      return null
    }
  }, [applySessionResponse, pushLocalError])

  const sendMessage = useCallback(async (
    content: string,
    contextText?: string,
    model?: string,
    permissionMode?: PermissionMode,
    scope?: AgentSessionScope
  ) => {
    const activeSessionId = sessionRef.current?.id
    const normalizedContent = content.trim()
    if (!activeSessionId || !normalizedContent) {
      return false
    }

    setError(null)
    setSession((current) => current
      ? { ...current, status: "running", updated_at: new Date().toISOString() }
      : current
    )
    setTransport("ai_sdk_ui")

    try {
      await chat.sendMessage({ text: normalizedContent }, {
        body: {
          context: contextText,
          model,
          permission_mode: permissionMode,
          scope,
        },
      })
      return true
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError)
      pushLocalError(message)
      void refreshSessionSnapshot(activeSessionId)
      return false
    }
  }, [chat, pushLocalError, refreshSessionSnapshot])

  const confirmTask = useCallback(async (taskId: string, decision: "confirm" | "reject") => {
    const activeSessionId = sessionRef.current?.id
    if (!activeSessionId || !taskId) {
      return
    }

    setError(null)
    const approvalIds = collectApprovalIds(chat.messages)
    const approved = decision === "confirm"

    try {
      if (approvalIds.pending.has(taskId)) {
        await chat.addToolApprovalResponse({
          id: taskId,
          approved,
        })
        return
      }
      if (approvalIds.responded.has(taskId)) {
        return
      }

      await chat.sendMessage(undefined, {
        body: {
          approval: {
            task_id: taskId,
            decision,
          },
        },
      })
    } catch (confirmError) {
      pushLocalError(confirmError instanceof Error ? confirmError.message : String(confirmError))
      void refreshSessionSnapshot(activeSessionId)
    }
  }, [chat, pushLocalError, refreshSessionSnapshot])

  const cancelSession = useCallback(async () => {
    const activeSessionId = sessionRef.current?.id
    if (!activeSessionId) {
      return
    }

    try {
      await chat.stop()
      await cancelAISession(activeSessionId)
      await refreshSessionSnapshot(activeSessionId)
    } catch (cancelError) {
      pushLocalError(cancelError instanceof Error ? cancelError.message : String(cancelError))
    }
  }, [chat, pushLocalError, refreshSessionSnapshot])

  const closeSession = useCallback(async () => {
    const activeSessionId = sessionRef.current?.id
    if (activeSessionId) {
      closingSessionIdRef.current = activeSessionId
      try {
        await closeAISession(activeSessionId)
      } catch {
        // ignore close errors for local detach
      }
    }

    setSession(null)
    setError(null)
    setLocalErrorMessages([])
    chat.setMessages([])
    restoredMessagesSessionIdRef.current = null
    closingSessionIdRef.current = null
    latestRestoreAttemptedRef.current = true
    setTransport("idle")
  }, [chat])

  const tasks = useMemo(
    () => [...(session?.tasks || [])].sort(
      (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    ),
    [session?.tasks]
  )
  const pendingConfirmationTasks = tasks.filter((task) => task.status === "waiting_confirm")
  const availableTools: ToolView[] = session?.available_tools || []
  const canSend = Boolean(sessionId) && session?.status === "idle" && chat.status === "ready"
  const uiMessages = [...chat.messages, ...localErrorMessages]

  return {
    session,
    sessionId,
    transport,
    chatStatus: chat.status,
    timeline: [],
    uiMessages,
    tasks,
    pendingConfirmationTasks,
    availableTools,
    error,
    canSend,
    restoreLatestSession,
    restoreSession,
    startNewSession,
    sendMessage,
    confirmTask,
    cancelSession,
    closeSession,
  }
}
