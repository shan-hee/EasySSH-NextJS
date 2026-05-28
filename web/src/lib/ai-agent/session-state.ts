import type {
  AIEvent,
  ConfirmationView,
  ErrorView,
  MessageView,
  SessionView,
  TaskView,
} from "@/lib/api/ai-agent"
import {
  messageToAIUIMessage,
  taskToAIUIMessage,
  type AgentUIMessage,
} from "@/lib/ai-agent/ai-sdk-ui"

export type TransportState = "idle" | "connecting_ws" | "ws" | "sse"

export type TimelineItem =
  | {
      id: string
      kind: "message"
      messageId: string
      createdAt: string
    }
  | {
      id: string
      kind: "task"
      taskId: string
      createdAt: string
    }
  | {
      id: string
      kind: "confirmation"
      confirmationKey: string
      createdAt: string
    }
  | {
      id: string
      kind: "error"
      errorKey: string
      createdAt: string
    }

export interface TimelineMessage extends MessageView {
  pending?: boolean
}

export interface TimelineConfirmation extends ConfirmationView {
  key: string
}

export interface TimelineError extends ErrorView {
  key: string
  created_at: string
}

export type ResolvedTimelineItem =
  | {
      id: string
      kind: "message"
      createdAt: string
      data?: TimelineMessage
      uiMessage?: AgentUIMessage | null
    }
  | {
      id: string
      kind: "task"
      createdAt: string
      data?: TaskView
      uiMessage?: AgentUIMessage
    }
  | {
      id: string
      kind: "confirmation"
      createdAt: string
      data?: TimelineConfirmation
      uiMessage?: undefined
    }
  | {
      id: string
      kind: "error"
      createdAt: string
      data?: TimelineError
      uiMessage?: undefined
    }

export interface AgentSessionState {
  session: SessionView | null
  transport: TransportState
  messagesById: Record<string, TimelineMessage>
  tasksById: Record<string, TaskView>
  confirmationsByKey: Record<string, TimelineConfirmation>
  errorsByKey: Record<string, TimelineError>
  timeline: TimelineItem[]
  error: string | null
}

export type AgentSessionAction =
  | { type: "reset" }
  | { type: "transport"; transport: TransportState }
  | { type: "event"; event: AIEvent }
  | { type: "local.user"; message: TimelineMessage }
  | { type: "local.error"; error: TimelineError }

export const initialAgentSessionState: AgentSessionState = {
  session: null,
  transport: "idle",
  messagesById: {},
  tasksById: {},
  confirmationsByKey: {},
  errorsByKey: {},
  timeline: [],
  error: null,
}

function assertNever(value: never): never {
  throw new Error(`Unhandled timeline item: ${JSON.stringify(value)}`)
}

function patchSession(
  session: SessionView | null,
  patch: Partial<SessionView>
): SessionView | null {
  if (!session) {
    return session
  }

  return {
    ...session,
    ...patch,
  }
}

function upsertTimelineItem(items: TimelineItem[], item: TimelineItem) {
  const index = items.findIndex((entry) => entry.id === item.id)
  if (index === -1) {
    return [...items, item]
  }

  const next = [...items]
  next[index] = item
  return next
}

function applySessionSnapshot(
  state: AgentSessionState,
  snapshot: SessionView,
  includeUserMessages: boolean
): AgentSessionState {
  let next: AgentSessionState = {
    ...state,
    session: snapshot,
  }

  const messagesById = { ...next.messagesById }
  let timeline = next.timeline

  for (const message of snapshot.messages) {
    if (!includeUserMessages && message.role === "user") {
      continue
    }

    messagesById[message.id] = {
      ...message,
      pending: false,
    }
    timeline = upsertTimelineItem(timeline, {
      id: `message:${message.id}`,
      kind: "message",
      messageId: message.id,
      createdAt: message.created_at,
    })
  }

  const tasksById = { ...next.tasksById }
  for (const task of snapshot.tasks) {
    tasksById[task.id] = task
    timeline = upsertTimelineItem(timeline, {
      id: `task:${task.id}`,
      kind: "task",
      taskId: task.id,
      createdAt: task.created_at,
    })
  }

  next = {
    ...next,
    messagesById,
    tasksById,
    timeline,
  }

  return next
}

