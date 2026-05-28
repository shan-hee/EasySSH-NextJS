"use client"

import { Loader2 } from "lucide-react"
import {
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai"

import { AgentEmptyState, AgentNoticeCard } from "@/components/ai-agent/agent-notice"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Button } from "@/components/ui/button"
import { type AssistantLoadingState, type TimelineTranslate } from "@/lib/ai-agent/timeline-utils"
import { cn } from "@/lib/utils"

type AgentToolPart = ToolUIPart | DynamicToolUIPart
type AgentMessagePart = UIMessage["parts"][number]

interface AgentAIElementsTimelineProps {
  messages: UIMessage[]
  tText: TimelineTranslate
  onConfirmTask?: (taskId: string, decision: "confirm" | "reject") => void
  assistantLoadingState?: AssistantLoadingState
  emptyDescription?: string
  compact?: boolean
  className?: string
}

function getPartKey(message: UIMessage, part: AgentMessagePart, index: number) {
  if ("id" in part && typeof part.id === "string") {
    return `${message.id}:${part.type}:${part.id}`
  }
  if (isToolUIPart(part)) {
    return `${message.id}:${part.type}:${part.toolCallId}`
  }
  return `${message.id}:${part.type}:${index}`
}

function getDataMessage(part: AgentMessagePart, key: string) {
  if (!part.type.startsWith("data-") || !("data" in part)) {
    return ""
  }

  const data = part.data
  if (!data || typeof data !== "object") {
    return ""
  }

  const value = (data as Record<string, unknown>)[key]
  return typeof value === "string" ? value : ""
}

function hasRenderableContent(message: UIMessage) {
  return message.parts.some((part) => {
    if (isTextUIPart(part)) {
      return part.text.trim() !== ""
    }
    if (isReasoningUIPart(part) || isToolUIPart(part)) {
      return true
    }
    if (part.type === "data-error") {
      return getDataMessage(part, "message").trim() !== ""
    }
    if (part.type === "data-tool-status") {
      return getDataMessage(part, "text").trim() !== ""
    }
    return false
  })
}

function toolOutput(part: AgentToolPart) {
  return part.state === "output-available" ? part.output : undefined
}

function toolError(part: AgentToolPart) {
  return part.state === "output-error" ? part.errorText : undefined
}

function shouldToolBeOpen(state: AgentToolPart["state"]) {
  return state !== "output-available" && state !== "output-error" && state !== "output-denied"
}

function ToolHeaderForPart({ part }: { part: AgentToolPart }) {
  if (part.type === "dynamic-tool") {
    return (
      <ToolHeader
        state={part.state}
        title={part.title}
        toolName={part.toolName}
        type={part.type}
      />
    )
  }

  return <ToolHeader state={part.state} title={part.title} type={part.type} />
}

function ToolPartView({
  part,
  tText,
  onConfirmTask,
  compact,
}: {
  part: AgentToolPart
  tText: TimelineTranslate
  onConfirmTask?: (taskId: string, decision: "confirm" | "reject") => void
  compact?: boolean
}) {
  const summary = part.toolMetadata && typeof part.toolMetadata.summary === "string"
    ? part.toolMetadata.summary
    : ""
  const defaultOpen = shouldToolBeOpen(part.state)
  const input = "input" in part ? part.input : {}
  const approvalId = "approval" in part ? part.approval?.id : undefined

  return (
    <Tool key={part.state} defaultOpen={defaultOpen} className={cn("mb-0", compact && "text-xs")}>
      <ToolHeaderForPart part={part} />
      <ToolContent className={compact ? "space-y-3 p-3" : undefined}>
        {summary && (
          <div className="rounded-md border border-border/60 bg-muted/25 px-3 py-2 text-xs leading-5 text-foreground/85">
            {summary}
          </div>
        )}

        <ToolInput input={input ?? {}} />
        <ToolOutput output={toolOutput(part)} errorText={toolError(part)} />

        {part.state === "output-denied" && (
          <AgentNoticeCard tone="warning" size="sm">
            {tText("rejectAction")}
          </AgentNoticeCard>
        )}

        {part.state === "approval-requested" && approvalId && onConfirmTask && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
            <Button size="sm" className="h-8" onClick={() => onConfirmTask(approvalId, "confirm")}>
              {tText("confirmAction")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => onConfirmTask(approvalId, "reject")}
            >
              {tText("rejectAction")}
            </Button>
          </div>
        )}
      </ToolContent>
    </Tool>
  )
}

