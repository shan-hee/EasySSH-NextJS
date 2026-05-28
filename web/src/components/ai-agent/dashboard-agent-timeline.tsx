"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { UIMessage } from "@ai-sdk/react"
import { isReasoningUIPart, isTextUIPart, isToolUIPart } from "ai"
import { ChevronDown, Loader2 } from "lucide-react"
import { useStickToBottomContext } from "use-stick-to-bottom"

import { AgentEmptyState, AgentNoticeCard } from "@/components/ai-agent/agent-notice"
import { AgentToolCallCard } from "@/components/ai-agent/agent-tool-call-card"
import { Response } from "@/components/ui/shadcn-io/ai/response"
import type { ResolvedTimelineItem } from "@/lib/ai-agent/session-state"
import { getTaskStatusLabel, type AssistantLoadingState, type TimelineTranslate } from "@/lib/ai-agent/timeline-utils"
import type { TaskView } from "@/lib/api/ai-agent"
import { cn } from "@/lib/utils"

const TASK_GROUP_PREVIEW_LIMIT = 4
const TASK_GROUP_STATUS_ORDER: TaskView["status"][] = [
  "waiting_confirm",
  "running",
  "queued",
  "failed",
  "succeeded",
  "cancelled",
]

type DashboardMessageEntry = Extract<ResolvedTimelineItem, { kind: "message" }> & {
  data: NonNullable<Extract<ResolvedTimelineItem, { kind: "message" }>["data"]>
}

type DashboardTaskEntry = Extract<ResolvedTimelineItem, { kind: "task" }> & {
  data: NonNullable<Extract<ResolvedTimelineItem, { kind: "task" }>["data"]>
  uiMessage: UIMessage
}

type DashboardErrorEntry = Extract<ResolvedTimelineItem, { kind: "error" }> & {
  data: NonNullable<Extract<ResolvedTimelineItem, { kind: "error" }>["data"]>
}

type DashboardRenderableEntry = DashboardMessageEntry | DashboardTaskEntry | DashboardErrorEntry

type DashboardTimelineBlock =
  | {
      id: string
      kind: "message"
      entry: DashboardMessageEntry
    }
  | {
      id: string
      kind: "task"
      entry: DashboardTaskEntry
    }
  | {
      id: string
      kind: "task-group"
      entries: DashboardTaskEntry[]
    }
  | {
      id: string
      kind: "error"
      entry: DashboardErrorEntry
    }

function getUIMessageText(message?: UIMessage | null) {
  if (!message) {
    return ""
  }

  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("")
}

function getUIMessageReasoning(message?: UIMessage | null) {
  if (!message) {
    return null
  }

  const reasoning = message.parts
    .filter(isReasoningUIPart)
    .map((part) => part.text)
    .join("\n")
    .trim()

  return reasoning || null
}

function getUIMessageToolStatus(message?: UIMessage | null) {
  if (!message) {
    return null
  }

  const statusPart = message.parts.find((part) => part.type === "data-tool-status")
  const data = statusPart && "data" in statusPart ? statusPart.data : null
  if (!data || typeof data !== "object") {
    return null
  }

  const text = (data as { text?: unknown }).text
  return typeof text === "string" && text.trim() ? text : null
}

