import type {
  SshWorkspaceAdapters,
  SshWorkspaceApiClient,
  SshWorkspaceAuthTicketProvider,
  SshWorkspaceI18n,
  SshWorkspaceNotifier,
  SshWorkspacePaneAdapter,
  SshWorkspacePreferenceAdapter,
  SshWorkspaceServerPicker,
  SshWorkspaceSessionController,
  SshWorkspaceSessionStoreAdapter,
  SshWorkspaceSettingsAdapter,
  SshWorkspaceThemeAdapter,
  SshWorkspaceTransferManager,
  WorkspaceSessionSnapshot,
  WorkspaceTransferHistoryAdapter,
  WorkspaceTransferHistoryItem,
  WorkspaceTransferHistoryListResult,
  WorkspaceTransferHistoryStatistics,
  WorkspaceNotifierActionOptions,
  WorkspaceTransferTask,
} from "./workspace"
import type {
  FileTransfer,
  FileTransferStatistics,
  ListFileTransfersParams,
  ListFileTransfersResponse,
} from "@/lib/api/file-transfers"
import type { TransferAuthTicketProvider } from "./transfer-runtime"
import type { TerminalWebSocketAuthTicketProvider } from "@/lib/websocket-terminal"
import {
  parseWorkspaceDownloadExcludePatterns,
  type WorkspaceDownloadExcludePatternSource,
} from "./workspace-settings"

export type WorkspaceTranslator = (key: string, params?: Record<string, string | number>) => string
export type WorkspaceTranslatorLike = unknown

export interface CreateWorkspaceI18nAdapterOptions {
  locale?: string
  timezone?: string
  common?: WorkspaceTranslatorLike
  terminal?: WorkspaceTranslatorLike
  sftp?: WorkspaceTranslatorLike
  fallback?: WorkspaceTranslatorLike
}

export function createWorkspaceI18nAdapter({
  locale,
  timezone,
  common,
  terminal,
  sftp,
  fallback,
}: CreateWorkspaceI18nAdapterOptions): SshWorkspaceI18n {
  const call = (translator: WorkspaceTranslatorLike | undefined, key: string, params?: Record<string, string | number>) => {
    if (typeof translator !== "function") {
      return undefined
    }

    return (translator as WorkspaceTranslator)(key, params)
  }
  const resolve = (translator: WorkspaceTranslatorLike | undefined, key: string, params?: Record<string, string | number>) =>
    call(translator, key, params) ?? call(fallback, key, params) ?? key

  return {
    locale,
    timezone,
    t(namespace, key, params) {
      if (namespace === "common") {
        return resolve(common, key, params)
      }
      if (namespace === "terminal") {
        return resolve(terminal, key, params)
      }
      if (namespace === "sftp") {
        return resolve(sftp, key, params)
      }
      return resolve(fallback, key, params)
    },
  }
}

export interface WorkspaceNotifierLike {
  success: (message: string) => unknown
  error: (message: string) => unknown
  action?: (message: string, options: WorkspaceNotifierActionOptions) => unknown
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: unknown) => string)
    },
  ) => unknown
}

export function createWorkspaceNotifierAdapter(notifier: WorkspaceNotifierLike): SshWorkspaceNotifier {
  const callableNotifier = typeof notifier === "function"
    ? notifier as ((message: string, options?: unknown) => unknown)
    : null
  const action = notifier.action ?? (callableNotifier
    ? (message: string, options: WorkspaceNotifierActionOptions) => callableNotifier(message, {
        description: options.description,
        action: {
          label: options.actionLabel,
          onClick: options.onAction,
        },
      })
    : undefined)

  const workspaceNotifier: SshWorkspaceNotifier = {
    success: notifier.success,
    error: notifier.error,
    promise: notifier.promise,
  }

  if (action) {
    workspaceNotifier.action = action
  }

  return workspaceNotifier
}

export function createWorkspaceAuthTicketProviderAdapter<TInput extends { type: string }>(
  createTicket: (input: TInput) => Promise<{ ticket: string }>,
): SshWorkspaceAuthTicketProvider {
  return async (scope, payload) => {
    const { ticket } = await createTicket({
      ...(payload ?? {}),
      type: scope,
    } as TInput)
    return ticket
  }
}

