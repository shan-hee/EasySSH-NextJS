import { useCallback, useEffect, useReducer, useRef } from "react"
import {
  cancelAISession,
  closeAISession,
  confirmAISessionTask,
  connectAISessionWebSocket,
  createAISession,
  getAISession,
  getLatestAISession,
  openAISessionEventStream,
  sendAISessionMessage,
  type CreateSessionResponse,
  type PermissionMode,
  type SessionView,
  type SessionWebSocketConnection,
  type ToolView,
} from "@/lib/api/ai-agent"
import {
  agentSessionReducer,
  initialAgentSessionState,
  resolveTimelineItems,
} from "@/lib/ai-agent/session-state"

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAgentSession() {
  const [state, dispatch] = useReducer(agentSessionReducer, initialAgentSessionState)

  const currentSessionIdRef = useRef<string | null>(null)
  const wsConnectionRef = useRef<SessionWebSocketConnection | null>(null)
  const sseAbortControllerRef = useRef<AbortController | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const closingSessionIdRef = useRef<string | null>(null)
  const latestRestoreAttemptedRef = useRef(false)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const stopHeartbeat = useCallback(() => {
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }
  }, [])

  const cleanupTransport = useCallback(() => {
    stopHeartbeat()
    wsConnectionRef.current?.close()
    wsConnectionRef.current = null
    sseAbortControllerRef.current?.abort()
    sseAbortControllerRef.current = null
  }, [stopHeartbeat])

  const pushLocalError = useCallback((message: string, code: string = "client_error") => {
    dispatch({
      type: "local.error",
      error: {
        key: createLocalId("error"),
        code,
        message,
        created_at: new Date().toISOString(),
      },
    })
  }, [])

  const startSSEFallback = useCallback(
    (sessionId: string) => {
      if (currentSessionIdRef.current !== sessionId) {
        return
      }

      stopHeartbeat()
      wsConnectionRef.current = null
      dispatch({ type: "transport", transport: "sse" })
      sseAbortControllerRef.current?.abort()
      sseAbortControllerRef.current = openAISessionEventStream(sessionId, {
        onEvent(event) {
          dispatch({ type: "event", event })
        },
        onError(error) {
          pushLocalError(error.message, "sse_error")
        },
      })
    },
    [pushLocalError, stopHeartbeat]
  )

  const connectTransport = useCallback(
    async (sessionId: string, preferredTransport: SessionView["default_transport"]) => {
      if (preferredTransport !== "ws") {
        startSSEFallback(sessionId)
        return
      }

      dispatch({ type: "transport", transport: "connecting_ws" })

      try {
        const connection = await connectAISessionWebSocket(sessionId, {
          onEvent(event) {
            dispatch({ type: "event", event })
          },
          onError(error) {
            pushLocalError(error.message, "ws_error")
          },
          onClose() {
            if (currentSessionIdRef.current !== sessionId) {
              return
            }
            if (closingSessionIdRef.current === sessionId) {
              return
            }
            if (stateRef.current.session?.status === "closed") {
              return
            }
            startSSEFallback(sessionId)
          },
        })

        if (currentSessionIdRef.current !== sessionId) {
          connection.close()
          return
        }

        wsConnectionRef.current = connection
        dispatch({ type: "transport", transport: "ws" })

        stopHeartbeat()
        pingTimerRef.current = window.setInterval(() => {
          wsConnectionRef.current?.ping()
        }, 20000)
      } catch {
        startSSEFallback(sessionId)
      }
    },
    [pushLocalError, startSSEFallback, stopHeartbeat]
  )

  const closeCurrentRemoteSession = useCallback(async () => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId) {
      return
    }

    closingSessionIdRef.current = sessionId

    try {
      if (wsConnectionRef.current) {
        wsConnectionRef.current.cancelSession()
      }
    } catch {
      // ignore
    }

    try {
      await closeAISession(sessionId)
    } catch {
      // ignore
    }
  }, [])

  const detachCurrentSession = useCallback(async () => {
    const sessionId = currentSessionIdRef.current
    const shouldCancelRunningSession = stateRef.current.session?.status === "running"

    if (sessionId && shouldCancelRunningSession) {
      try {
        await cancelAISession(sessionId)
      } catch {
        // ignore
      }
    }

    currentSessionIdRef.current = null
    closingSessionIdRef.current = sessionId
    cleanupTransport()
    closingSessionIdRef.current = null
  }, [cleanupTransport])


  const applyRestoredSession = useCallback(
    async (response: CreateSessionResponse) => {
      cleanupTransport()
      currentSessionIdRef.current = response.session_id
      closingSessionIdRef.current = null
      dispatch({ type: "reset" })
      dispatch({
        type: "event",
        event: {
          id: createLocalId("restore"),
          type: "session.started",
          session_id: response.session_id,
          created_at: new Date().toISOString(),
          session: response.session,
        },
      })

      await connectTransport(response.session_id, response.default_transport)
      return true
    },
    [cleanupTransport, connectTransport]
  )

  const restoreLatestSession = useCallback(async () => {
    if (latestRestoreAttemptedRef.current || currentSessionIdRef.current || stateRef.current.transport !== "idle") {
      return false
    }

    latestRestoreAttemptedRef.current = true
    dispatch({ type: "transport", transport: "connecting_ws" })

    try {
      const response = await getLatestAISession()
      if (!response) {
        dispatch({ type: "transport", transport: "idle" })
        return false
      }

      return await applyRestoredSession(response)
    } catch (error) {
      dispatch({ type: "transport", transport: "idle" })
      pushLocalError(error instanceof Error ? error.message : String(error), "restore_session_failed")
      return false
    }
  }, [applyRestoredSession, pushLocalError])

  const restoreSession = useCallback(
    async (sessionId: string) => {
      if (!sessionId) {
        return false
      }

      dispatch({ type: "transport", transport: "connecting_ws" })

      try {
        const response = await getAISession(sessionId)
        return await applyRestoredSession(response)
      } catch (error) {
        dispatch({ type: "transport", transport: "idle" })
        pushLocalError(error instanceof Error ? error.message : String(error), "restore_session_failed")
        return false
      }
    },
    [applyRestoredSession, pushLocalError]
  )

  const startNewSession = useCallback(
    async (input: { model?: string; permissionMode?: PermissionMode }) => {
      await detachCurrentSession()

      latestRestoreAttemptedRef.current = true
      dispatch({ type: "reset" })
      dispatch({ type: "transport", transport: "connecting_ws" })

      try {
        const response = await createAISession({
          model: input.model,
          permission_mode: input.permissionMode,
        })

        currentSessionIdRef.current = response.session_id
        dispatch({
          type: "event",
          event: {
            id: createLocalId("bootstrap"),
            type: "session.started",
            session_id: response.session_id,
            created_at: new Date().toISOString(),
            session: response.session,
          },
        })

        await connectTransport(response.session_id, response.default_transport)
        return response
      } catch (error) {
        dispatch({ type: "transport", transport: "idle" })
        pushLocalError(error instanceof Error ? error.message : String(error), "create_session_failed")
        return null
      }
    },
    [connectTransport, detachCurrentSession, pushLocalError]
  )

  const sendMessage = useCallback(
    async (content: string, contextText?: string, model?: string, permissionMode?: PermissionMode) => {
      const sessionId = currentSessionIdRef.current
      if (!sessionId) {
        return false
      }

      const normalizedContent = content.trim()
      if (!normalizedContent) {
        return false
      }

      dispatch({
        type: "local.user",
        message: {
          id: createLocalId("user"),
          role: "user",
          content: normalizedContent,
          created_at: new Date().toISOString(),
          pending: false,
        },
      })

      try {
        if (wsConnectionRef.current) {
          wsConnectionRef.current.sendUserMessage({
            content: normalizedContent,
            context: contextText,
            model,
            permission_mode: permissionMode,
          })
          return true
        }

        await sendAISessionMessage(sessionId, {
          content: normalizedContent,
          context: contextText,
          model,
          permission_mode: permissionMode,
        })
        return true
      } catch (error) {
        pushLocalError(error instanceof Error ? error.message : String(error), "send_message_failed")
        return false
      }
    },
    [pushLocalError]
  )

  const confirmTask = useCallback(
    async (taskId: string, decision: "confirm" | "reject") => {
      const sessionId = currentSessionIdRef.current
      if (!sessionId) {
        return
      }

      try {
        if (wsConnectionRef.current) {
          wsConnectionRef.current.confirmTask(taskId, decision)
          return
        }

        await confirmAISessionTask(sessionId, taskId, { decision })
      } catch (error) {
        pushLocalError(error instanceof Error ? error.message : String(error), "confirm_task_failed")
      }
    },
    [pushLocalError]
  )

  const cancelSession = useCallback(async () => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId) {
      return
    }

    closingSessionIdRef.current = sessionId

    try {
      if (wsConnectionRef.current) {
        wsConnectionRef.current.cancelSession()
        return
      }

      await cancelAISession(sessionId)
    } catch (error) {
      pushLocalError(error instanceof Error ? error.message : String(error), "cancel_session_failed")
    }
  }, [pushLocalError])

  const closeSession = useCallback(async () => {
    await closeCurrentRemoteSession()
    cleanupTransport()
    currentSessionIdRef.current = null
    closingSessionIdRef.current = null
    latestRestoreAttemptedRef.current = true
    dispatch({ type: "reset" })
  }, [cleanupTransport, closeCurrentRemoteSession])

  useEffect(() => {
    return () => {
      cleanupTransport()
    }
  }, [cleanupTransport])

  const timelineEntries = resolveTimelineItems(state)

  const tasks = Object.values(state.tasksById).sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  )

  const pendingConfirmationTasks = tasks.filter((task) => task.status === "waiting_confirm")
  const availableTools: ToolView[] = state.session?.available_tools || []
  const sessionId = state.session?.id ?? null
  const canSend = Boolean(sessionId) && state.session?.status === "idle"

  return {
    session: state.session,
    sessionId,
    transport: state.transport,
    timeline: timelineEntries,
    tasks,
    pendingConfirmationTasks,
    availableTools,
    error: state.error,
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
