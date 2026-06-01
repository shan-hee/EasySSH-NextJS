export type TransferProgressSocketKind = "upload" | "serverTransfer"

export interface TransferAuthTicketRequest {
  type: "ws_sftp_upload" | "ws_sftp_transfer"
  task_id: string
}

export interface TransferAuthTicketResponse {
  ticket: string
}

export type TransferAuthTicketProvider = (
  request: TransferAuthTicketRequest,
) => Promise<TransferAuthTicketResponse>

export type TransferWebSocketUrlResolver = (path: string) => string
export type TransferWebSocketConstructor = new (url: string | URL, protocols?: string | string[]) => WebSocket

export const DEFAULT_TRANSFER_CONCURRENCY_LIMIT = 3

export interface CreateTransferProgressWebSocketOptions {
  kind: TransferProgressSocketKind
  taskId: string
  createTicket: TransferAuthTicketProvider
  resolveWebSocketUrl: TransferWebSocketUrlResolver
  WebSocketCtor?: TransferWebSocketConstructor
}

export interface WaitForTransferWebSocketOpenOptions {
  timeoutMs: number
  rejectOnError?: boolean
  timeoutMessage?: string
  errorMessage?: string
}

export interface CloseTransferWebSocketOptions {
  code?: number
  reason?: string
  includeConnecting?: boolean
}

export type TransferRuntimeTaskType = "upload" | "download" | "transfer"

export interface TransferRuntimeTaskLike {
  id: string
  type: TransferRuntimeTaskType
  status?: string
}

export interface TransferRuntimeHandleStore {
  xhrRefs: Map<string, XMLHttpRequest>
  wsRefs: Map<string, WebSocket>
  cancelledBeforeStart: Set<string>
}

export interface ReleaseTransferRuntimeTaskHandlesOptions {
  closeWebSocket?: boolean
  includeConnecting?: boolean
}

export interface ClearTransferRuntimeTaskHandlesOptions {
  taskIds?: Iterable<string>
  abortXhrs?: boolean
  closeWebSockets?: boolean
  includeConnecting?: boolean
  clearCancellationMarkers?: boolean
}

export interface CancelTransferRuntimeTaskOptions {
  handles: TransferRuntimeHandleStore
  taskId: string
  task?: TransferRuntimeTaskLike | null
  cancelUploadTask?: (taskId: string) => Promise<unknown>
  cancelServerTransfer?: (taskId: string) => Promise<unknown>
  markCancelled?: (taskId: string) => void
  closeWebSocket?: boolean
  logError?: (message: string, error: unknown) => void
}

export type ReleaseTransferRuntimeSlot = () => void

export interface TransferConcurrencyLimiter {
  acquire: () => Promise<ReleaseTransferRuntimeSlot>
  getActiveCount: () => number
  getQueuedCount: () => number
}

export interface CreateTransferConcurrencyLimiterOptions {
  maxConcurrent?: number
}

const TRANSFER_PROGRESS_SOCKET_CONFIG: Record<
  TransferProgressSocketKind,
  { ticketType: TransferAuthTicketRequest["type"]; endpoint: string }
> = {
  upload: {
    ticketType: "ws_sftp_upload",
    endpoint: "/api/v1/sftp/upload/ws",
  },
  serverTransfer: {
    ticketType: "ws_sftp_transfer",
    endpoint: "/api/v1/sftp/transfer/ws",
  },
}

export async function createTransferProgressWebSocket({
  kind,
  taskId,
  createTicket,
  resolveWebSocketUrl,
  WebSocketCtor,
}: CreateTransferProgressWebSocketOptions): Promise<WebSocket> {
  const config = TRANSFER_PROGRESS_SOCKET_CONFIG[kind]
  const { ticket } = await createTicket({
    type: config.ticketType,
    task_id: taskId,
  })
  const params = new URLSearchParams()
  params.set("ticket", ticket)

  const SocketCtor = WebSocketCtor ?? globalThis.WebSocket
  if (!SocketCtor) {
    throw new Error("WebSocket is not available in this runtime")
  }

  return new SocketCtor(resolveWebSocketUrl(`${config.endpoint}/${taskId}?${params.toString()}`))
}

