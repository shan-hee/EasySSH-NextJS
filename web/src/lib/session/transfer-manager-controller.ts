import { sftpApi, type FileInfo } from "@/lib/api/sftp"
import {
  createServerTransferTask,
  createUploadTransferTask,
  mapUploadTaskStatusToTransferTask,
  type TransferTask,
  type TransferTaskUpdate,
} from "./transfer-tasks"
import {
  appendTransferTask,
  applyTransferTaskUpdate,
  clearSettledTransferTasks,
  findTransferTask,
  getActiveTransferTasks,
  getSettledTransferTaskIds,
  getTransferTaskIds,
  markTransferTaskCancelled,
  mergeRestoredTransferTasks,
  removeTransferTaskById,
} from "./transfer-controller"
import {
  bindServerTransferProgressSocket,
  bindUploadTransferProgressSocket,
  cancelTransferRuntimeTask,
  clearTransferRuntimeTaskHandles,
  consumeTransferCancelledBeforeStart,
  createTransferProgressWebSocket,
  createUploadHttpProgressHandler,
  registerTransferWebSocket,
  registerTransferXhr,
  releaseTransferRuntimeTaskHandles,
  waitForTransferWebSocketOpen,
  type ReleaseTransferRuntimeSlot,
  type TransferAuthTicketProvider,
  type TransferConcurrencyLimiter,
  type TransferRuntimeHandleStore,
  type TransferWebSocketConstructor,
  type TransferWebSocketUrlResolver,
} from "./transfer-runtime"

export interface FileTransferSftpApi {
  createUploadTask: () => Promise<{ task_id: string }>
  listUploadTasks: typeof sftpApi.listUploadTasks
  cancelUploadTask: (taskId: string) => Promise<unknown>
  uploadFile: typeof sftpApi.uploadFile
  directTransfer: typeof sftpApi.directTransfer
  cancelTransfer: (taskId: string) => Promise<unknown>
}

export type TransferTaskStateUpdater = (
  updater: (tasks: readonly TransferTask[]) => TransferTask[],
) => void

export interface CreateFileTransferControllerOptions {
  api: FileTransferSftpApi
  createTicket: TransferAuthTicketProvider
  resolveWebSocketUrl: TransferWebSocketUrlResolver
  uploadLimiter: TransferConcurrencyLimiter
  handles: TransferRuntimeHandleStore
  getTasks: () => readonly TransferTask[]
  setTasks: TransferTaskStateUpdater
  WebSocketCtor?: TransferWebSocketConstructor
  logError?: (message: string, error?: unknown) => void
  logWarn?: (message: string, ...args: unknown[]) => void
}

export interface RestoreUploadTasksOptions {
  shouldSkip?: () => boolean
}

export interface FileTransferController {
  restoreUploadTasks: (options?: RestoreUploadTasksOptions) => Promise<void>
  uploadFile: (
    serverId: string,
    remotePath: string,
    file: File,
    onProgress?: (loaded: number, total: number) => void,
    enableWebSocket?: boolean,
  ) => Promise<FileInfo | null>
  cancelTask: (taskId: string) => void
  removeTask: (taskId: string) => void
  clearCompleted: () => void
  clearAll: () => void
  createTransferTask: (fileName: string, sourceServer: string, targetServer: string) => TransferTask
  addTask: (task: TransferTask) => void
  updateTask: (taskId: string, update: TransferTaskUpdate) => void
  directTransfer: (
    sourceServerId: string,
    sourcePath: string,
    targetServerId: string,
    targetPath: string,
    sourceServerName: string,
    targetServerName: string,
    fileName: string,
  ) => Promise<void>
  cancelDirectTransfer: (taskId: string) => Promise<void>
}