function MessagePartView({
  part,
  tText,
  onConfirmTask,
  compact,
}: {
  part: AgentMessagePart
  tText: TimelineTranslate
  onConfirmTask?: (taskId: string, decision: "confirm" | "reject") => void
  compact?: boolean
}) {
  if (isTextUIPart(part)) {
    if (!part.text.trim()) {
      return null
    }
    return (
      <MessageResponse className={cn("text-sm leading-6 break-words", compact && "text-xs leading-5")}>
        {part.text}
      </MessageResponse>
    )
  }

  if (isReasoningUIPart(part)) {
    return (
      <Reasoning isStreaming={part.state === "streaming"} defaultOpen={part.state === "streaming"}>
        <ReasoningTrigger
          getThinkingMessage={(isStreaming) => (
            isStreaming ? tText("thinkingLabel") : tText("thinkingProcess")
          )}
        />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    )
  }

  if (isToolUIPart(part)) {
    return (
      <ToolPartView
        part={part}
        tText={tText}
        onConfirmTask={onConfirmTask}
        compact={compact}
      />
    )
  }

  if (part.type === "data-tool-status") {
    const text = getDataMessage(part, "text")
    if (!text) {
      return null
    }
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span>{text}</span>
      </div>
    )
  }

  if (part.type === "data-error") {
    const message = getDataMessage(part, "message")
    if (!message) {
      return null
    }
    return (
      <AgentNoticeCard tone="error" size={compact ? "sm" : "md"}>
        {message}
      </AgentNoticeCard>
    )
  }

  return null
}

function ChatMessage({
  message,
  tText,
  onConfirmTask,
  compact,
}: {
  message: UIMessage
  tText: TimelineTranslate
  onConfirmTask?: (taskId: string, decision: "confirm" | "reject") => void
  compact?: boolean
}) {
  if (!hasRenderableContent(message)) {
    return null
  }

  return (
    <Message from={message.role} className={compact ? "max-w-full" : "max-w-[90%]"}>
      <MessageContent
        className={cn(
          message.role === "user" && "whitespace-pre-wrap break-words leading-6",
          compact && "text-xs"
        )}
      >
        {message.parts.map((part, index) => (
          <MessagePartView
            key={getPartKey(message, part, index)}
            part={part}
            tText={tText}
            onConfirmTask={onConfirmTask}
            compact={compact}
          />
        ))}
      </MessageContent>
    </Message>
  )
}

export function AgentAIElementsTimeline({
  messages,
  tText,
  onConfirmTask,
  assistantLoadingState = false,
  emptyDescription,
  compact = false,
  className,
}: AgentAIElementsTimelineProps) {
  const renderableMessages = messages.filter(hasRenderableContent)
  const shouldShowLoadingIndicator = assistantLoadingState !== false

  if (renderableMessages.length === 0 && !shouldShowLoadingIndicator) {
    return (
      <AgentEmptyState className={cn("min-h-[120px] justify-start border-none bg-transparent px-1 py-2", compact && "text-xs", className)}>
        {emptyDescription || tText("emptyDescriptionIntro")}
      </AgentEmptyState>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4", compact && "gap-3", className)}>
      {renderableMessages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          tText={tText}
          onConfirmTask={onConfirmTask}
          compact={compact}
        />
      ))}

      {shouldShowLoadingIndicator && (
        <Message from="assistant" className={compact ? "max-w-full" : "max-w-[90%]"}>
          <MessageContent>
            <div className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {assistantLoadingState === "thinking" && <span>{tText("panelThinking")}</span>}
            </div>
          </MessageContent>
        </Message>
      )}
    </div>
  )
}
