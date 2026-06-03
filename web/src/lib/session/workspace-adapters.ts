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
  SshWorkspaceTransferHistoryAdapter,
  SshWorkspaceTransferManager,
  SshWorkspaceActivityLogAdapter,
  WorkspaceActivityLogItem,
  WorkspaceActivityLogListResult,
  WorkspaceActivityLogStatistics,
  WorkspaceSessionSnapshot,
  WorkspaceTransferHistoryItem,
  WorkspaceTransferHistoryListResult,
  WorkspaceTransferHistoryStatistics,
  WorkspaceNotifierActionOptions,
  WorkspaceTransferTask,
} from "./workspace"
import type {
  OperationRecord,
  OperationRecordListParams,
  OperationRecordListResponse,
  OperationRecordStatistics,
  OperationRecordStatus,
} from "@/lib/api/operation-records"
import type { TransferAuthTicketProvider } from "./transfer-runtime"
import type { TerminalWebSocketAuthTicketProvider } from "@/lib/websocket-terminal"
import type {
  AuditLog,
  AuditLogListResponse,
  AuditLogStatisticsResponse,
} from "@/lib/api/logs"
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

export interface OperationRecordsTransferApiLike {
  list: (params?: OperationRecordListParams) => Promise<OperationRecordListResponse>
  getById: (id: string) => Promise<OperationRecord>
  getStatistics: (params?: Pick<OperationRecordListParams, "type" | "start_date" | "end_date">) => Promise<OperationRecordStatistics>
}