export function createFileTransferController({
  api,
  createTicket,
  resolveWebSocketUrl,
  uploadLimiter,
  handles,
  getTasks,
  setTasks,
  WebSocketCtor,
  logError = (message, error) => console.error(message, error),
  logWarn = (message, ...args) => console.warn(message, ...args),
}: CreateFileTransferControllerOptions): FileTransferController {
  const runtimeLogError = (message: string, error?: unknown) => {
    logError(message.replace("[transfer-runtime]", "[transfer-manager]"), error)
  }
  const runtimeLogWarn = (message: string, ...args: unknown[]) => {
    logWarn(message.replace("[transfer-runtime]", "[transfer-manager]"), ...args)
  }
  const updateTaskProgress = (taskId: string, update: TransferTaskUpdate) => {
    setTasks((prev) => applyTransferTaskUpdate(prev, taskId, update, { mergeProgress: true }))
  }
  const updateTask = (taskId: string, update: TransferTaskUpdate) => {
    setTasks((prev) => applyTransferTaskUpdate(prev, taskId, update))
  }

  const cancelTask = (taskId: string) => {
    const task = findTransferTask(getTasks(), taskId)
    void cancelTransferRuntimeTask({
      handles,
      taskId,
      task,
      cancelUploadTask: api.cancelUploadTask,
      cancelServerTransfer: api.cancelTransfer,
      markCancelled: (cancelledTaskId) => {
        setTasks((prev) => markTransferTaskCancelled(prev, cancelledTaskId))
      },
      logError: runtimeLogError,
    })
  }

  return {
    async restoreUploadTasks({ shouldSkip } = {}) {
      const response = await api.listUploadTasks()
      if (shouldSkip?.()) {
        return
      }

      const uploadTasks = response.tasks
        .filter((task) => task.status === "pending" || task.status === "uploading")
        .map((task) => mapUploadTaskStatusToTransferTask(task))
      if (uploadTasks.length === 0) {
        return
      }

      setTasks((prev) => mergeRestoredTransferTasks(prev, uploadTasks))
    },

    async uploadFile(serverId, remotePath, file, onProgress, enableWebSocket) {
      const created = await api.createUploadTask()
      const taskId = created.task_id
      const task = createUploadTransferTask({
        taskId,
        fileName: file.name,
        fileSizeBytes: file.size,
      })
      setTasks((prev) => appendTransferTask(prev, task))

      let releaseSlot: ReleaseTransferRuntimeSlot | null = null
      try {
        releaseSlot = await uploadLimiter.acquire()
      } catch {}

      if (consumeTransferCancelledBeforeStart(handles, task.id)) {
        updateTaskProgress(task.id, {
          status: "cancelled",
          error: "已取消",
        })
        releaseSlot?.()
        return null
      }

      let wsConnection: WebSocket | null = null
      try {
        if (enableWebSocket) {
          try {
            wsConnection = await createTransferProgressWebSocket({
              kind: "upload",
              taskId: task.id,
              createTicket,
              resolveWebSocketUrl,
              WebSocketCtor,
            })
            registerTransferWebSocket(handles, task.id, wsConnection)
          } catch (error) {
            logWarn("[transfer-manager] Failed to create upload WS ticket, fallback to non-WS upload:", error)
          }

          if (wsConnection) {
            bindUploadTransferProgressSocket({
              socket: wsConnection,
              taskId: task.id,
              fileSizeBytes: file.size,
              onTaskUpdate: updateTaskProgress,
              onProgress,
              logError: runtimeLogError,
            })
            await waitForTransferWebSocketOpen(wsConnection, { timeoutMs: 2000 })
          }
        }

        const fileInfo = await api.uploadFile(
          serverId,
          remotePath,
          file,
          createUploadHttpProgressHandler({
            taskId: task.id,
            fileSizeBytes: file.size,
            onTaskUpdate: updateTaskProgress,
            onProgress,
          }),
          task.id,
          (xhr) => {
            registerTransferXhr(handles, task.id, xhr)
          },
        )

        updateTaskProgress(task.id, {
          progress: 100,
          status: "completed",
          bytesTransferred: file.size,
          stage: "stream",
        })
        return fileInfo ?? null
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const isAborted = message === "Upload aborted" || message.toLowerCase().includes("upload cancelled")

        updateTaskProgress(task.id, {
          status: isAborted ? "cancelled" : "failed",
          error: isAborted ? "已取消" : message || "上传失败",
        })

        if (isAborted) {
          return null
        }
        throw error
      } finally {
        releaseSlot?.()
        releaseTransferRuntimeTaskHandles(handles, task.id, {
          closeWebSocket: !!wsConnection,
          includeConnecting: true,
        })
      }
    },

    cancelTask,

    removeTask(taskId) {
      cancelTask(taskId)
      setTasks((prev) => removeTransferTaskById(prev, taskId))
    },

    clearCompleted() {
      const completedTaskIds = getSettledTransferTaskIds(getTasks())
      clearTransferRuntimeTaskHandles(handles, {
        taskIds: completedTaskIds,
        abortXhrs: false,
      })
      setTasks((prev) => clearSettledTransferTasks(prev))
    },

    clearAll() {
      const tasks = getTasks()
      const activeTasks = getActiveTransferTasks(tasks)
      activeTasks.forEach((task) => {
        void cancelTransferRuntimeTask({
          handles,
          taskId: task.id,
          task,
          cancelUploadTask: api.cancelUploadTask,
          cancelServerTransfer: api.cancelTransfer,
          closeWebSocket: true,
          logError: runtimeLogError,
        })
      })
      clearTransferRuntimeTaskHandles(handles, {
        taskIds: getTransferTaskIds(tasks),
        clearCancellationMarkers: false,
      })
      setTasks(() => [])
    },

    createTransferTask(fileName, sourceServer, targetServer) {
      return createServerTransferTask({
        fileName,
        sourceServer,
        targetServer,
      })
    },

    addTask(task) {
      setTasks((prev) => appendTransferTask(prev, task))
    },

    updateTask,

    async directTransfer(sourceServerId, sourcePath, targetServerId, targetPath, sourceServerName, targetServerName, fileName) {
      const started = await api.directTransfer(sourceServerId, sourcePath, targetServerId, targetPath)
      const taskId = started.task_id
      const task = createServerTransferTask({
        taskId,
        fileName,
        sourceServer: sourceServerName,
        targetServer: targetServerName,
      })
      setTasks((prev) => appendTransferTask(prev, task))

      let wsConnection: WebSocket | null = null
      let isTransferFinished = () => false

      try {
        wsConnection = await createTransferProgressWebSocket({
          kind: "serverTransfer",
          taskId,
          createTicket,
          resolveWebSocketUrl,
          WebSocketCtor,
        })
        registerTransferWebSocket(handles, taskId, wsConnection)

        const transferWatcher = bindServerTransferProgressSocket({
          socket: wsConnection,
          taskId,
          handles,
          onTaskUpdate: updateTask,
          onUnexpectedClose: (closedTaskId) => {
            setTasks((prev) => {
              const currentTask = findTransferTask(prev, closedTaskId)
              if (currentTask && currentTask.status === "transferring") {
                return applyTransferTaskUpdate(prev, closedTaskId, {
                  status: "failed",
                  error: "连接断开",
                })
              }
              return [...prev]
            })
          },
          logError: runtimeLogError,
          logWarn: runtimeLogWarn,
        })
        isTransferFinished = transferWatcher.isTransferFinished

        await waitForTransferWebSocketOpen(wsConnection, {
          timeoutMs: 5000,
          rejectOnError: true,
        })
        await transferWatcher.completion
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const isCancelled = message.includes("取消") || message.includes("cancelled")

        if (!isCancelled && !isTransferFinished()) {
          updateTask(taskId, {
            status: "failed",
            error: message || "传输失败",
          })
          throw error
        }
      } finally {
        if (wsConnection) {
          releaseTransferRuntimeTaskHandles(handles, taskId, {
            closeWebSocket: true,
            includeConnecting: true,
          })
        }
      }
    },

    async cancelDirectTransfer(taskId) {
      const task = findTransferTask(getTasks(), taskId)
      await cancelTransferRuntimeTask({
        handles,
        taskId,
        task: task ?? { id: taskId, type: "transfer", status: "transferring" },
        cancelServerTransfer: api.cancelTransfer,
        markCancelled: (cancelledTaskId) => {
          updateTask(cancelledTaskId, {
            status: "cancelled",
            error: "已取消",
          })
        },
        logError: runtimeLogError,
      })
    },
  }
}
