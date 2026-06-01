import { sftpApi } from "@/lib/api/sftp"
import type { SftpDirectoryApi } from "./sftp-directory"
import type { SftpOperationsApi } from "./sftp-operations"

export type SftpBatchDownloadMode = "fast" | "compatible"

export interface SftpSessionApi extends SftpDirectoryApi, SftpOperationsApi {
  downloadFile: (serverId: string, path: string) => unknown
  readFile: (serverId: string, path: string) => Promise<string>
  batchDownload: (
    serverId: string,
    paths: string[],
    mode?: SftpBatchDownloadMode,
    excludePatterns?: string[],
  ) => Promise<void>
  chmod?: (serverId: string, path: string, mode: string) => Promise<unknown>
  closeConnection?: (serverId: string) => Promise<unknown>
}

export type SftpSessionApiAdapter = Partial<SftpSessionApi>

export const defaultSftpSessionApi: SftpSessionApi = sftpApi

export function createSftpSessionApi(adapter?: SftpSessionApiAdapter): SftpSessionApi {
  if (!adapter) {
    return defaultSftpSessionApi
  }

  const definedAdapter: SftpSessionApiAdapter = {}

  if (adapter.listDirectory) definedAdapter.listDirectory = adapter.listDirectory
  if (adapter.delete) definedAdapter.delete = adapter.delete
  if (adapter.createDirectory) definedAdapter.createDirectory = adapter.createDirectory
  if (adapter.writeFile) definedAdapter.writeFile = adapter.writeFile
  if (adapter.rename) definedAdapter.rename = adapter.rename
  if (adapter.batchDelete) definedAdapter.batchDelete = adapter.batchDelete
  if (adapter.downloadFile) definedAdapter.downloadFile = adapter.downloadFile
  if (adapter.readFile) definedAdapter.readFile = adapter.readFile
  if (adapter.batchDownload) definedAdapter.batchDownload = adapter.batchDownload
  if (adapter.chmod) definedAdapter.chmod = adapter.chmod
  if (adapter.closeConnection) definedAdapter.closeConnection = adapter.closeConnection

  return {
    ...defaultSftpSessionApi,
    ...definedAdapter,
  }
}