function applyEvent(state: AgentSessionState, event: AIEvent): AgentSessionState {
  switch (event.type) {
    case "session.started": {
      if (!event.session) {
        return state
      }

      return applySessionSnapshot(state, event.session, state.timeline.length === 0)
    }

    case "assistant.delta": {
      if (!event.assistant) {
        return state
      }

      const existing = state.messagesById[event.assistant.message_id]
      const nextMessage: TimelineMessage = existing
        ? {
            ...existing,
            content: existing.content + (event.assistant.delta || ""),
            pending: true,
          }
        : {
            id: event.assistant.message_id,
            role: "assistant",
            content: event.assistant.delta || "",
            created_at: event.created_at,
            pending: true,
          }

      return {
        ...state,
        session: patchSession(state.session, {
          status: "running",
          updated_at: event.created_at,
        }),
        messagesById: {
          ...state.messagesById,
          [nextMessage.id]: nextMessage,
        },
        timeline: upsertTimelineItem(state.timeline, {
          id: `message:${nextMessage.id}`,
          kind: "message",
          messageId: nextMessage.id,
          createdAt: nextMessage.created_at,
        }),
      }
    }

    case "assistant.completed": {
      if (!event.assistant) {
        return state
      }

      const existing = state.messagesById[event.assistant.message_id]
      const nextMessage: TimelineMessage = existing
        ? {
            ...existing,
            content: event.assistant.content ?? existing.content,
            pending: false,
          }
        : {
            id: event.assistant.message_id,
            role: "assistant",
            content: event.assistant.content || "",
            created_at: event.created_at,
            pending: false,
          }

      return {
        ...state,
        session: patchSession(state.session, {
          status: "running",
          updated_at: event.created_at,
        }),
        messagesById: {
          ...state.messagesById,
          [nextMessage.id]: nextMessage,
        },
        timeline: upsertTimelineItem(state.timeline, {
          id: `message:${nextMessage.id}`,
          kind: "message",
          messageId: nextMessage.id,
          createdAt: nextMessage.created_at,
        }),
      }
    }

    case "task.created":
    case "task.updated": {
      if (!event.task) {
        return state
      }

      return {
        ...state,
        session: patchSession(state.session, {
          status: event.task.status === "waiting_confirm" ? "waiting_confirmation" : "running",
          updated_at: event.task.updated_at,
        }),
        tasksById: {
          ...state.tasksById,
          [event.task.id]: event.task,
        },
        timeline: upsertTimelineItem(state.timeline, {
          id: `task:${event.task.id}`,
          kind: "task",
          taskId: event.task.id,
          createdAt: event.task.created_at,
        }),
      }
    }

    case "confirmation.requested":
    case "confirmation.resolved": {
      if (!event.confirmation) {
        return state
      }

      const confirmationKey = `${event.type}:${event.confirmation.task_id}`
      return {
        ...state,
        session:
          event.type === "confirmation.requested"
            ? patchSession(state.session, {
                status: "waiting_confirmation",
                updated_at: event.confirmation.created_at,
              })
            : event.confirmation.decision === "confirm"
              ? patchSession(state.session, {
                  status: "running",
                  updated_at: event.confirmation.created_at,
                })
              : patchSession(state.session, {
                  updated_at: event.confirmation.created_at,
                }),
        confirmationsByKey: {
          ...state.confirmationsByKey,
          [confirmationKey]: {
            ...event.confirmation,
            key: confirmationKey,
          },
        },
        timeline: upsertTimelineItem(state.timeline, {
          id: `confirmation:${confirmationKey}`,
          kind: "confirmation",
          confirmationKey,
          createdAt: event.confirmation.created_at,
        }),
      }
    }

    case "error": {
      if (!event.error) {
        return state
      }

      const errorKey = event.id || `error:${event.created_at}`
      return {
        ...state,
        errorsByKey: {
          ...state.errorsByKey,
          [errorKey]: {
            ...event.error,
            key: errorKey,
            created_at: event.created_at,
          },
        },
        timeline: upsertTimelineItem(state.timeline, {
          id: `error:${errorKey}`,
          kind: "error",
          errorKey,
          createdAt: event.created_at,
        }),
        error: event.error.message,
      }
    }

    case "session.completed": {
      if (!event.session) {
        return state
      }

      return applySessionSnapshot(
        {
          ...state,
          error: state.error,
        },
        event.session,
        false
      )
    }

    default:
      return state
  }
}

export function agentSessionReducer(state: AgentSessionState, action: AgentSessionAction): AgentSessionState {
  switch (action.type) {
    case "reset":
      return initialAgentSessionState
    case "transport":
      return {
        ...state,
        transport: action.transport,
      }
    case "event":
      return applyEvent(state, action.event)
    case "local.user":
      return {
        ...state,
        error: null,
        session: patchSession(state.session, {
          status: "running",
          updated_at: action.message.created_at,
        }),
        messagesById: {
          ...state.messagesById,
          [action.message.id]: action.message,
        },
        timeline: upsertTimelineItem(state.timeline, {
          id: `message:${action.message.id}`,
          kind: "message",
          messageId: action.message.id,
          createdAt: action.message.created_at,
        }),
      }
    case "local.error":
      return {
        ...state,
        error: action.error.message,
        errorsByKey: {
          ...state.errorsByKey,
          [action.error.key]: action.error,
        },
        timeline: upsertTimelineItem(state.timeline, {
          id: `error:${action.error.key}`,
          kind: "error",
          errorKey: action.error.key,
          createdAt: action.error.created_at,
        }),
      }
    default:
      return state
  }
}

export function resolveTimelineItems(state: AgentSessionState): ResolvedTimelineItem[] {
  return state.timeline.map((item) => {
    switch (item.kind) {
      case "message":
        {
          const message = state.messagesById[item.messageId]
          return {
            id: item.id,
            kind: item.kind,
            createdAt: item.createdAt,
            data: message,
            uiMessage: message ? messageToAIUIMessage(message) : null,
          }
        }
      case "task":
        {
          const task = state.tasksById[item.taskId]
          return {
            id: item.id,
            kind: item.kind,
            createdAt: item.createdAt,
            data: task,
            uiMessage: task ? taskToAIUIMessage(task) : undefined,
          }
        }
      case "confirmation":
        return {
          id: item.id,
          kind: item.kind,
          createdAt: item.createdAt,
          data: state.confirmationsByKey[item.confirmationKey],
        }
      case "error":
        return {
          id: item.id,
          kind: item.kind,
          createdAt: item.createdAt,
          data: state.errorsByKey[item.errorKey],
        }
      default:
        return assertNever(item)
    }
  })
}
