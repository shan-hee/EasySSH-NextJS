"use client"

import { useMemo, useState, type ReactNode } from "react"
import type { UIMessage } from "@ai-sdk/react"
import {
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai"
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  TerminalSquare,
  Wrench,
  XCircle,
} from "lucide-react"

import { AgentNoticeCard } from "@/components/ai-agent/agent-notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getTaskStatusLabel, type TimelineTranslate } from "@/lib/ai-agent/timeline-utils"
import type { AgentTaskStatus } from "@/lib/api/ai-agent"
import { cn } from "@/lib/utils"

type ToolPartState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied"

interface AgentToolCallCardProps {
  uiMessage: UIMessage
  tText: TimelineTranslate
  onConfirmTask?: (taskId: string, decision: "confirm" | "reject") => void
  compact?: boolean
  className?: string
}

type AgentToolMetadata = {
  taskId?: string
  taskStatus?: unknown
  dangerous?: boolean
  requiresConfirmation?: boolean
  displayName?: string
  summary?: string
}

type AgentToolUIPart = DynamicToolUIPart | ToolUIPart

function getFallbackPartState(status: AgentTaskStatus): ToolPartState {
  switch (status) {
    case "waiting_confirm":
      return "approval-requested"
    case "succeeded":
      return "output-available"
    case "failed":
      return "output-error"
    case "cancelled":
      return "output-denied"
    case "queued":
    case "running":
    default:
      return "input-available"
  }
}

function getToolPart(message: UIMessage): AgentToolUIPart | null {
  return message.parts.find(isToolUIPart) || null
}

function getMetadata(message: UIMessage): AgentToolMetadata {
  return message.metadata && typeof message.metadata === "object"
    ? message.metadata as AgentToolMetadata
    : {}
}

function normalizeTaskStatus(value: unknown): AgentTaskStatus {
  switch (value) {
    case "queued":
    case "waiting_confirm":
    case "running":
    case "succeeded":
    case "failed":
    case "cancelled":
      return value
    default:
      return "queued"
  }
}

function getMetadataString(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function formatPartValue(value: unknown) {
  if (value == null) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getPartInputText(part: AgentToolUIPart | null) {
  if (!part || !("input" in part)) {
    return ""
  }

  return formatPartValue(part.input)
}

function getPartOutputText(part: AgentToolUIPart | null) {
  if (!part || part.state !== "output-available") {
    return ""
  }

  return formatPartValue(part.output)
}

function getPartErrorText(part: AgentToolUIPart | null) {
  if (!part || part.state !== "output-error") {
    return ""
  }

  return part.errorText
}

function getApprovalTaskId(part: AgentToolUIPart | null, metadata: AgentToolMetadata) {
  if (!part) {
    return getMetadataString(metadata.taskId) || ""
  }

  if ("approval" in part && part.approval?.id) {
    return part.approval.id
  }

  return getMetadataString(metadata.taskId) || ""
}

function getStateTone(state: ToolPartState) {
  switch (state) {
    case "output-available":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "output-error":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    case "output-denied":
      return "border-muted-foreground/30 bg-muted text-muted-foreground"
    case "approval-requested":
    case "approval-responded":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    case "input-streaming":
    case "input-available":
    default:
      return "border-primary/30 bg-primary/10 text-primary"
  }
}

function getStateIcon(state: ToolPartState) {
  switch (state) {
    case "output-available":
      return <CheckCircle2 className="size-3.5" />
    case "output-error":
      return <XCircle className="size-3.5" />
    case "output-denied":
      return <XCircle className="size-3.5" />
    case "approval-requested":
    case "approval-responded":
      return <AlertTriangle className="size-3.5" />
    case "input-streaming":
      return <Loader2 className="size-3.5 animate-spin" />
    case "input-available":
    default:
      return <Clock3 className="size-3.5" />
  }
}

function getStatusBadgeClassName(status: AgentTaskStatus) {
  switch (status) {
    case "succeeded":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "failed":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    case "running":
    case "queued":
      return "border-primary/30 bg-primary/10 text-primary"
    case "waiting_confirm":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    case "cancelled":
    default:
      return "border-border bg-muted/70 text-muted-foreground"
  }
}

function getPreviewText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= 140) {
    return normalized
  }

  return `${normalized.slice(0, 140)}...`
}

function ToolSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: string
}) {
  if (!children) {
    return null
  }

  return (
    <section className="overflow-hidden rounded-md border border-border/60 bg-muted/35">
      <div className="flex items-center gap-2 border-b border-border/50 bg-background/55 px-3 py-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap px-3 py-2.5 text-[11px] leading-5 scrollbar-custom">
        {children}
      </pre>
    </section>
  )
}

export function AgentToolCallCard({
  uiMessage,
  tText,
  onConfirmTask,
  compact = false,
  className,
}: AgentToolCallCardProps) {
  const metadata = useMemo(() => getMetadata(uiMessage), [uiMessage])
  const toolPart = useMemo(() => getToolPart(uiMessage), [uiMessage])
  const taskStatus = normalizeTaskStatus(metadata.taskStatus)
  const toolState = (toolPart?.state || getFallbackPartState(taskStatus)) as ToolPartState
  const displayName = getMetadataString(metadata.displayName)
  const toolName = toolPart ? getToolName(toolPart) : displayName || "tool"
  const toolTitle = toolPart?.title || displayName || toolName
  const taskId = getMetadataString(metadata.taskId)
  const toolCallId = toolPart?.toolCallId || taskId || uiMessage.id
  const inputText = getPartInputText(toolPart)
  const outputText = getPartOutputText(toolPart)
  const errorText = getPartErrorText(toolPart)
  const metadataSummary = getMetadataString(metadata.summary)
  const summary = metadataSummary && metadataSummary !== toolTitle ? metadataSummary : undefined
  const confirmTaskId = getApprovalTaskId(toolPart, metadata)
  const defaultOpen = taskStatus !== "succeeded" || Boolean(errorText) || !outputText
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const preview = outputText || errorText || inputText || summary || ""

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/70 bg-background/95 shadow-sm",
        compact ? "text-xs" : "text-sm",
        className
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/35",
          isOpen && "border-b border-border/55 bg-muted/20"
        )}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted text-muted-foreground">
          <Wrench className="size-4" />
        </span>

        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 max-w-[18rem] truncate font-medium text-foreground" title={toolTitle}>
              {toolTitle}
            </span>
            {toolTitle !== toolName && (
              <span className="max-w-[12rem] truncate font-mono text-[11px] text-muted-foreground" title={toolName}>
                {toolName}
              </span>
            )}
          </span>

          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("gap-1 text-[10px]", getStateTone(toolState))}>
              {getStateIcon(toolState)}
              {toolState}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px]", getStatusBadgeClassName(taskStatus))}>
              {getTaskStatusLabel(taskStatus, tText)}
            </Badge>
            {metadata.dangerous && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
                {tText("dangerousAction")}
              </Badge>
            )}
            <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground" title={toolCallId}>
              call {toolCallId}
            </span>
          </span>

          {!isOpen && preview && (
            <span className="block min-w-0 truncate text-xs leading-5 text-muted-foreground">
              {getPreviewText(preview)}
            </span>
          )}
        </span>

        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className={cn("space-y-2.5 px-3 py-3", compact && "space-y-2 px-2.5 py-2.5")}>
          {summary && (
            <div className="rounded-md border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-foreground/85">
              {summary}
            </div>
          )}

          <ToolSection title={tText("taskArguments")} icon={<Braces className="size-3.5" />}>
            {inputText}
          </ToolSection>

          <ToolSection title={tText("taskResult")} icon={<TerminalSquare className="size-3.5" />}>
            {outputText}
          </ToolSection>

          {errorText && (
            <AgentNoticeCard tone="error" size={compact ? "sm" : "md"}>
              {errorText}
            </AgentNoticeCard>
          )}

          {taskStatus === "waiting_confirm" && confirmTaskId && onConfirmTask && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" className="h-7 text-xs" onClick={() => onConfirmTask(confirmTaskId, "confirm")}>
                {tText("confirmAction")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onConfirmTask(confirmTaskId, "reject")}
              >
                {tText("rejectAction")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
