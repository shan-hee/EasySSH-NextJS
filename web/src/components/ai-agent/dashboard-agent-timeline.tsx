"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { useStickToBottomContext } from "use-stick-to-bottom"

import { AgentEmptyState, AgentNoticeCard } from "@/components/ai-agent/agent-notice"
import type { ResolvedTimelineItem } from "@/lib/ai-agent/session-state"
import { getTaskStatusLabel, type TimelineTranslate } from "@/lib/ai-agent/timeline-utils"
import type { TaskView } from "@/lib/api/ai-agent"
import { cn } from "@/lib/utils"

const TASK_OUTPUT_EXPAND_THRESHOLD = 72
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
    if (entry.data.role === "assistant" && entry.data.content.trim() === "") {
      return null
    }

    return entry as DashboardMessageEntry
  }

  if (entry.kind === "task") {
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

function TaskResultPanel({
  result,
  shouldAutoCollapse,
  forceCollapsible = false,
  compact = false,
  tText,
  header,
  summary,
  footer,
}: {
  result: string
  shouldAutoCollapse: boolean
  forceCollapsible?: boolean
  compact?: boolean
  tText: TimelineTranslate
  header?: ReactNode
  summary?: string
  footer?: ReactNode
}) {
  const { isAtBottom, scrollToBottom, state } = useStickToBottomContext()
  const contentRef = useRef<HTMLPreElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const previousAutoCollapseRef = useRef(shouldAutoCollapse)
  const scrollSyncTimerRef = useRef<number | null>(null)
  const autoCollapseFrameRef = useRef<number | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(shouldAutoCollapse)
  const [isExpandable, setIsExpandable] = useState(false)
  const [detailsHeight, setDetailsHeight] = useState(0)
  const canToggle = forceCollapsible || isExpandable
  const effectiveCollapsed = canToggle ? isCollapsed : false
  const showDetails = !effectiveCollapsed

  const shouldKeepConversationBottomVisible = isAtBottom || state.isNearBottom

  const syncConversationBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!shouldKeepConversationBottomVisible) {
      return
    }

    requestAnimationFrame(() => {
      void scrollToBottom(behavior)
    })

    if (scrollSyncTimerRef.current !== null) {
      window.clearTimeout(scrollSyncTimerRef.current)
    }

    scrollSyncTimerRef.current = window.setTimeout(() => {
      void scrollToBottom("smooth")
      scrollSyncTimerRef.current = null
    }, 520)
  }, [scrollToBottom, shouldKeepConversationBottomVisible])

  useLayoutEffect(() => {
    const element = detailsRef.current
    if (!element) {
      return
    }

    const measure = () => {
      setDetailsHeight(element.scrollHeight)
    }

    measure()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [result, summary, isExpandable])

  useEffect(() => {
    const element = contentRef.current
    if (!element) {
      return
    }

    const measure = () => {
      setIsExpandable(element.scrollHeight > TASK_OUTPUT_EXPAND_THRESHOLD + 24)
    }

    measure()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [result])

  useEffect(() => {
    if (!previousAutoCollapseRef.current && shouldAutoCollapse) {
      autoCollapseFrameRef.current = window.requestAnimationFrame(() => {
        setIsCollapsed(true)
        syncConversationBottom("instant")
        autoCollapseFrameRef.current = null
      })
    }
    previousAutoCollapseRef.current = shouldAutoCollapse
  }, [shouldAutoCollapse, syncConversationBottom])

  useEffect(() => {
    return () => {
      if (autoCollapseFrameRef.current !== null) {
        window.cancelAnimationFrame(autoCollapseFrameRef.current)
      }
      if (scrollSyncTimerRef.current !== null) {
        window.clearTimeout(scrollSyncTimerRef.current)
      }
    }
  }, [])

  return (
    <div
      className={cn(
        "overflow-hidden bg-muted/70",
        compact ? "rounded-none" : "mt-2 rounded-lg border border-border/60"
      )}
    >
      {(header || canToggle) && (
        <div
          className={cn(
            "flex items-start justify-between gap-2 bg-background/60 px-2.5 py-1.5",
            showDetails && "border-b border-border/50"
          )}
        >
          {canToggle ? (
            <button
              type="button"
              aria-label={effectiveCollapsed ? tText("expandTaskOutput") : tText("collapseTaskOutput")}
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setIsCollapsed((value) => !value)
                syncConversationBottom("instant")
              }}
            >
              {header}
            </button>
          ) : (
            <div className="min-w-0 flex-1">{header}</div>
          )}
          {canToggle && (
            <button
              type="button"
              aria-label={effectiveCollapsed ? tText("expandTaskOutput") : tText("collapseTaskOutput")}
              title={effectiveCollapsed ? tText("expandTaskOutput") : tText("collapseTaskOutput")}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => {
                setIsCollapsed((value) => !value)
                syncConversationBottom("instant")
              }}
            >
              <ChevronDown className={cn("size-3.5 transition-transform duration-300", !effectiveCollapsed && "rotate-180")} />
            </button>
          )}
        </div>
      )}

      <div
        ref={detailsRef}
        className="overflow-hidden transition-[max-height,opacity] duration-500 ease-in-out"
        style={{
          maxHeight: showDetails ? `${detailsHeight}px` : "0px",
          opacity: showDetails ? 1 : 0,
        }}
      >
        {summary && (
          <div className="border-b border-border/40 px-2.5 py-1.5 text-xs leading-5 text-foreground/85">
            {summary}
          </div>
        )}

        <div
          className={cn(
            "overflow-x-auto",
            showDetails && "max-h-[35rem] overflow-y-auto scrollbar-custom"
          )}
        >
          <pre
            ref={contentRef}
            className="whitespace-pre-wrap px-2.5 py-2 text-[11px] leading-5"
          >
            {result}
          </pre>
        </div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/50 bg-background/60 px-2.5 py-1.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskMetaHeader({
  task,
  tText,
}: {
  task: TaskView
  tText: TimelineTranslate
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
      {task.tool_display_name && (
        <span
          className="min-w-0 max-w-[12rem] truncate text-xs font-medium text-foreground/90"
          title={task.tool_display_name}
        >
          {task.tool_display_name}
        </span>
      )}
      <span
        className="min-w-0 max-w-[10rem] truncate font-mono text-[10px] text-muted-foreground"
        title={task.tool_name}
      >
        {task.tool_name}
      </span>
      <TaskStatusBadge status={task.status} tText={tText} />
      {task.dangerous && (
        <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
          {tText("dangerousAction")}
        </span>
      )}
    </div>
  )
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

function TimelineTaskCard({
  task,
  tText,
  shouldAutoCollapse,
  compact = false,
}: {
  task: TaskView
  tText: TimelineTranslate
  shouldAutoCollapse: boolean
  compact?: boolean
}) {
  const summary = task.summary && task.summary !== task.tool_display_name ? task.summary : undefined

  return (
    <div
      className={cn(
        compact ? "bg-muted/10" : "rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3 shadow-sm"
      )}
    >
      {task.result && (
        <TaskResultPanel
          result={task.result}
          shouldAutoCollapse={compact ? true : shouldAutoCollapse}
          forceCollapsible={compact}
          compact={compact}
          tText={tText}
          header={<TaskMetaHeader task={task} tText={tText} />}
          summary={summary}
        />
      )}

      {!task.result && (
        <div className={cn(compact && "px-2.5 py-2")}>
          <div className="flex items-start justify-between gap-2">
            <TaskMetaHeader task={task} tText={tText} />
          </div>

          {summary && (
            <div className="mt-2 text-sm text-foreground/90">{summary}</div>
          )}
        </div>
      )}

      {task.error && (
        <AgentNoticeCard tone="error" size="md" className={cn(compact ? "mx-2.5 mb-2" : "mt-3")}>
          {task.error}
        </AgentNoticeCard>
      )}
    </div>
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

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
          isUser ? "bg-primary text-primary-foreground" : "border border-border/60 bg-muted/20"
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-xs opacity-80">
          <span>{isUser ? tText("exportRoleUser") : tText("exportRoleAssistant")}</span>
          <span>{formatDateTime(entry.data.created_at)}</span>
          {entry.data.pending && !isUser && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              {tText("assistantReplying")}
            </span>
          )}
        </div>
        <div className="whitespace-pre-wrap break-words text-sm leading-6">{entry.data.content}</div>
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
}: {
  entries: DashboardTaskEntry[]
  tText: TimelineTranslate
}) {
  const { isAtBottom, scrollToBottom, state } = useStickToBottomContext()
  const tasks = entries.map((entry) => entry.data)
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
    if (shouldStayOpen) {
      setIsOpen(true)
    } else if (previousShouldStayOpenRef.current) {
      setIsOpen(false)
      syncConversationBottom("instant")
    }

    previousShouldStayOpenRef.current = shouldStayOpen
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
            <TimelineTaskCard
              key={entry.id}
              task={entry.data}
              tText={tText}
              shouldAutoCollapse={true}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface DashboardAgentTimelineProps {
  entries: ResolvedTimelineItem[]
  tText: TimelineTranslate
}

export function DashboardAgentTimeline({ entries, tText }: DashboardAgentTimelineProps) {
  const blocks = useMemo(() => groupTimelineBlocks(entries), [entries])

  if (blocks.length === 0) {
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
              <div key={block.id} className="overflow-hidden rounded-2xl border border-border/60 bg-muted/10 shadow-sm">
                <TimelineTaskCard
                  task={block.entry.data}
                  tText={tText}
                  shouldAutoCollapse={true}
                  compact
                />
              </div>
            )
          case "task-group":
            return (
              <TimelineTaskGroup
                key={block.id}
                entries={block.entries}
                tText={tText}
              />
            )
          case "error":
            return <TimelineErrorItem key={block.id} entry={block.entry} tText={tText} />
          default:
            return null
        }
      })}
    </div>
  )
}