export function createWorkspaceTerminalAuthTicketProviderAdapter(
  authTicketProvider: SshWorkspaceAuthTicketProvider,
): TerminalWebSocketAuthTicketProvider
export function createWorkspaceTerminalAuthTicketProviderAdapter(
  authTicketProvider?: SshWorkspaceAuthTicketProvider,
): TerminalWebSocketAuthTicketProvider | undefined
export function createWorkspaceTerminalAuthTicketProviderAdapter(
  authTicketProvider?: SshWorkspaceAuthTicketProvider,
): TerminalWebSocketAuthTicketProvider | undefined {
  if (!authTicketProvider) {
    return undefined
  }

  return ({ type, server_id }) => authTicketProvider(type, { server_id })
}

export function createWorkspaceTransferAuthTicketProviderAdapter(
  authTicketProvider: SshWorkspaceAuthTicketProvider,
): TransferAuthTicketProvider
export function createWorkspaceTransferAuthTicketProviderAdapter(
  authTicketProvider?: SshWorkspaceAuthTicketProvider,
): TransferAuthTicketProvider | undefined
export function createWorkspaceTransferAuthTicketProviderAdapter(
  authTicketProvider?: SshWorkspaceAuthTicketProvider,
): TransferAuthTicketProvider | undefined {
  if (!authTicketProvider) {
    return undefined
  }

  return async ({ type, task_id }) => ({
    ticket: await authTicketProvider(type, { task_id }),
  })
}

export interface CreateWorkspaceTransferManagerAdapterOptions {
  tasks: WorkspaceTransferTask[]
  downloadFile?: SshWorkspaceTransferManager["downloadFile"]
  batchDownload?: SshWorkspaceTransferManager["batchDownload"]
  uploadFile?: SshWorkspaceTransferManager["uploadFile"]
  directTransfer?: SshWorkspaceTransferManager["directTransfer"]
  createTransferTask?: SshWorkspaceTransferManager["createTransferTask"]
  addTask?: SshWorkspaceTransferManager["addTask"]
  updateTask?: SshWorkspaceTransferManager["updateTask"]
  removeTask?: SshWorkspaceTransferManager["removeTask"]
  clearAll?: SshWorkspaceTransferManager["clearAll"]
  clearCompleted?: () => void
  cancelTask?: (taskId: string) => void
  cancelDirectTransfer?: SshWorkspaceTransferManager["cancelDirectTransfer"]
  history?: SshWorkspaceTransferManager["history"]
}

export function createWorkspaceTransferManagerAdapter({
  tasks,
  downloadFile,
  batchDownload,
  uploadFile,
  directTransfer,
  createTransferTask,
  addTask,
  updateTask,
  removeTask,
  clearAll,
  clearCompleted,
  cancelTask,
  cancelDirectTransfer,
  history,
}: CreateWorkspaceTransferManagerAdapterOptions): SshWorkspaceTransferManager {
  const transferManager: SshWorkspaceTransferManager = {
    tasks,
  }

  if (downloadFile) {
    transferManager.downloadFile = downloadFile
  }
  if (batchDownload) {
    transferManager.batchDownload = batchDownload
  }
  if (uploadFile) {
    transferManager.uploadFile = uploadFile
  }
  if (directTransfer) {
    transferManager.directTransfer = directTransfer
  }
  if (createTransferTask) {
    transferManager.createTransferTask = createTransferTask
  }
  if (addTask) {
    transferManager.addTask = addTask
  }
  if (updateTask) {
    transferManager.updateTask = updateTask
  }
  if (removeTask) {
    transferManager.removeTask = removeTask
  }
  if (clearAll) {
    transferManager.clearAll = clearAll
  }
  if (clearCompleted) {
    transferManager.clearCompleted = clearCompleted
  }
  if (cancelTask) {
    transferManager.cancelTask = cancelTask
  }
  if (cancelDirectTransfer) {
    transferManager.cancelDirectTransfer = cancelDirectTransfer
  }
  if (history) {
    transferManager.history = history
  }

  return transferManager
}