export function waitForTransferWebSocketOpen(
  socket: WebSocket,
  {
    timeoutMs,
    rejectOnError = false,
    timeoutMessage = "WebSocket 连接超时",
    errorMessage = "WebSocket 连接失败",
  }: WaitForTransferWebSocketOpenOptions,
): Promise<void> {
  if (socket.readyState === socket.OPEN) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const originalOnopen = socket.onopen
    const originalOnerror = socket.onerror

    const cleanup = () => {
      socket.onopen = originalOnopen
      socket.onerror = originalOnerror
    }
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      if (timeout !== undefined) {
        clearTimeout(timeout)
      }
      cleanup()
      callback()
    }

    timeout = setTimeout(() => {
      settle(() => {
        if (rejectOnError) {
          reject(new Error(timeoutMessage))
        } else {
          resolve()
        }
      })
    }, timeoutMs)

    socket.onopen = (event) => {
      settle(() => {
        resolve()
        originalOnopen?.call(socket, event)
      })
    }

    if (rejectOnError) {
      socket.onerror = (event) => {
        settle(() => {
          reject(new Error(errorMessage))
          originalOnerror?.call(socket, event)
        })
      }
    }
  })
}

export function sendTransferCancelMessage(socket: WebSocket | undefined, taskId: string): boolean {
  if (!socket || socket.readyState !== socket.OPEN) {
    return false
  }

  socket.send(JSON.stringify({ type: "cancel", task_id: taskId }))
  return true
}

export function isTransferWebSocketActive(socket: WebSocket | null | undefined): boolean {
  return !!socket && (socket.readyState === socket.CONNECTING || socket.readyState === socket.OPEN)
}

export function closeTransferWebSocket(
  socket: WebSocket | null | undefined,
  { code, reason, includeConnecting = false }: CloseTransferWebSocketOptions = {},
): void {
  if (!socket) {
    return
  }

  const shouldClose = socket.readyState === socket.OPEN || (includeConnecting && socket.readyState === socket.CONNECTING)
  if (shouldClose) {
    socket.close(code, reason)
  }
}

export function createTransferRuntimeHandleStore(): TransferRuntimeHandleStore {
  return {
    xhrRefs: new Map<string, XMLHttpRequest>(),
    wsRefs: new Map<string, WebSocket>(),
    cancelledBeforeStart: new Set<string>(),
  }
}

export function createTransferConcurrencyLimiter({
  maxConcurrent = DEFAULT_TRANSFER_CONCURRENCY_LIMIT,
}: CreateTransferConcurrencyLimiterOptions = {}): TransferConcurrencyLimiter {
  const limit = Math.max(1, Math.floor(maxConcurrent))
  const state = {
    active: 0,
    queue: [] as Array<() => void>,
  }

  return {
    acquire() {
      return new Promise<ReleaseTransferRuntimeSlot>((resolve) => {
        const grant = () => {
          state.active += 1
          let released = false

          resolve(() => {
            if (released) return
            released = true
            state.active = Math.max(0, state.active - 1)
            const next = state.queue.shift()
            if (next) {
              next()
            }
          })
        }

        if (state.active < limit) {
          grant()
        } else {
          state.queue.push(grant)
        }
      })
    },
    getActiveCount() {
      return state.active
    },
    getQueuedCount() {
      return state.queue.length
    },
  }
}

export function registerTransferXhr(
  handles: TransferRuntimeHandleStore,
  taskId: string,
  xhr: XMLHttpRequest,
): void {
  handles.xhrRefs.set(taskId, xhr)
}

export function registerTransferWebSocket(
  handles: TransferRuntimeHandleStore,
  taskId: string,
  socket: WebSocket,
): void {
  handles.wsRefs.set(taskId, socket)
}

export function markTransferCancelledBeforeStart(
  handles: TransferRuntimeHandleStore,
  taskId: string,
): void {
  handles.cancelledBeforeStart.add(taskId)
}