function parseOperationRecordDetail(record: OperationRecord): Record<string, unknown> {
  if (!record.detail_json) {
    return {}
  }
  try {
    const parsed = JSON.parse(record.detail_json)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function detailString(detail: Record<string, unknown>, key: string): string | undefined {
  const value = detail[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function mapOperationRecordStatusToWorkspaceTransferStatus(status: OperationRecordStatus): WorkspaceTransferHistoryItem["status"] {
  if (status === "success") {
    return "completed"
  }
  if (status === "pending") {
    return "pending"
  }
  if (status === "running") {
    return "transferring"
  }
  return "failed"
}

function mapOperationRecordActionToTransferType(action: string): WorkspaceTransferHistoryItem["transferType"] {
  if (action.includes("download")) {
    return "download"
  }
  if (action.includes("transfer")) {
    return "transfer"
  }
  return "upload"
}

function mapWorkspaceTransferHistoryStatusToOperationRecordStatus(
  status?: WorkspaceTransferHistoryItem["status"],
): OperationRecordStatus | undefined {
  if (status === "completed") {
    return "success"
  }
  if (status === "failed") {
    return "failure"
  }
  if (status === "transferring") {
    return "running"
  }
  return status
}

export function mapOperationRecordToWorkspaceHistoryItem(
  record: OperationRecord,
): WorkspaceTransferHistoryItem {
  const detail = parseOperationRecordDetail(record)
  const sourcePath = detailString(detail, "source_path") ?? record.resource
  const destPath = detailString(detail, "dest_path") ?? detailString(detail, "target_path") ?? ""
  const fileName = detailString(detail, "file_name") ?? record.title ?? sourcePath.split("/").filter(Boolean).pop() ?? record.action

  return {
    id: record.id,
    serverId: record.server_id ?? "",
    sessionId: detailString(detail, "session_id"),
    transferType: mapOperationRecordActionToTransferType(record.action),
    sourcePath,
    destPath,
    fileName,
    fileSizeBytes: record.bytes_total,
    status: mapOperationRecordStatusToWorkspaceTransferStatus(record.status),
    progress: record.progress,
    bytesTransferred: record.bytes_processed,
    startedAt: record.started_at,
    completedAt: record.finished_at,
    durationSeconds: record.duration_ms ? Math.round(record.duration_ms / 1000) : undefined,
    speedBytesPerSecond: record.speed_bps,
    errorMessage: record.error_message,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

export function mapOperationRecordListToWorkspaceHistoryResult(
  response: OperationRecordListResponse,
): WorkspaceTransferHistoryListResult {
  return {
    items: response.records.map(mapOperationRecordToWorkspaceHistoryItem),
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
    totalPages: response.total_pages,
  }
}

export function mapOperationRecordStatisticsToWorkspaceStatistics(
  statistics: OperationRecordStatistics,
): WorkspaceTransferHistoryStatistics {
  return {
    totalTransfers: statistics.total,
    completedTransfers: statistics.success_count,
    failedTransfers: statistics.failure_count,
    totalBytesUploaded: 0,
    totalBytesDownloaded: 0,
    byType: statistics.by_type,
    byStatus: statistics.by_status,
  }
}

export function createWorkspaceTransferHistoryAdapter(
  api: OperationRecordsTransferApiLike,
): SshWorkspaceTransferHistoryAdapter {
  return {
    async list(params) {
      const response = await api.list({
        page: params?.page,
        page_size: params?.limit,
        status: mapWorkspaceTransferHistoryStatusToOperationRecordStatus(params?.status),
        type: "transfer",
        action: params?.transferType,
        server_id: params?.serverId,
      })
      return mapOperationRecordListToWorkspaceHistoryResult(response)
    },
    async getById(id) {
      return mapOperationRecordToWorkspaceHistoryItem(await api.getById(id))
    },
    async getStatistics() {
      return mapOperationRecordStatisticsToWorkspaceStatistics(await api.getStatistics({ type: "transfer" }))
    },
  }
}

export interface WorkspaceLogsApiLike {
  list: (params?: {
    page?: number
    page_size?: number
    user_id?: string
    server_id?: string
    action?: string
    category?: "activity" | "audit"
    status?: string
    start_date?: string
    end_date?: string
  }) => Promise<AuditLogListResponse>
  getById: (id: string) => Promise<AuditLog>
  getStatistics: (params?: {
    category?: "activity" | "audit"
    start_date?: string
    end_date?: string
  }) => Promise<AuditLogStatisticsResponse>
}

export function mapAuditLogToWorkspaceActivityLogItem(log: AuditLog): WorkspaceActivityLogItem {
  return {
    id: log.id,
    action: log.action,
    resource: log.resource,
    status: log.status,
    serverId: log.server_id,
    durationMs: log.duration,
    detail: log.error_msg || log.details,
    createdAt: log.created_at,
  }
}

export function mapAuditLogListToWorkspaceActivityResult(
  response: AuditLogListResponse,
): WorkspaceActivityLogListResult {
  return {
    items: response.logs.map(mapAuditLogToWorkspaceActivityLogItem),
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
    totalPages: response.total_pages,
  }
}

export function mapAuditLogStatisticsToWorkspaceActivityStatistics(
  statistics: AuditLogStatisticsResponse,
): WorkspaceActivityLogStatistics {
  return {
    total: statistics.total_logs,
    successCount: statistics.success_count,
    failureCount: statistics.failure_count,
    byAction: statistics.action_stats,
  }
}

export function createWorkspaceActivityLogAdapter(
  api: WorkspaceLogsApiLike,
): SshWorkspaceActivityLogAdapter {
  return {
    async list(params) {
      const response = await api.list({
        page: params?.page,
        page_size: params?.limit,
        category: "activity",
        action: params?.action,
        server_id: params?.serverId,
        status: params?.status,
        start_date: params?.startDate,
        end_date: params?.endDate,
      })
      return mapAuditLogListToWorkspaceActivityResult(response)
    },
    async getById(id) {
      return mapAuditLogToWorkspaceActivityLogItem(await api.getById(id))
    },
    async getStatistics(params) {
      return mapAuditLogStatisticsToWorkspaceActivityStatistics(await api.getStatistics({
        category: "activity",
        start_date: params?.startDate,
        end_date: params?.endDate,
      }))
    },
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
  activityLog?: SshWorkspaceActivityLogAdapter
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
  activityLog,
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
    activityLog,
    sessionStore,
    sessionController,
  }
}
