"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { useStickToBottomContext } from "use-stick-to-bottom"

import { AgentEmptyState, AgentNoticeCard } from "@/components/ai-agent/agent-notice"
import { AgentTimeline } from "@/components/ai-agent/agent-timeline"
import type { ResolvedTimelineItem } from "@/lib/ai-agent/session-state"
import { collectAutoCollapseTaskIds, getTaskStatusLabel, type TimelineTranslate } from "@/lib/ai-agent/timeline-utils"
import type { TaskView } from "@/lib/api/ai-agent"
import { cn } from "@/lib/utils"

const TASK_OUTPUT_EXPAND_THRESHOLD = 72

function formatDateTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function TaskResultPanel({
  result,
  shouldAutoCollapse,
  tText,
  header,
  summary,
  footer,
}: {
  result: string
  shouldAutoCollapse: boolean
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
  const effectiveCollapsed = isExpandable ? isCollapsed : false
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
    <div className="mt-2 overflow-hidden rounded-lg border border-border/60 bg-muted/70">
      {(header || isExpandable) && (
        <div
          className={cn(
            "flex items-start justify-between gap-2 bg-background/60 px-2.5 py-1.5",
            showDetails && "border-b border-border/50"
          )}
        >
          <div className="min-w-0 flex-1">{header}</div>
          {isExpandable && (
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => {
                setIsCollapsed((value) => !value)
                syncConversationBottom("instant")
              }}
            >
              {effectiveCollapsed ? tText("expandTaskOutput") : tText("collapseTaskOutput")}
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
      {task.dangerous && (
        <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
          {tText("dangerousAction")}
        </span>
      )}
    </div>
  )
}

function TaskStatusFooter({
  task,
  tText,
}: {
  task: TaskView
  tText: TimelineTranslate
}) {
  return (
    <span className="rounded-md border border-border/60 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {getTaskStatusLabel(task.status, tText)}
    </span>
  )
}

function TimelineTaskCard({
  task,
  tText,
  shouldAutoCollapse,
}: {
  task: TaskView
  tText: TimelineTranslate
  shouldAutoCollapse: boolean
}) {
  const summary = task.summary && task.summary !== task.tool_display_name ? task.summary : undefined

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3 shadow-sm">
      {task.result && (
        <TaskResultPanel
          result={task.result}
          shouldAutoCollapse={shouldAutoCollapse}
          tText={tText}
          header={<TaskMetaHeader task={task} tText={tText} />}
          summary={summary}
          footer={<TaskStatusFooter task={task} tText={tText} />}
        />
      )}

      {!task.result && (
        <>
          <div className="flex items-start justify-between gap-2">
            <TaskMetaHeader task={task} tText={tText} />
          </div>

          {summary && (
            <div className="mt-2 text-sm text-foreground/90">{summary}</div>
          )}
        </>
      )}

      {task.error && (
        <AgentNoticeCard tone="error" size="md" className="mt-3">
          {task.error}
        </AgentNoticeCard>
      )}

      {!task.result && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
          <TaskStatusFooter task={task} tText={tText} />
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
  const autoCollapseTaskIds = useMemo(() => collectAutoCollapseTaskIds(entries), [entries])

  return (
    <AgentTimeline
      entries={entries}
      className="space-y-4"
      emptyState={(
        <AgentEmptyState>
          {tText("timelineEmpty")}
        </AgentEmptyState>
      )}
      renderMessage={(entry) => {
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
      }}
      renderTask={(entry) => (
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">{formatDateTime(entry.data.created_at)}</div>
          <TimelineTaskCard
            task={entry.data}
            tText={tText}
            shouldAutoCollapse={autoCollapseTaskIds.has(entry.data.id)}
          />
        </div>
      )}
      renderError={(entry) => (
        <AgentNoticeCard tone="error" size="md" title={tText("eventErrorTitle")}>
          <span className="text-destructive/90">{entry.data.message}</span>
        </AgentNoticeCard>
      )}
    />
  )
}