function hasUIMessageToolPart(message?: UIMessage | null) {
  return Boolean(message?.parts.some(isToolUIPart))
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getRenderableEntry(entry: ResolvedTimelineItem): DashboardRenderableEntry | null {
  if (!entry.data) {
    return null
  }

  if (entry.kind === "message") {
    if (
      entry.data.role === "assistant" &&
      !getUIMessageText(entry.uiMessage).trim() &&
      !getUIMessageReasoning(entry.uiMessage) &&
      !getUIMessageToolStatus(entry.uiMessage) &&
      !hasUIMessageToolPart(entry.uiMessage)
    ) {
      return null
    }

    return entry as DashboardMessageEntry
  }

  if (entry.kind === "task") {
    if (!entry.uiMessage) {
      return null
    }

    return entry as DashboardTaskEntry
  }

  if (entry.kind === "error") {
    return entry as DashboardErrorEntry
  }

  return null
}

function groupTimelineBlocks(entries: ResolvedTimelineItem[]): DashboardTimelineBlock[] {
  const blocks: DashboardTimelineBlock[] = []
  let pendingTasks: DashboardTaskEntry[] = []

  const flushPendingTasks = () => {
    if (pendingTasks.length === 0) {
      return
    }

    if (pendingTasks.length === 1) {
      blocks.push({
        id: pendingTasks[0].id,
        kind: "task",
        entry: pendingTasks[0],
      })
    } else {
      blocks.push({
        id: `task-group:${pendingTasks[0].id}:${pendingTasks[pendingTasks.length - 1].id}`,
        kind: "task-group",
        entries: pendingTasks,
      })
    }

    pendingTasks = []
  }

  for (const entry of entries) {
    const renderableEntry = getRenderableEntry(entry)
    if (!renderableEntry) {
      continue
    }

    if (renderableEntry.kind === "task") {
      pendingTasks.push(renderableEntry)
      continue
    }

    flushPendingTasks()

    if (renderableEntry.kind === "message") {
      blocks.push({
        id: renderableEntry.id,
        kind: "message",
        entry: renderableEntry,
      })
    } else {
      blocks.push({
        id: renderableEntry.id,
        kind: "error",
        entry: renderableEntry,
      })
    }
  }

  flushPendingTasks()
  return blocks
}

function shouldKeepTaskGroupOpen(tasks: TaskView[]) {
  return tasks.some((task) => (
    task.status === "queued" ||
    task.status === "running" ||
    task.status === "waiting_confirm" ||
    task.status === "failed"
  ))
}

function getTaskDisplayName(task: TaskView) {
  return task.tool_display_name || task.tool_name
}

function TaskStatusBadge({
  status,
  tText,
  count,
}: {
  status: TaskView["status"]
  tText: TimelineTranslate
  count?: number
}) {
  return (
    <span className="shrink-0 rounded-md border border-border/60 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {getTaskStatusLabel(status, tText)}
      {count != null ? ` ${count}` : ""}
    </span>
  )
}

function TimelineMessageItem({
  entry,
  tText,
}: {
  entry: DashboardMessageEntry
  tText: TimelineTranslate
}) {
  const isUser = entry.data.role === "user"
  const parsedMessageText = getUIMessageText(entry.uiMessage)
  const messageText = isUser ? parsedMessageText || entry.data.content : parsedMessageText
  const reasoningText = getUIMessageReasoning(entry.uiMessage)
  const toolStatus = getUIMessageToolStatus(entry.uiMessage)

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <span className="px-1 text-xs text-muted-foreground">
            {formatDateTime(entry.data.created_at)}
          </span>
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 shadow-sm">
            <div className="whitespace-pre-wrap break-words text-sm leading-6">
              {messageText}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-1 py-1">
        <div className="mb-2 flex items-center gap-2 text-xs opacity-80">
          <span>{tText("exportRoleAssistant")}</span>
          <span>{formatDateTime(entry.data.created_at)}</span>
          {entry.data.pending && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              {tText("assistantReplying")}
            </span>
          )}
        </div>
        {toolStatus && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>{toolStatus}</span>
          </div>
        )}
        {reasoningText && !messageText && (
          <div className="whitespace-pre-wrap rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
            {reasoningText}
          </div>
        )}
        {messageText && (
          <Response className="text-sm leading-6 break-words [&_pre]:text-xs">
            {messageText}
          </Response>
        )}
      </div>
    </div>
  )
}

function TimelineErrorItem({
  entry,
  tText,
}: {
  entry: DashboardErrorEntry
  tText: TimelineTranslate
}) {
  return (
    <AgentNoticeCard tone="error" size="md" title={tText("eventErrorTitle")}>
      <span className="text-destructive/90">{entry.data.message}</span>
    </AgentNoticeCard>
  )
}