export interface FileTransfersApiLike {
  list: (params?: ListFileTransfersParams) => Promise<ListFileTransfersResponse>
  getById: (id: string) => Promise<FileTransfer>
  getStatistics: () => Promise<FileTransferStatistics>
  delete: (id: string) => Promise<unknown>
}

export function mapFileTransferToWorkspaceHistoryItem(
  transfer: FileTransfer,
): WorkspaceTransferHistoryItem {
  return {
    id: transfer.id,
    serverId: transfer.server_id,
    sessionId: transfer.session_id,
    transferType: transfer.transfer_type,
    sourcePath: transfer.source_path,
    destPath: transfer.dest_path,
    fileName: transfer.file_name,
    fileSizeBytes: transfer.file_size,
    status: transfer.status,
    progress: transfer.progress,
    bytesTransferred: transfer.bytes_transferred,
    startedAt: transfer.started_at,
    completedAt: transfer.completed_at,
    durationSeconds: transfer.duration,
    speedBytesPerSecond: transfer.speed,
    errorMessage: transfer.error_message,
    createdAt: transfer.created_at,
    updatedAt: transfer.updated_at,
  }
}

export function mapFileTransferListToWorkspaceHistoryResult(
  response: ListFileTransfersResponse,
): WorkspaceTransferHistoryListResult {
  return {
    items: response.data.map(mapFileTransferToWorkspaceHistoryItem),
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
    totalPages: response.total_pages,
  }
}

export function mapFileTransferStatisticsToWorkspaceStatistics(
  statistics: FileTransferStatistics,
): WorkspaceTransferHistoryStatistics {
  return {
    totalTransfers: statistics.total_transfers,
    completedTransfers: statistics.completed_transfers,
    failedTransfers: statistics.failed_transfers,
    totalBytesUploaded: statistics.total_bytes_uploaded,
    totalBytesDownloaded: statistics.total_bytes_downloaded,
    byType: statistics.by_type,
    byStatus: statistics.by_status,
  }
}

export function createWorkspaceTransferHistoryAdapter(
  api: FileTransfersApiLike,
): WorkspaceTransferHistoryAdapter {
  return {
    async list(params) {
      const response = await api.list({
        page: params?.page,
        limit: params?.limit,
        status: params?.status,
        transfer_type: params?.transferType,
        server_id: params?.serverId,
      })
      return mapFileTransferListToWorkspaceHistoryResult(response)
    },
    async getById(id) {
      return mapFileTransferToWorkspaceHistoryItem(await api.getById(id))
    },
    async getStatistics() {
      return mapFileTransferStatisticsToWorkspaceStatistics(await api.getStatistics())
    },
    delete: api.delete,
  }
}

export interface CreateCompositeWorkspaceSessionStoreAdapterOptions {
  stores: SshWorkspaceSessionStoreAdapter[]
  getTransferTasks?: () => WorkspaceTransferTask[]
  getActiveSessionId?: (snapshots: readonly WorkspaceSessionSnapshot[]) => string | null | undefined
}

export function createCompositeWorkspaceSessionStoreAdapter({
  stores,
  getTransferTasks,
  getActiveSessionId,
}: CreateCompositeWorkspaceSessionStoreAdapterOptions): SshWorkspaceSessionStoreAdapter {
  const readSnapshots = () => stores.map((store) => store.getSnapshot())
  const mergeSnapshots = (snapshots: readonly WorkspaceSessionSnapshot[]): WorkspaceSessionSnapshot => ({
    terminalSessions: snapshots.flatMap((snapshot) => snapshot.terminalSessions),
    sftpSessions: snapshots.flatMap((snapshot) => snapshot.sftpSessions),
    transferTasks: getTransferTasks?.() ?? snapshots.flatMap((snapshot) => snapshot.transferTasks),
    activeSessionId:
      getActiveSessionId?.(snapshots)
      ?? snapshots.find((snapshot) => snapshot.activeSessionId)?.activeSessionId
      ?? null,
  })

  return {
    getSnapshot: () => mergeSnapshots(readSnapshots()),
    subscribe: (listener) => {
      const emit = () => listener(mergeSnapshots(readSnapshots()))
      const unsubscribers = stores
        .map((store) => store.subscribe?.(emit))
        .filter((unsubscribe): unsubscribe is () => void => typeof unsubscribe === "function")

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe())
      }
    },
  }
}