export function isTransferCancellationRequested(
  handles: TransferRuntimeHandleStore,
  taskId: string,
): boolean {
  return handles.cancelledBeforeStart.has(taskId)
}

export function consumeTransferCancelledBeforeStart(
  handles: TransferRuntimeHandleStore,
  taskId: string,
): boolean {
  const cancelled = handles.cancelledBeforeStart.has(taskId)
  if (cancelled) {
    handles.cancelledBeforeStart.delete(taskId)
  }
  return cancelled
}

export function releaseTransferRuntimeTaskHandles(
  handles: TransferRuntimeHandleStore,
  taskId: string,
  { closeWebSocket = false, includeConnecting = false }: ReleaseTransferRuntimeTaskHandlesOptions = {},
): void {
  handles.xhrRefs.delete(taskId)

  const socket = handles.wsRefs.get(taskId)
  if (closeWebSocket) {
    closeTransferWebSocket(socket, { includeConnecting })
  }
  handles.wsRefs.delete(taskId)
  handles.cancelledBeforeStart.delete(taskId)
}

export function clearTransferRuntimeTaskHandles(
  handles: TransferRuntimeHandleStore,
  {
    taskIds,
    abortXhrs = true,
    closeWebSockets = true,
    includeConnecting = true,
    clearCancellationMarkers = true,
  }: ClearTransferRuntimeTaskHandlesOptions = {},
): void {
  const ids = taskIds
    ? Array.from(taskIds)
    : Array.from(new Set([...handles.xhrRefs.keys(), ...handles.wsRefs.keys(), ...handles.cancelledBeforeStart.keys()]))

  for (const taskId of ids) {
    const xhr = handles.xhrRefs.get(taskId)
    if (xhr && abortXhrs) {
      xhr.abort()
    }
    handles.xhrRefs.delete(taskId)

    const socket = handles.wsRefs.get(taskId)
    if (socket && closeWebSockets) {
      closeTransferWebSocket(socket, { includeConnecting })
    }
    handles.wsRefs.delete(taskId)
    if (clearCancellationMarkers) {
      handles.cancelledBeforeStart.delete(taskId)
    }
  }
}

export function isTransferRuntimeTaskActive(task: TransferRuntimeTaskLike | null | undefined): boolean {
  if (!task) {
    return true
  }

  return (
    task.status === undefined ||
    task.status === "pending" ||
    task.status === "uploading" ||
    task.status === "downloading" ||
    task.status === "transferring"
  )
}

export async function cancelTransferRuntimeTask({
  handles,
  taskId,
  task,
  cancelUploadTask,
  cancelServerTransfer,
  markCancelled,
  closeWebSocket = false,
  logError = (message, error) => console.error(message, error),
}: CancelTransferRuntimeTaskOptions): Promise<void> {
  const isActive = isTransferRuntimeTaskActive(task)
  if (!isActive) {
    releaseTransferRuntimeTaskHandles(handles, taskId, { closeWebSocket, includeConnecting: true })
    return
  }

  markTransferCancelledBeforeStart(handles, taskId)

  const socket = handles.wsRefs.get(taskId)
  try {
    sendTransferCancelMessage(socket, taskId)
  } catch (error) {
    logError("[transfer-runtime] Failed to send cancel message via WebSocket:", error)
  }

  if (closeWebSocket) {
    closeTransferWebSocket(socket, { includeConnecting: true })
    handles.wsRefs.delete(taskId)
  }

  const xhr = handles.xhrRefs.get(taskId)
  if (xhr) {
    xhr.abort()
    handles.xhrRefs.delete(taskId)
  }

  if ((!task || task.type === "upload") && cancelUploadTask) {
    try {
      await cancelUploadTask(taskId)
    } catch (error) {
      logError("[transfer-runtime] Failed to cancel upload via API:", error)
    }
  } else if (task?.type === "transfer" && cancelServerTransfer) {
    try {
      await cancelServerTransfer(taskId)
    } catch (error) {
      logError("[transfer-runtime] Failed to cancel transfer via API:", error)
    }
  }

  markCancelled?.(taskId)
}