function TimelineTaskGroup({
  entries,
  tText,
  onConfirmTask,
}: {
  entries: DashboardTaskEntry[]
  tText: TimelineTranslate
  onConfirmTask?: (taskId: string, decision: "confirm" | "reject") => void
}) {
  const { isAtBottom, scrollToBottom, state } = useStickToBottomContext()
  const tasks = useMemo(() => entries.map((entry) => entry.data), [entries])
  const shouldStayOpen = shouldKeepTaskGroupOpen(tasks)
  const previousShouldStayOpenRef = useRef(shouldStayOpen)
  const [isOpen, setIsOpen] = useState(shouldStayOpen)
  const firstTask = tasks[0]
  const lastTask = tasks[tasks.length - 1]

  const statusCounts = useMemo(() => {
    const counts = new Map<TaskView["status"], number>()
    for (const task of tasks) {
      counts.set(task.status, (counts.get(task.status) || 0) + 1)
    }
    return counts
  }, [tasks])

  const previewTasks = tasks.slice(0, TASK_GROUP_PREVIEW_LIMIT)
  const hiddenPreviewCount = Math.max(tasks.length - previewTasks.length, 0)
  const shouldKeepConversationBottomVisible = isAtBottom || state.isNearBottom

  const syncConversationBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!shouldKeepConversationBottomVisible) {
      return
    }

    requestAnimationFrame(() => {
      void scrollToBottom(behavior)
    })
  }, [scrollToBottom, shouldKeepConversationBottomVisible])

  useEffect(() => {
    const wasStayingOpen = previousShouldStayOpenRef.current
    previousShouldStayOpenRef.current = shouldStayOpen

    let frame = 0
    if (shouldStayOpen) {
      frame = window.requestAnimationFrame(() => {
        setIsOpen(true)
      })
    } else if (wasStayingOpen) {
      frame = window.requestAnimationFrame(() => {
        setIsOpen(false)
        syncConversationBottom("instant")
      })
    }

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [shouldStayOpen, syncConversationBottom])

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/10 shadow-sm">
      <button
        type="button"
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/30",
          isOpen && "border-b border-border/50 bg-muted/20"
        )}
        onClick={() => {
          setIsOpen((value) => !value)
          syncConversationBottom("instant")
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {tText("toolCallGroupTitle", { count: tasks.length })}
            </span>
            {TASK_GROUP_STATUS_ORDER.map((status) => {
              const count = statusCounts.get(status) || 0
              if (count === 0) {
                return null
              }

              return <TaskStatusBadge key={status} status={status} tText={tText} count={count} />
            })}
            <span className="text-xs text-muted-foreground">
              {formatDateTime(firstTask.created_at)}
              {lastTask.id !== firstTask.id ? ` - ${formatDateTime(lastTask.created_at)}` : ""}
            </span>
          </div>

          {!isOpen && (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {previewTasks.map((task) => (
                <span key={task.id} className="max-w-[12rem] truncate" title={getTaskDisplayName(task)}>
                  {getTaskDisplayName(task)}
                </span>
              ))}
              {hiddenPreviewCount > 0 && (
                <span>{tText("toolCallGroupMore", { count: hiddenPreviewCount })}</span>
              )}
            </div>
          )}
        </div>

        <ChevronDown
          className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="divide-y divide-border/50">
          {entries.map((entry) => (
            <div key={entry.id} className="p-2.5">
              <AgentToolCallCard
                uiMessage={entry.uiMessage}
                tText={tText}
                onConfirmTask={onConfirmTask}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface DashboardAgentTimelineProps {
  entries: ResolvedTimelineItem[]
  tText: TimelineTranslate
  assistantLoadingState?: AssistantLoadingState
  onConfirmTask?: (taskId: string, decision: "confirm" | "reject") => void
}

export function DashboardAgentTimeline({
  entries,
  tText,
  assistantLoadingState = false,
  onConfirmTask,
}: DashboardAgentTimelineProps) {
  const blocks = useMemo(() => groupTimelineBlocks(entries), [entries])
  const isAssistantLoading = assistantLoadingState !== false
  const isThinking = assistantLoadingState === "thinking"

  if (blocks.length === 0 && !isAssistantLoading) {
    return (
      <AgentEmptyState>
        {tText("timelineEmpty")}
      </AgentEmptyState>
    )
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => {
        switch (block.kind) {
          case "message":
            return <TimelineMessageItem key={block.id} entry={block.entry} tText={tText} />
          case "task":
            return (
              <AgentToolCallCard
                key={block.id}
                uiMessage={block.entry.uiMessage}
                tText={tText}
                onConfirmTask={onConfirmTask}
              />
            )
          case "task-group":
            return (
              <TimelineTaskGroup
                key={block.id}
                entries={block.entries}
                tText={tText}
                onConfirmTask={onConfirmTask}
              />
            )
          case "error":
            return <TimelineErrorItem key={block.id} entry={block.entry} tText={tText} />
          default:
            return null
        }
      })}

      {isAssistantLoading && (
        <div className="flex justify-start">
          <div
            className="inline-flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
            aria-label={isThinking ? tText("panelThinking") : tText("loading")}
          >
            <Loader2 className="size-3.5 animate-spin" />
            {isThinking && <span>{tText("panelThinking")}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
