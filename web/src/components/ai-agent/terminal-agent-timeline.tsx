"use client"

import { memo, useMemo, useState } from "react"
import { Bot, Brain, ChevronRight, Loader2, Sparkles } from "lucide-react"

import { AgentEmptyState, AgentNoticeCard } from "@/components/ai-agent/agent-notice"
import { AgentTimeline } from "@/components/ai-agent/agent-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Response } from "@/components/ui/shadcn-io/ai/response"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { getTaskStatusLabel, type AssistantLoadingState, type TimelineTranslate } from "@/lib/ai-agent/timeline-utils"
import type { ResolvedTimelineItem, TimelineMessage } from "@/lib/ai-agent/session-state"
import type { TaskView } from "@/lib/api/ai-agent"
import { cn } from "@/lib/utils"

interface ParsedContent {
  thinking: string | null
  content: string
}

interface ParsedToolStatus {
  toolStatus: string | null
  content: string
}

interface ParsedAssistantMessage extends ParsedContent {
  toolStatus: string | null
}

function parseThinkingContent(text: string): ParsedContent {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i)

  if (thinkMatch) {
    const thinking = thinkMatch[1].trim()
    const content = text.replace(/<think>[\s\S]*?<\/think>/i, "").trim()
    return { thinking, content }
  }

  const unclosedMatch = text.match(/<think>([\s\S]*)$/i)
  if (unclosedMatch) {
    return { thinking: unclosedMatch[1].trim(), content: "" }
  }

  return { thinking: null, content: text }
}

function parseToolStatus(text: string): ParsedToolStatus {
  const toolStatusMatches = text.match(/<tool-status>([\s\S]*?)<\/tool-status>/gi)

  if (toolStatusMatches && toolStatusMatches.length > 0) {
    const lastMatch = toolStatusMatches[toolStatusMatches.length - 1]
    const statusMatch = lastMatch.match(/<tool-status>([\s\S]*?)<\/tool-status>/i)
    const toolStatus = statusMatch ? statusMatch[1].trim() : null
    const content = text.replace(/<tool-status>[\s\S]*?<\/tool-status>/gi, "").trim()
    return { toolStatus, content }
  }

  const unclosedMatch = text.match(/<tool-status>([\s\S]*)$/i)
  if (unclosedMatch) {
    return {
      toolStatus: unclosedMatch[1].trim(),
      content: text.replace(/<tool-status>[\s\S]*$/i, "").trim(),
    }
  }

  return { toolStatus: null, content: text }
}

