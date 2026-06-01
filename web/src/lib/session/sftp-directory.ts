import { sftpApi, type DirectoryListResponse, type FileInfo } from "@/lib/api/sftp"
import type { SftpFileItem } from "@/lib/sftp-file-utils"

export type SftpDirectoryItemBase = Pick<
  SftpFileItem,
  "name" | "type" | "size" | "sizeBytes" | "modified" | "permissions"
>

export const SFTP_PARENT_ENTRY: SftpDirectoryItemBase = {
  name: "..",
  type: "directory",
  size: "-",
  sizeBytes: 0,
  modified: "",
  permissions: "drwxr-xr-x",
}

export interface SftpDirectoryApi {
  listDirectory: (serverId: string, path?: string) => Promise<DirectoryListResponse>
}

export interface LoadSftpDirectoryOptions<T extends SftpDirectoryItemBase> {
  serverId: string
  path?: string
  convertFileInfo: (info: FileInfo) => T
  withParentEntry?: boolean
  parentEntry?: T
  api?: SftpDirectoryApi
}

export interface LoadedSftpDirectory<T extends SftpDirectoryItemBase> {
  path: string
  parent?: string
  files: T[]
  raw: DirectoryListResponse
}

export async function loadSftpDirectory<T extends SftpDirectoryItemBase>({
  serverId,
  path = "/",
  convertFileInfo,
  withParentEntry = false,
  parentEntry,
  api = sftpApi,
}: LoadSftpDirectoryOptions<T>): Promise<LoadedSftpDirectory<T>> {
  const response = await api.listDirectory(serverId, path)
  const convertedFiles = response.files.map(convertFileInfo)
  const parentDirectoryEntry = (parentEntry ?? SFTP_PARENT_ENTRY) as T
  const files = withParentEntry && response.parent
    ? [parentDirectoryEntry, ...convertedFiles]
    : convertedFiles

  return {
    path: response.path,
    parent: response.parent,
    files,
    raw: response,
  }
}
