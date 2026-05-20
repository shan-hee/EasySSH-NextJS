import type { ResolvedTimelineItem } from "@/lib/ai-agent/session-state"
import type { TaskView } from "@/lib/api/ai-agent"

type TimelineTranslateValues = Record<string, string | number | Date>

export type TimelineTranslate = (key: string, values?: TimelineTranslateValues) => string
export type AssistantLoadingState = false | "waiting" | "thinking"

export function getTaskStatusLabel(status: TaskView["status"], tText: TimelineTranslate) {
  switch (status) {
    case "queued":
      return tText("taskStatusQueued")
    case "waiting_confirm":
      return tText("taskStatusWaitingConfirm")
    case "running":
      return tText("taskStatusRunning")
    case "succeeded":
      return tText("taskStatusSucceeded")
    case "failed":
      return tText("taskStatusFailed")
    case "cancelled":
      return tText("taskStatusCancelled")
    default:
      return status
  }
}

export function collectAutoCollapseTaskIds(entries: ResolvedTimelineItem[]) {
  const result = new Set<string>()
  let hasAssistantMessageAfter = false

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]

    if (entry.kind === "message" && entry.data?.role === "assistant" && entry.data.content.trim() !== "") {
      hasAssistantMessageAfter = true
      continue
    }

    if (entry.kind === "task" && entry.data?.result && hasAssistantMessageAfter) {
      result.add(entry.data.id)
    }
  }

  return result
}

export function getLatestRemoteOutputKindAfterLatestUserMessage(
  entries: ResolvedTimelineItem[]
): "assistant" | "task" | "confirmation" | "error" | null {
  let latestUserMessageIndex = -1

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry.kind === "message" && entry.data?.role === "user") {
      latestUserMessageIndex = index
      break
    }
  }

  if (latestUserMessageIndex === -1) {
    return null
  }

  for (let index = entries.length - 1; index > latestUserMessageIndex; index -= 1) {
    const entry = entries[index]
    if (!entry.data) {
      continue
    }

    if (entry.kind === "message") {
      if (entry.data.role === "assistant") {
        return "assistant"
      }
      continue
    }

    if (entry.kind === "task" || entry.kind === "confirmation" || entry.kind === "error") {
      return entry.kind
    }
  }

  return null
}
