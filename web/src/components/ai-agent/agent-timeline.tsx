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
            return <div key={entry.id}>{renderMessage(entry as AgentTimelineMessageEntry)}</div>

          case "task":
            if (!entry.data || !renderTask) {
              return null
            }
            return <div key={entry.id}>{renderTask(entry as AgentTimelineTaskEntry)}</div>

          case "confirmation":
            if (!entry.data || !renderConfirmation) {
              return null
            }
            return <div key={entry.id}>{renderConfirmation(entry as AgentTimelineConfirmationEntry)}</div>

          case "error":
            if (!entry.data || !renderError) {
              return null
            }
            return <div key={entry.id}>{renderError(entry as AgentTimelineErrorEntry)}</div>

          default:
            return null
        }
      })}
    </div>
  )
}
