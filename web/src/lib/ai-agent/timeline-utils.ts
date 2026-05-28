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
