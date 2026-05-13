"use client"

import type { ReactNode } from "react"

import type { ResolvedTimelineItem } from "@/lib/ai-agent/session-state"
import { cn } from "@/lib/utils"

type AgentTimelineEntry<TKind extends ResolvedTimelineItem["kind"]> =
  Extract<ResolvedTimelineItem, { kind: TKind }> & {
    data: NonNullable<Extract<ResolvedTimelineItem, { kind: TKind }>["data"]>
  }

export type AgentTimelineMessageEntry = AgentTimelineEntry<"message">
export type AgentTimelineTaskEntry = AgentTimelineEntry<"task">
export type AgentTimelineConfirmationEntry = AgentTimelineEntry<"confirmation">
export type AgentTimelineErrorEntry = AgentTimelineEntry<"error">

type AgentTimelineRenderer<TEntry> = (entry: TEntry) => ReactNode

interface AgentTimelineProps {
  entries: ResolvedTimelineItem[]
  className?: string
  emptyState?: ReactNode
  renderMessage?: AgentTimelineRenderer<AgentTimelineMessageEntry>
  renderTask?: AgentTimelineRenderer<AgentTimelineTaskEntry>
  renderConfirmation?: AgentTimelineRenderer<AgentTimelineConfirmationEntry>
  renderError?: AgentTimelineRenderer<AgentTimelineErrorEntry>
}

export function AgentTimeline({
  entries,
  className,
  emptyState,
  renderMessage,
  renderTask,
  renderConfirmation,
  renderError,
}: AgentTimelineProps) {
  if (entries.length === 0) {
    return emptyState ? <>{emptyState}</> : null
  }

  return (
    <div className={cn(className)}>
      {entries.map((entry) => {
        switch (entry.kind) {
          case "message":
            if (!entry.data || !renderMessage) {
              return null
            }
            {
              const content = renderMessage(entry as AgentTimelineMessageEntry)
              if (content === null || content === undefined || content === false) {
                return null
              }
              return <div key={entry.id}>{content}</div>
            }

          case "task":
            if (!entry.data || !renderTask) {
              return null
            }
            {
              const content = renderTask(entry as AgentTimelineTaskEntry)
              if (content === null || content === undefined || content === false) {
                return null
              }
              return <div key={entry.id}>{content}</div>
            }

          case "confirmation":
            if (!entry.data || !renderConfirmation) {
              return null
            }
            {
              const content = renderConfirmation(entry as AgentTimelineConfirmationEntry)
              if (content === null || content === undefined || content === false) {
                return null
              }
              return <div key={entry.id}>{content}</div>
            }

          case "error":
            if (!entry.data || !renderError) {
              return null
            }
            {
              const content = renderError(entry as AgentTimelineErrorEntry)
              if (content === null || content === undefined || content === false) {
                return null
              }
              return <div key={entry.id}>{content}</div>
            }

          default:
            return null
        }
      })}
    </div>
  )
}
