export type { OptionalServerConnectionInfo, ServerConnectionInfo } from "./types"
export { SFTP_PARENT_ENTRY, loadSftpDirectory } from "./sftp-directory"
export type {
  LoadedSftpDirectory,
  LoadSftpDirectoryOptions,
  SftpDirectoryApi,
  SftpDirectoryItemBase,
} from "./sftp-directory"

export { TerminalWebSocket } from "@/lib/websocket-terminal"
export type {
  TerminalAuthMethod,
  TerminalAuthPrompt,
  TerminalAuthPromptItem,
  TerminalAuthPromptResponder,
  TerminalConnectionError,
  TerminalConnectionPhase,
  TerminalHostKeyPrompt,
  TerminalHostKeyResponder,
  TerminalLatencyData,
  TerminalWebSocketAuthTicketProvider,
  TerminalWebSocketAuthTicketRequest,
  TerminalWebSocketConstructor,
  TerminalWebSocketOptions,
  TerminalWebSocketUrlRequest,
  TerminalWebSocketUrlResolver,
} from "@/lib/websocket-terminal"

export { sftpApi } from "@/lib/api/sftp"
export type { DirectoryListResponse, FileInfo } from "@/lib/api/sftp"

export {
  convertSftpFileInfo,
  formatSftpModTime,
  formatSftpPermissions,
} from "@/lib/sftp-file-utils"
export type { SftpBackendFileInfo, SftpFileItem } from "@/lib/sftp-file-utils"

export {
  performBatchDelete,
  performCreateFile,
  performCreateFolder,
  performDelete,
  performRename,
  performSaveFile,
  upsertFileItem,
} from "./sftp-operations"
export type {
  BatchDeleteOperationConfig,
  BatchDeleteResult,
  CreateFileOperationConfig,
  CreateFolderOperationConfig,
  DeleteOperationConfig,
  RenameOperationConfig,
  SaveFileOperationConfig,
  SftpFileListUpdater,
  SftpOperationNotifier,
  SftpOperationsApi,
  TranslateFunction,
} from "./sftp-operations"

export { createSftpSessionApi, defaultSftpSessionApi } from "./sftp-session-api"
export type {
  SftpBatchDownloadMode,
  SftpSessionApi,
  SftpSessionApiAdapter,
} from "./sftp-session-api"

export {
  createServerTransferTask,
  createUploadTransferTask,
  mapTransferProgressMessageToTaskUpdate,
  mapUploadProgressMessageToTransferUpdate,
  mapUploadTaskStatusToTransferTask,
  mergeTransferTaskUpdate,
  normalizeTransferStage,
} from "./transfer-tasks"
export type {
  CreateServerTransferTaskOptions,
  CreateUploadTransferTaskOptions,
  MappedUploadProgressMessage,
  MapUploadProgressMessageOptions,
  TransferTask,
  TransferTaskUpdate,
  UploadProgressMessageLike,
} from "./transfer-tasks"

export {
  cancelTransferRuntimeTask,
  clearTransferRuntimeTaskHandles,
  closeTransferWebSocket,
  consumeTransferCancelledBeforeStart,
  createTransferConcurrencyLimiter,
  createTransferRuntimeHandleStore,
  createTransferProgressWebSocket,
  DEFAULT_TRANSFER_CONCURRENCY_LIMIT,
  isTransferCancellationRequested,
  isTransferRuntimeTaskActive,
  isTransferWebSocketActive,
  markTransferCancelledBeforeStart,
  registerTransferWebSocket,
  registerTransferXhr,
  releaseTransferRuntimeTaskHandles,
  sendTransferCancelMessage,
  waitForTransferWebSocketOpen,
} from "./transfer-runtime"
export type {
  CancelTransferRuntimeTaskOptions,
  ClearTransferRuntimeTaskHandlesOptions,
  CloseTransferWebSocketOptions,
  CreateTransferConcurrencyLimiterOptions,
  CreateTransferProgressWebSocketOptions,
  ReleaseTransferRuntimeTaskHandlesOptions,
  ReleaseTransferRuntimeSlot,
  TransferAuthTicketProvider,
  TransferConcurrencyLimiter,
  TransferAuthTicketRequest,
  TransferAuthTicketResponse,
  TransferProgressSocketKind,
  TransferRuntimeHandleStore,
  TransferRuntimeTaskLike,
  TransferRuntimeTaskType,
  TransferWebSocketConstructor,
  TransferWebSocketUrlResolver,
  WaitForTransferWebSocketOpenOptions,
} from "./transfer-runtime"

export type {
  SftpWorkspaceSession,
  SshWorkspaceAdapters,
  SshWorkspaceApiClient,
  SshWorkspaceAuthTicketProvider,
  SshWorkspaceCapabilities,
  SshWorkspaceI18n,
  SshWorkspaceLayout,
  SshWorkspaceNotifier,
  SshWorkspacePreferenceAdapter,
  SshWorkspaceProps,
  SshWorkspaceServerPicker,
  SshWorkspaceSessionStoreAdapter,
  SshWorkspaceSettingsAdapter,
  SshWorkspaceThemeAdapter,
  SshWorkspaceTransferManager,
  WorkspaceNotifierActionOptions,
  WorkspaceSessionSeed,
  WorkspaceSessionSnapshot,
  WorkspaceTerminalCredentialSaveRequest,
  WorkspaceTerminalSession,
  WorkspaceTransferStatus,
  WorkspaceTransferTask,
} from "./workspace"

export { DEFAULT_SFTP_DOWNLOAD_EXCLUDE_PATTERNS, parseWorkspaceDownloadExcludePatterns } from "./workspace-settings"
export type { WorkspaceDownloadExcludePatternSource } from "./workspace-settings"

export { createBrowserWorkspacePreferenceAdapter, createWorkspaceAdapters, createWorkspaceAuthTicketProviderAdapter, createWorkspaceI18nAdapter, createWorkspaceNotifierAdapter, createWorkspaceSettingsAdapter, createWorkspaceTerminalAuthTicketProviderAdapter, createWorkspaceTransferAuthTicketProviderAdapter, createWorkspaceTransferManagerAdapter } from "./workspace-adapters"
export type { CreateBrowserWorkspacePreferenceAdapterOptions, CreateWorkspaceAdaptersOptions, CreateWorkspaceI18nAdapterOptions, CreateWorkspaceSettingsAdapterOptions, CreateWorkspaceTransferManagerAdapterOptions, WorkspaceNotifierLike, WorkspacePreferenceStorageLike, WorkspaceTranslator, WorkspaceTranslatorLike } from "./workspace-adapters"
