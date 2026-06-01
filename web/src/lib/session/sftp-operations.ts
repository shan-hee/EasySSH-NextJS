import { sftpApi, type BatchDeleteResponse, type FileInfo } from "@/lib/api/sftp"
import { getErrorMessage } from "@/lib/error-utils"

export type TranslateFunction = (key: string, params?: Record<string, string | number>) => string
export type SftpFileListUpdater<T> = (updater: T[] | ((files: T[]) => T[])) => void

export interface SftpOperationsApi {
  delete: (serverId: string, path: string) => Promise<FileInfo>
  createDirectory: (serverId: string, path: string) => Promise<FileInfo>
  writeFile: (serverId: string, path: string, content: string) => Promise<FileInfo>
  rename: (serverId: string, oldPath: string, newPath: string) => Promise<FileInfo>
  batchDelete: (serverId: string, paths: string[]) => Promise<BatchDeleteResponse>
}

export interface SftpOperationNotifier {
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: unknown) => string)
    },
  ) => unknown
  error?: (message: string) => unknown
}

export const upsertFileItem = <T extends { name: string }>(items: T[], item: T): T[] => {
  const index = items.findIndex((file) => file.name === item.name)
  if (index === -1) {
    return [...items, item]
  }

  const next = [...items]
  next[index] = item
  return next
}

const joinRemotePath = (currentPath: string, name: string): string => (
  currentPath.endsWith("/")
    ? `${currentPath}${name}`
    : `${currentPath}/${name}`
)

export interface DeleteOperationConfig<T extends { name: string }> {
  serverId: string
  currentPath: string
  fileName: string
  t: TranslateFunction
  notifier: SftpOperationNotifier
  setFiles: SftpFileListUpdater<T>
  api?: SftpOperationsApi
}

export async function performDelete<T extends { name: string }>({
  serverId,
  currentPath,
  fileName,
  t,
  notifier,
  setFiles,
  api = sftpApi,
}: DeleteOperationConfig<T>): Promise<void> {
  const fullPath = joinRemotePath(currentPath, fileName)

  const deletePromise = api.delete(serverId, fullPath).then(() => {
    setFiles((prev) => prev.filter((file) => file.name !== fileName))
  })

  notifier.promise(deletePromise, {
    loading: t("toastDeleteLoading", { file: fileName }),
    success: t("toastDeleteSuccessSingle", { file: fileName }),
    error: (error) => getErrorMessage(error, t("toastDeleteFailed", { message: "" })),
  })

  return deletePromise
}

export interface CreateFolderOperationConfig<T extends { name: string }> {
  serverId: string
  currentPath: string
  name: string
  t: TranslateFunction
  notifier: SftpOperationNotifier
  setFiles: SftpFileListUpdater<T>
  convertFileInfo: (info: FileInfo) => T
  api?: SftpOperationsApi
}

export async function performCreateFolder<T extends { name: string }>({
  serverId,
  currentPath,
  name,
  t,
  notifier,
  setFiles,
  convertFileInfo,
  api = sftpApi,
}: CreateFolderOperationConfig<T>): Promise<void> {
  const fullPath = joinRemotePath(currentPath, name)

  const createPromise = api.createDirectory(serverId, fullPath).then((info) => {
    const item = convertFileInfo(info)
    setFiles((prev) => upsertFileItem(prev, item))
  })

  notifier.promise(createPromise, {
    loading: t("toastCreateFolderLoading", { name }),
    success: t("toastCreateFolderSuccess", { name }),
    error: (error) => getErrorMessage(error, t("toastCreateFolderFailed")),
  })

  return createPromise
}

export interface CreateFileOperationConfig<T extends { name: string }> {
  serverId: string
  currentPath: string
  name: string
  t: TranslateFunction
  notifier: SftpOperationNotifier
  setFiles: SftpFileListUpdater<T>
  convertFileInfo: (info: FileInfo) => T
  api?: SftpOperationsApi
}

export async function performCreateFile<T extends { name: string }>({
  serverId,
  currentPath,
  name,
  t,
  notifier,
  setFiles,
  convertFileInfo,
  api = sftpApi,
}: CreateFileOperationConfig<T>): Promise<void> {
  const fullPath = joinRemotePath(currentPath, name)

  const createPromise = api.writeFile(serverId, fullPath, "").then((info) => {
    const item = convertFileInfo(info)
    setFiles((prev) => upsertFileItem(prev, item))
  })

  notifier.promise(createPromise, {
    loading: t("toastSaveFileLoading", { file: name }),
    success: t("toastSaveFileSuccess", { file: name }),
    error: (error) => getErrorMessage(error, t("toastSaveFileFailed")),
  })

  return createPromise
}