export function createCompositeWorkspaceSessionController(
  ...controllers: Array<SshWorkspaceSessionController | undefined | null>
): SshWorkspaceSessionController {
  const merged: SshWorkspaceSessionController = {}

  for (const controller of controllers) {
    if (!controller) {
      continue
    }

    if (controller.terminal) {
      merged.terminal = controller.terminal
    }
    if (controller.sftp) {
      merged.sftp = controller.sftp
    }
  }

  if (controllers.some((controller) => controller?.resetAll)) {
    merged.resetAll = () => {
      controllers.forEach((controller) => controller?.resetAll?.())
    }
  }

  return merged
}

export interface CreateWorkspaceSettingsAdapterOptions {
  sftp?: {
    downloadExcludePatterns?: WorkspaceDownloadExcludePatternSource
  }
}

export function createWorkspaceSettingsAdapter({
  sftp,
}: CreateWorkspaceSettingsAdapterOptions = {}): SshWorkspaceSettingsAdapter {
  if (!sftp) {
    return {}
  }

  return {
    sftp: {
      downloadExcludePatterns: parseWorkspaceDownloadExcludePatterns(sftp.downloadExcludePatterns),
    },
  }
}

export interface WorkspacePreferenceStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem?: (key: string) => void
}

export interface CreateBrowserWorkspacePreferenceAdapterOptions {
  storage?: WorkspacePreferenceStorageLike | null
  keyPrefix?: string
}

export function createBrowserWorkspacePreferenceAdapter({
  storage,
  keyPrefix = "",
}: CreateBrowserWorkspacePreferenceAdapterOptions = {}): SshWorkspacePreferenceAdapter {
  const resolveStorage = () => {
    if (storage !== undefined) {
      return storage
    }

    return typeof window !== "undefined" ? window.localStorage : null
  }
  const resolveKey = (key: string) => `${keyPrefix}${key}`

  return {
    getString(key) {
      try {
        return resolveStorage()?.getItem(resolveKey(key)) ?? null
      } catch {
        return null
      }
    },
    setString(key, value) {
      try {
        resolveStorage()?.setItem(resolveKey(key), value)
      } catch {}
    },
    removeString(key) {
      try {
        resolveStorage()?.removeItem?.(resolveKey(key))
      } catch {}
    },
  }
}

export interface CreateWorkspaceAdaptersOptions {
  apiClient?: SshWorkspaceApiClient
  authTicketProvider?: SshWorkspaceAuthTicketProvider
  i18n: SshWorkspaceI18n
  notifier: SshWorkspaceNotifier
  theme?: SshWorkspaceThemeAdapter
  panes?: SshWorkspacePaneAdapter
  settings?: SshWorkspaceSettingsAdapter
  preferences?: SshWorkspacePreferenceAdapter
  serverPicker?: SshWorkspaceServerPicker
  transferManager?: SshWorkspaceTransferManager
  sessionStore?: SshWorkspaceSessionStoreAdapter
  sessionController?: SshWorkspaceSessionController
}

export function createWorkspaceAdapters({
  apiClient,
  authTicketProvider,
  i18n,
  notifier,
  theme,
  panes,
  settings,
  preferences,
  serverPicker,
  transferManager,
  sessionStore,
  sessionController,
}: CreateWorkspaceAdaptersOptions): SshWorkspaceAdapters {
  return {
    apiClient,
    authTicketProvider,
    i18n,
    notifier,
    theme,
    panes,
    settings,
    preferences,
    serverPicker,
    transferManager,
    sessionStore,
    sessionController,
  }
}
