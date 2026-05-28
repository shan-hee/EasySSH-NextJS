"use client"

import { memo, useMemo, useState } from "react"
import { Bot, Brain, ChevronRight, Loader2 } from "lucide-react"

import { AgentEmptyState, AgentNoticeCard } from "@/components/ai-agent/agent-notice"
import { AgentTimeline } from "@/components/ai-agent/agent-timeline"
import { AgentToolCallCard } from "@/components/ai-agent/agent-tool-call-card"
import { Response } from "@/components/ui/shadcn-io/ai/response"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  getAgentUIMessageReasoning,
  getAgentUIMessageText,
  getAgentUIMessageToolStatus,
  isAgentUIMessageReasoningStreaming,
  type AgentUIMessage,
} from "@/lib/ai-agent/ai-sdk-ui"
import { type AssistantLoadingState, type TimelineTranslate } from "@/lib/ai-agent/timeline-utils"
import type { ResolvedTimelineItem, TimelineMessage } from "@/lib/ai-agent/session-state"
import { cn } from "@/lib/utils"

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

const MessageItem = memo(({
  message,
  uiMessage,
  thinkingLabel,
  thinkingProcessLabel,
}: {
  message: TimelineMessage
  uiMessage?: AgentUIMessage | null
  thinkingLabel: string
  thinkingProcessLabel: string
}) => {
  const [isThinkingOpen, setIsThinkingOpen] = useState(false)
  const toolStatus = useMemo(() => getAgentUIMessageToolStatus(uiMessage), [uiMessage])
  const thinking = useMemo(() => getAgentUIMessageReasoning(uiMessage), [uiMessage])
  const content = useMemo(() => getAgentUIMessageText(uiMessage), [uiMessage])

  const isThinkingStreaming = Boolean(isAgentUIMessageReasoningStreaming(uiMessage) && thinking && !content)
  const hasAssistantVisualContent = Boolean(toolStatus || thinking || content)

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <span className="px-1 text-xs text-muted-foreground">{formatMessageTime(message.created_at)}</span>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground">
            <div className="whitespace-pre-wrap break-words leading-6">
              {content || message.content}
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
        {toolStatus && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{toolStatus}</span>
          </div>
        )}

        {thinking && (
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
                {thinking}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {content && (
          <div className="px-1 py-1 text-sm text-foreground">
            <Response className="text-sm leading-6 break-words [&_pre]:text-xs">
              {content}
            </Response>
          </div>
        )}

        <span className="px-1 text-xs text-muted-foreground">{formatMessageTime(message.created_at)}</span>
      </div>
    </div>
  )
})

MessageItem.displayName = "MessageItem"

interface TerminalAgentTimelineProps {
  entries: ResolvedTimelineItem[]
  tText: TimelineTranslate
  onConfirmTask: (taskId: string, decision: "confirm" | "reject") => void
  assistantLoadingState?: AssistantLoadingState
  emptyDescription?: string
}

export function TerminalAgentTimeline({
  entries,
  tText,
  onConfirmTask,
  assistantLoadingState = false,
  emptyDescription,
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
              {emptyDescription || tText("emptyDescriptionIntro")}
            </AgentEmptyState>
          ) : null
        }
        renderMessage={(entry) => (
          <MessageItem
            message={entry.data}
            uiMessage={entry.uiMessage}
            thinkingLabel={tText("thinkingLabel")}
            thinkingProcessLabel={tText("thinkingProcess")}
          />
        )}
        renderTask={(entry) => (
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <AgentToolCallCard
              task={entry.data}
              uiMessage={entry.uiMessage}
              tText={tText}
              onConfirmTask={onConfirmTask}
              compact
              className="min-w-0 max-w-[85%] flex-1"
            />
          </div>
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
