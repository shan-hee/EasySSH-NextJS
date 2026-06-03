import type { BatchDeleteResponse, DirectoryListResponse, FileInfo } from "@/lib/api/sftp"
import type { SftpFileItem } from "@/lib/sftp-file-utils"
import type { OptionalServerConnectionInfo, ServerConnectionInfo } from "./types"
import type { TerminalConnectionPhase, TerminalWebSocketUrlResolver } from "@/lib/websocket-terminal"
import type { SftpBatchDownloadMode } from "./sftp-session-api"

export type SshWorkspaceLayout = "web" | "desktop" | "embedded"

export interface SshWorkspaceCapabilities {
  terminal?: boolean
  sftp?: boolean
  transfers?: boolean
  fullscreen?: boolean
  crossSessionDrag?: boolean
  ai?: boolean
  monitor?: boolean
  docker?: boolean
  activityLog?: boolean
}

export interface WorkspaceSessionSeed extends ServerConnectionInfo {
  initialPath?: string
}


export interface WorkspaceTerminalSession extends OptionalServerConnectionInfo {
  id: string
  shouldConnect: boolean
  connectionPhase: TerminalConnectionPhase
  status: "connected" | "disconnected" | "reconnecting"
  lastActivity: number
  group?: string
  tags?: string[]
  pinned?: boolean
  type?: "config" | "terminal"
}
export interface SftpWorkspaceSession extends ServerConnectionInfo {
  id: string
  currentPath: string
  files: SftpFileItem[]
  isConnected: boolean
  isLoading?: boolean
  label: string
  color?: string
}

export type WorkspaceTransferStatus =
  | "pending"
  | "uploading"
  | "downloading"
  | "transferring"
  | "completed"
  | "failed"
  | "cancelled"

export interface WorkspaceTransferTask {
  id: string
  fileName: string
  fileSize: string
  fileSizeBytes: number
  progress: number
  status: WorkspaceTransferStatus
  type: "upload" | "download" | "transfer"
  speed?: string
  timeRemaining?: string
  error?: string
  startTime?: number
  bytesTransferred?: number
  stage?: "http" | "sftp" | "stream"
  sourceServer?: string
  targetServer?: string
  transferMethod?: "rsync" | "scp" | "sftp"
}

export interface WorkspaceSessionSnapshot {
  terminalSessions: WorkspaceTerminalSession[]
  sftpSessions: SftpWorkspaceSession[]
  transferTasks: WorkspaceTransferTask[]
  activeSessionId?: string | null
}

export interface WorkspaceNotifierActionOptions {
  description?: string
  actionLabel: string
  onAction: () => void
}