function parseAssistantMessageContent(text: string): ParsedAssistantMessage {
  const toolStatusResult = parseToolStatus(text)
  const thinkingResult = parseThinkingContent(toolStatusResult.content)
  return {
    toolStatus: toolStatusResult.toolStatus,
    thinking: thinkingResult.thinking,
    content: thinkingResult.content,
  }
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getTaskBadgeClassName(status: TaskView["status"]) {
  switch (status) {
    case "succeeded":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
    case "failed":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    case "running":
      return "border-primary/30 bg-primary/10 text-primary"
    case "waiting_confirm":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700"
    default:
      return "border-border bg-muted/60 text-muted-foreground"
  }
}

const MessageItem = memo(({
  message,
  thinkingLabel,
  thinkingProcessLabel,
}: {
  message: TimelineMessage
  thinkingLabel: string
  thinkingProcessLabel: string
}) => {
  const [isThinkingOpen, setIsThinkingOpen] = useState(false)
  const parsedAssistant = useMemo(
    () => (message.role === "assistant" ? parseAssistantMessageContent(message.content) : null),
    [message.role, message.content]
  )

  const isThinkingStreaming = Boolean(
    message.pending && parsedAssistant?.thinking && !parsedAssistant?.content
  )
  const hasAssistantVisualContent = Boolean(
    parsedAssistant?.toolStatus || parsedAssistant?.thinking || parsedAssistant?.content
  )

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <span className="px-1 text-xs text-muted-foreground">{formatMessageTime(message.created_at)}</span>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground">
            <div className="whitespace-pre-wrap break-words leading-6">
              {message.content}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!hasAssistantVisualContent) {
    return null
  }

  return (
    <div className="flex items-start gap-3">
      <div
        className="h-7 w-7 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center"
        aria-hidden="true"
      >
        <Bot className="h-3.5 w-3.5" />
      </div>

      <div className="flex max-w-[85%] flex-col items-start gap-1.5">
        {parsedAssistant?.toolStatus && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{parsedAssistant.toolStatus}</span>
          </div>
        )}

        {parsedAssistant?.thinking && (
          <Collapsible open={isThinkingOpen} onOpenChange={setIsThinkingOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Brain className="h-3.5 w-3.5" />
                <span>{isThinkingStreaming ? thinkingLabel : thinkingProcessLabel}</span>
                <ChevronRight
                  className={cn("h-3.5 w-3.5 transition-transform", isThinkingOpen && "rotate-90")}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                {parsedAssistant.thinking}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {parsedAssistant?.content && (
          <div className="px-1 py-1 text-sm text-foreground">
            <Response className="text-sm leading-6 break-words [&_pre]:text-xs">
              {parsedAssistant.content}
            </Response>
          </div>
        )}

        <span className="px-1 text-xs text-muted-foreground">{formatMessageTime(message.created_at)}</span>
      </div>
    </div>
  )
})

MessageItem.displayName = "MessageItem"

function TaskItem({
  task,
  tText,
  onConfirmTask,
}: {
  task: TaskView
  tText: TimelineTranslate
  onConfirmTask: (taskId: string, decision: "confirm" | "reject") => void
}) {
  const argumentsText = task.arguments ? JSON.stringify(task.arguments, null, 2) : ""

  return (
    <div className="flex items-start gap-3">
      <div className="h-7 w-7 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 max-w-[85%] rounded-xl border bg-background px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px]", getTaskBadgeClassName(task.status))}>
            {getTaskStatusLabel(task.status, tText)}
          </Badge>
          <span className="text-sm font-medium">{task.tool_display_name || task.tool_name}</span>
          {task.dangerous && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
              {tText("dangerousAction")}
            </Badge>
          )}
        </div>

        {task.summary && <div className="mt-2 text-sm text-foreground/90">{task.summary}</div>}

        {argumentsText && (
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/70 p-2.5 text-xs">
            {argumentsText}
          </pre>
        )}

        {task.result && (
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/70 p-2.5 text-xs">
            {task.result}
          </pre>
        )}

        {task.error && (
          <AgentNoticeCard tone="error" size="sm" className="mt-2">
            {task.error}
          </AgentNoticeCard>
        )}

        <div className="mt-2 text-[11px] text-muted-foreground">{formatMessageTime(task.created_at)}</div>

        {task.status === "waiting_confirm" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => onConfirmTask(task.id, "confirm")}>
              {tText("confirmAction")}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onConfirmTask(task.id, "reject")}>
              {tText("rejectAction")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface TerminalAgentTimelineProps {
  entries: ResolvedTimelineItem[]
  tText: TimelineTranslate
  onConfirmTask: (taskId: string, decision: "confirm" | "reject") => void
  assistantLoadingState?: AssistantLoadingState
}

export function TerminalAgentTimeline({
  entries,
  tText,
  onConfirmTask,
  assistantLoadingState = false,
}: TerminalAgentTimelineProps) {
  const shouldShowLoadingIndicator = assistantLoadingState !== false
  const isThinking = assistantLoadingState === "thinking"

  return (
    <>
      <AgentTimeline
        entries={entries}
        className="flex flex-col gap-3"
        emptyState={
          !shouldShowLoadingIndicator ? (
            <AgentEmptyState className="min-h-[120px] justify-start border-none bg-transparent px-1 py-2 text-xs">
              {tText("emptyDescriptionIntro")}
            </AgentEmptyState>
          ) : null
        }
        renderMessage={(entry) => (
          <MessageItem
            message={entry.data}
            thinkingLabel={tText("thinkingLabel")}
            thinkingProcessLabel={tText("thinkingProcess")}
          />
        )}
        renderTask={(entry) => (
          <TaskItem task={entry.data} tText={tText} onConfirmTask={onConfirmTask} />
        )}
        renderConfirmation={(entry) => (
          <AgentNoticeCard
            tone="warning"
            size="sm"
            title={entry.data.decision ? tText("confirmationResolved") : tText("confirmationRequested")}
          >
            <>
              {tText("taskShortLabel")} #{entry.data.task_id.slice(0, 8)} · {entry.data.status}
              {entry.data.decision ? ` · ${entry.data.decision === "confirm" ? tText("confirmAction") : tText("rejectAction")}` : ""}
            </>
          </AgentNoticeCard>
        )}
        renderError={(entry) => (
          <AgentNoticeCard tone="error" size="sm" title={tText("eventErrorTitle")}>
            {entry.data.message}
          </AgentNoticeCard>
        )}
      />

      {shouldShowLoadingIndicator && (
        <div className="flex items-start gap-3">
          <div className="h-7 w-7 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div
            className="flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
            aria-label={isThinking ? tText("panelThinking") : tText("loading")}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isThinking && <span>{tText("panelThinking")}</span>}
          </div>
        </div>
      )}
    </>
  )
}