export interface RenameOperationConfig<T extends { name: string }> {
  serverId: string
  currentPath: string
  oldName: string
  newName: string
  t: TranslateFunction
  notifier: SftpOperationNotifier
  setFiles: SftpFileListUpdater<T>
  api?: SftpOperationsApi
}

export async function performRename<T extends { name: string }>({
  serverId,
  currentPath,
  oldName,
  newName,
  t,
  notifier,
  setFiles,
  api = sftpApi,
}: RenameOperationConfig<T>): Promise<void> {
  const oldPath = joinRemotePath(currentPath, oldName)
  const newPath = joinRemotePath(currentPath, newName)

  const renamePromise = api.rename(serverId, oldPath, newPath).then(() => {
    setFiles((prev) =>
      prev.map((file) =>
        file.name === oldName
          ? { ...file, name: newName }
          : file,
      ),
    )
  })

  notifier.promise(renamePromise, {
    loading: t("toastRenameLoading", { oldName }),
    success: t("toastRenameSuccess", { oldName, newName }),
    error: (error) => getErrorMessage(error, t("toastRenameFailed")),
  })

  return renamePromise
}

export interface SaveFileOperationConfig<T extends { name: string }> {
  serverId: string
  currentPath: string
  fileName: string
  content: string
  t: TranslateFunction
  notifier: SftpOperationNotifier
  setFiles: SftpFileListUpdater<T>
  convertFileInfo: (info: FileInfo) => T
  api?: SftpOperationsApi
}

export async function performSaveFile<T extends { name: string }>({
  serverId,
  currentPath,
  fileName,
  content,
  t,
  notifier,
  setFiles,
  convertFileInfo,
  api = sftpApi,
}: SaveFileOperationConfig<T>): Promise<void> {
  const fullPath = joinRemotePath(currentPath, fileName)

  const savePromise = api.writeFile(serverId, fullPath, content).then((info) => {
    const updated = convertFileInfo(info)
    setFiles((prev) => upsertFileItem(prev, updated))
  })

  notifier.promise(savePromise, {
    loading: t("toastSaveFileLoading", { file: fileName }),
    success: t("toastSaveFileSuccess", { file: fileName }),
    error: (error) => getErrorMessage(error, t("toastSaveFileFailed")),
  })

  return savePromise
}

export interface BatchDeleteOperationConfig<T extends { name: string }> {
  serverId: string
  currentPath: string
  fileNames: string[]
  t: TranslateFunction
  notifier: SftpOperationNotifier
  setFiles: SftpFileListUpdater<T>
  api?: SftpOperationsApi
}

export interface BatchDeleteResult {
  success: string[]
  failed: Array<{ path: string; error: string }>
  total: number
}

export async function performBatchDelete<T extends { name: string }>({
  serverId,
  currentPath,
  fileNames,
  t,
  notifier,
  setFiles,
  api = sftpApi,
}: BatchDeleteOperationConfig<T>): Promise<BatchDeleteResult> {
  const fullPaths = fileNames.map((fileName) => joinRemotePath(currentPath, fileName))

  const batchDeletePromise = api.batchDelete(serverId, fullPaths).then((result) => {
    const successNames = new Set(
      result.success.map((path) => {
        const parts = path.split("/")
        return parts[parts.length - 1] || path
      }),
    )

    setFiles((prev) => prev.filter((file) => !successNames.has(file.name)))

    if (result.failed.length > 0) {
      const failedNames = result.failed.map((failure) => {
        const parts = failure.path.split("/")
        return parts[parts.length - 1] || failure.path
      }).join(", ")

      notifier.error?.(
        t("toastBatchDeletePartialFailed", {
          count: result.failed.length,
          names: failedNames,
        }),
      )
    }

    return {
      ...result,
      total: fileNames.length,
    }
  })

  notifier.promise(batchDeletePromise, {
    loading: t("toastBatchDeleteLoading", { count: fileNames.length }),
    success: (result) => t("toastBatchDeleteSuccess", { count: result.success.length }),
    error: (error) => getErrorMessage(error, t("toastBatchDeleteFailed")),
  })

  return batchDeletePromise
}
