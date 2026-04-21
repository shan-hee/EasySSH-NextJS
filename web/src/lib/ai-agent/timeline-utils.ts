import type { ResolvedTimelineItem } from "@/lib/ai-agent/session-state"
import type { TaskView } from "@/lib/api/ai-agent"

type TimelineTranslateValues = Record<string, string | number | Date>

export type TimelineTranslate = (key: string, values?: TimelineTranslateValues) => string

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
