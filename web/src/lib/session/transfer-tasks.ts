import type { TransferProgressMessage, UploadTaskStatus } from "@/lib/api/sftp"
import { formatBytesString, formatRemainingTime, formatSpeed } from "@/lib/format-utils"
import type { WorkspaceTransferTask } from "./workspace"

export type TransferTask = WorkspaceTransferTask

export interface CreateUploadTransferTaskOptions {
  taskId: string
  fileName: string
  fileSizeBytes: number
  startTime?: number
}

export interface CreateServerTransferTaskOptions {
  taskId?: string
  fileName: string
  sourceServer: string
  targetServer: string
  startTime?: number
}

export type TransferTaskUpdate = Partial<WorkspaceTransferTask>

export interface UploadProgressMessageLike {
  type?: "started" | "progress" | "complete" | "cancelled" | "error" | string
  loaded?: number
  total?: number
  stage?: string
  speed_bps?: number
  message?: string
}

export interface MapUploadProgressMessageOptions {
  fileSizeBytes: number
}

export interface MappedUploadProgressMessage {
  update?: TransferTaskUpdate
  progressEvent?: {
    loaded: number
    total: number
  }
  isError?: boolean
  errorMessage?: string
}

export function normalizeTransferStage(stage?: string): WorkspaceTransferTask["stage"] | undefined {
  return stage === "http" || stage === "sftp" || stage === "stream"
    ? stage
    : undefined
}

export function mapUploadTaskStatusToTransferTask(
  task: UploadTaskStatus,
  fallbackStartTime: number = Date.now(),
): WorkspaceTransferTask {
  const startedAt = Date.parse(task.started_at || task.created_at || "")
  const fileSizeBytes = task.total || task.file_size || 0
  const bytesTransferred = task.loaded || 0
  const speed = task.speed_bps > 0 ? formatSpeed(task.speed_bps) : undefined
  const timeRemaining =
    task.status === "uploading" && task.speed_bps > 0 && fileSizeBytes > bytesTransferred
      ? formatRemainingTime((fileSizeBytes - bytesTransferred) / task.speed_bps)
      : undefined

  return {
    id: task.id,
    fileName: task.file_name || task.remote_path?.split("/").pop() || "upload",
    fileSize: fileSizeBytes > 0 ? formatBytesString(fileSizeBytes) : "-",
    fileSizeBytes,
    progress: Math.round(task.progress || 0),
    status: task.status,
    type: "upload",
    speed,
    timeRemaining,
    error: task.error || task.message,
    startTime: Number.isFinite(startedAt) ? startedAt : fallbackStartTime,
    bytesTransferred,
    stage: normalizeTransferStage(task.stage),
  }
}

export function createUploadTransferTask({
  taskId,
  fileName,
  fileSizeBytes,
  startTime = Date.now(),
}: CreateUploadTransferTaskOptions): WorkspaceTransferTask {
  return {
    id: taskId,
    fileName,
    fileSize: formatBytesString(fileSizeBytes),
    fileSizeBytes,
    progress: 0,
    status: "pending",
    type: "upload",
    startTime,
    bytesTransferred: 0,
  }
}

export function createServerTransferTask({
  taskId,
  fileName,
  sourceServer,
  targetServer,
  startTime = Date.now(),
}: CreateServerTransferTaskOptions): WorkspaceTransferTask {
  return {
    id: taskId ?? `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    fileName,
    fileSize: "-",
    fileSizeBytes: 0,
    progress: 0,
    status: "transferring",
    type: "transfer",
    startTime,
    sourceServer,
    targetServer,
  }
}

export function mergeTransferTaskUpdate(
  task: WorkspaceTransferTask,
  update: TransferTaskUpdate,
  now: number = Date.now(),
): WorkspaceTransferTask {
  const stageChanged = update.stage !== undefined && update.stage !== task.stage
  const updatedTask: WorkspaceTransferTask = {
    ...task,
    ...update,
    // 阶段切换时重置计时起点，避免 HTTP stream 与 SFTP 写入阶段混算平均速度。
    startTime: stageChanged ? now : task.startTime,
  }

  if (updatedTask.bytesTransferred !== undefined && updatedTask.startTime) {
    const elapsedSeconds = (now - updatedTask.startTime) / 1000
    if (elapsedSeconds > 0) {
      const speed = updatedTask.bytesTransferred / elapsedSeconds
      updatedTask.speed = formatSpeed(speed)

      const remainingBytes = Math.max(0, updatedTask.fileSizeBytes - updatedTask.bytesTransferred)
      if (speed > 0) {
        updatedTask.timeRemaining = formatRemainingTime(remainingBytes / speed)
      }
    }
  }

  return updatedTask
}

export function mapUploadProgressMessageToTransferUpdate(
  message: UploadProgressMessageLike,
  { fileSizeBytes }: MapUploadProgressMessageOptions,
): MappedUploadProgressMessage {
  const stage: WorkspaceTransferTask["stage"] = message.stage === "stream" ? "stream" : "sftp"
  const loaded = message.loaded ?? 0

  if (message.type === "started") {
    return {
      update: {
        progress: 0,
        bytesTransferred: loaded,
        status: "uploading",
        stage,
      },
    }
  }

  if (message.type === "progress") {
    if (message.stage !== "stream" && message.stage !== "sftp") {
      return {}
    }

    const total = message.total && message.total > 0 ? message.total : fileSizeBytes
    return {
      update: {
        progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
        bytesTransferred: loaded,
        status: "uploading",
        stage,
        speed: message.speed_bps ? formatSpeed(message.speed_bps) : undefined,
      },
      progressEvent: {
        loaded,
        total,
      },
    }
  }

  if (message.type === "complete") {
    return {
      update: {
        progress: 100,
        status: "completed",
        bytesTransferred: fileSizeBytes,
        stage,
      },
    }
  }

  if (message.type === "cancelled") {
    return {
      update: {
        status: "cancelled",
        stage,
        error: "已取消",
      },
    }
  }

  if (message.type === "error") {
    return {
      isError: true,
      errorMessage: message.message,
    }
  }

  return {}
}

export function mapTransferProgressMessageToTaskUpdate(
  message: TransferProgressMessage,
): TransferTaskUpdate | null {
  if (message.type === "started") {
    return {
      status: "transferring",
    }
  }

  if (message.type === "progress") {
    return {
      progress: message.progress,
      bytesTransferred: message.bytes_copied,
      fileSizeBytes: message.bytes_total,
      fileSize: message.bytes_total > 0 ? formatBytesString(message.bytes_total) : "-",
      speed: message.speed_bps > 0 ? formatSpeed(message.speed_bps) : undefined,
      timeRemaining: message.eta || undefined,
      transferMethod: message.method,
    }
  }

  if (message.type === "complete") {
    return {
      progress: 100,
      status: "completed",
      transferMethod: message.method,
    }
  }

  if (message.type === "error") {
    return {
      status: "failed",
      error: message.message || "传输失败",
      transferMethod: message.method,
    }
  }

  if (message.type === "cancelled") {
    return {
      status: "cancelled",
      error: "已取消",
      transferMethod: message.method,
    }
  }

  return null
}