export interface SshWorkspaceNotifier {
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

export interface SshWorkspaceI18n {
  t: (namespace: string, key: string, params?: Record<string, string | number>) => string
  locale?: string
  timezone?: string
}

export interface WorkspaceTerminalCredentialSaveRequest {
  serverId: string
  authMethod: "password" | "key"
  secret: string
}

export interface SshWorkspaceApiClient {
  sftp?: {
    listDirectory: (serverId: string, path?: string) => Promise<DirectoryListResponse>
    downloadFile?: (serverId: string, path: string) => unknown
    uploadFile?: (serverId: string, path: string, file: File) => Promise<unknown>
    delete?: (serverId: string, path: string) => Promise<FileInfo>
    rename?: (serverId: string, oldPath: string, newPath: string) => Promise<FileInfo>
    createDirectory?: (serverId: string, path: string) => Promise<FileInfo>
    readFile?: (serverId: string, path: string) => Promise<string>
    writeFile?: (serverId: string, path: string, content: string) => Promise<FileInfo>
    chmod?: (serverId: string, path: string, mode: string) => Promise<unknown>
    batchDelete?: (serverId: string, paths: string[]) => Promise<BatchDeleteResponse>
    batchDownload?: (
      serverId: string,
      paths: string[],
      mode?: SftpBatchDownloadMode,
      excludePatterns?: string[],
    ) => Promise<void>
    closeConnection?: (serverId: string) => Promise<unknown>
  }
  terminal?: {
    createWebSocketUrl?: TerminalWebSocketUrlResolver
    saveVerifiedCredential?: (request: WorkspaceTerminalCredentialSaveRequest) => Promise<unknown>
  }
}

export interface SshWorkspaceThemeAdapter {
  mode?: "light" | "dark" | "system"
  terminalTheme?: "default" | "dark" | "light" | "solarized" | "dracula"
}

export interface SshWorkspacePaneAdapter {
  fileManager?: {
    mountMode?: "terminal" | "page"
    anchorTop?: number
  }
}

export interface SshWorkspaceSettingsAdapter {
  sftp?: {
    downloadExcludePatterns?: string[]
  }
}

export interface SshWorkspacePreferenceAdapter {
  getString: (key: string) => string | null | undefined
  setString: (key: string, value: string) => void | Promise<void>
  removeString?: (key: string) => void | Promise<void>
}

export interface SshWorkspaceServerPicker {
  open: () => Promise<WorkspaceSessionSeed | null>
}

export type WorkspaceSessionListUpdater<TSession> =
  | TSession[]
  | ((sessions: TSession[]) => TSession[])

export interface SshWorkspaceTerminalSessionController {
  getSessions: () => WorkspaceTerminalSession[]
  getActiveSessionId: () => string | null
  setSessions: (updater: WorkspaceSessionListUpdater<WorkspaceTerminalSession>) => void
  addSession: (session: WorkspaceTerminalSession) => void
  updateSession: (sessionId: string, update: Partial<WorkspaceTerminalSession>) => void
  activateSession: (sessionId: string | null) => void
  closeSession: (sessionId: string) => void
  reset: () => void
}

export interface SshWorkspaceSftpSessionController {
  getSessions: () => SftpWorkspaceSession[]
  getActiveSessionId: () => string | null
  setSessions: (updater: WorkspaceSessionListUpdater<SftpWorkspaceSession>) => void
  addSession: (session: SftpWorkspaceSession) => void
  updateSession: (sessionId: string, update: Partial<SftpWorkspaceSession>) => void
  activateSession: (sessionId: string | null) => void
  closeSession: (sessionId: string) => void
  setFullscreenSession?: (sessionId: string | null) => void
  reset: () => void
}

export interface SshWorkspaceSessionController {
  terminal?: SshWorkspaceTerminalSessionController
  sftp?: SshWorkspaceSftpSessionController
  resetAll?: () => void
}

export type SshWorkspaceAuthTicketProvider = (
  scope: string,
  payload?: Record<string, unknown>,
) => Promise<string>

export type WorkspaceTransferHistoryStatus = "pending" | "transferring" | "completed" | "failed"
export type WorkspaceTransferHistoryType = "upload" | "download" | "transfer"

export interface WorkspaceTransferHistoryItem {
  id: string
  serverId: string
  sessionId?: string
  transferType: WorkspaceTransferHistoryType
  sourcePath: string
  destPath: string
  fileName: string
  fileSizeBytes: number
  status: WorkspaceTransferHistoryStatus
  progress: number
  bytesTransferred: number
  startedAt?: string
  completedAt?: string
  durationSeconds?: number
  speedBytesPerSecond?: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceTransferHistoryListParams {
  page?: number
  limit?: number
  status?: WorkspaceTransferHistoryStatus
  transferType?: WorkspaceTransferHistoryType
  serverId?: string
}

export interface WorkspaceTransferHistoryListResult {
  items: WorkspaceTransferHistoryItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface WorkspaceTransferHistoryStatistics {
  totalTransfers: number
  completedTransfers: number
  failedTransfers: number
  totalBytesUploaded: number
  totalBytesDownloaded: number
  byType: Record<string, number>
  byStatus: Record<string, number>
}

export interface SshWorkspaceTransferHistoryAdapter {
  list: (params?: WorkspaceTransferHistoryListParams) => Promise<WorkspaceTransferHistoryListResult>
  getById?: (id: string) => Promise<WorkspaceTransferHistoryItem>
  getStatistics?: () => Promise<WorkspaceTransferHistoryStatistics>
  delete?: (id: string) => Promise<unknown>
}

export type WorkspaceActivityLogStatus = "success" | "failure" | "warning"

export interface WorkspaceActivityLogItem {
  id: string
  action: string
  resource: string
  status: WorkspaceActivityLogStatus
  serverId?: string
  durationMs?: number
  detail?: string
  createdAt: string
}

export interface WorkspaceActivityLogListParams {
  page?: number
  limit?: number
  action?: string
  serverId?: string
  status?: WorkspaceActivityLogStatus
  startDate?: string
  endDate?: string
}

export interface WorkspaceActivityLogListResult {
  items: WorkspaceActivityLogItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface WorkspaceActivityLogStatistics {
  total: number
  successCount: number
  failureCount: number
  byAction: Record<string, number>
}

export interface WorkspaceActivityLogRecordInput {
  action: string
  resource: string
  status: WorkspaceActivityLogStatus
  serverId?: string
  durationMs?: number
  detail?: string
}

export interface SshWorkspaceActivityLogAdapter {
  list: (params?: WorkspaceActivityLogListParams) => Promise<WorkspaceActivityLogListResult>
  getById?: (id: string) => Promise<WorkspaceActivityLogItem>
  getStatistics?: (params?: Pick<WorkspaceActivityLogListParams, "startDate" | "endDate">) => Promise<WorkspaceActivityLogStatistics>
  record?: (input: WorkspaceActivityLogRecordInput) => Promise<unknown>
  clear?: (before?: string) => Promise<unknown>
}

export interface SshWorkspaceTransferManager {
  tasks: WorkspaceTransferTask[]
  downloadFile?: (serverId: string, remotePath: string, fileName?: string) => Promise<void> | void
  batchDownload?: (
    serverId: string,
    remotePaths: string[],
    mode?: SftpBatchDownloadMode,
    excludePatterns?: string[],
  ) => Promise<void>
  uploadFile?: (
    serverId: string,
    remotePath: string,
    file: File,
    onProgress?: (loaded: number, total: number) => void,
    enableWebSocket?: boolean,
  ) => Promise<FileInfo | null>
  directTransfer?: (
    sourceServerId: string,
    sourcePath: string,
    targetServerId: string,
    targetPath: string,
    sourceServerName: string,
    targetServerName: string,
    fileName: string,
  ) => Promise<void>
  createTransferTask?: (
    fileName: string,
    sourceServer: string,
    targetServer: string,
  ) => WorkspaceTransferTask
  addTask?: (task: WorkspaceTransferTask) => void
  updateTask?: (taskId: string, update: Partial<WorkspaceTransferTask>) => void
  removeTask?: (taskId: string) => void
  clearAll?: () => void
  clearCompleted?: () => void
  cancelTask?: (taskId: string) => void
  cancelDirectTransfer?: (taskId: string) => Promise<void>
  history?: SshWorkspaceTransferHistoryAdapter
}

export interface SshWorkspaceSessionStoreAdapter {
  getSnapshot: () => WorkspaceSessionSnapshot
  subscribe?: (listener: (snapshot: WorkspaceSessionSnapshot) => void) => () => void
}

export interface SshWorkspaceAdapters {
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

export interface SshWorkspaceProps {
  adapters: SshWorkspaceAdapters
  capabilities: SshWorkspaceCapabilities
  initialSessions?: WorkspaceSessionSeed[]
  layout?: SshWorkspaceLayout
  onSessionChange?: (snapshot: WorkspaceSessionSnapshot) => void
}
