"use client"

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from "next-intl";
import { sftpApi, type FileInfo, type DirectoryListResponse } from '@/lib/api/sftp';
import { formatBytesString } from '@/lib/format-utils';
import { useFileTransfer } from './useFileTransfer';
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * SFTP会话状态
 */
export interface SftpSessionState {
  serverId: string;
  currentPath: string;
  files: FileItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * 文件项接口(用于UI显示)
 */
export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: string; // 格式化后的大小,如 "1.5 MB"
  sizeBytes: number; // 原始字节数
  modified: string; // 修改时间，格式化为 YYYY-MM-DD HH:mm:ss
  permissions: string; // 权限字符串，如 "drwxr-xr-x"
}

/**
 * 简化版文件项接口(SFTP页面使用)
 * 与 FileItem 的主要区别是没有 sizeBytes 字段
 */
export interface SimpleFileItem {
  name: string;
  type: 'file' | 'directory';
  size: string;
  modified: string;
  permissions: string;
}

/**
 * 在当前文件列表中插入或更新单个文件项
 * - 如果已存在同名项,则覆盖
 * - 否则在末尾追加(具体排序由 UI 层再处理)
 */
export const upsertFileItem = <T extends { name: string }>(items: T[], item: T): T[] => {
  const index = items.findIndex(f => f.name === item.name);
  if (index === -1) {
    return [...items, item];
  }
  const next = [...items];
  next[index] = item;
  return next;
};

// ============================================
// 通用 SFTP 操作函数 (可被 useSftpSession 和 SFTP 页面共用)
// ============================================

/**
 * i18n 翻译函数类型
 */
type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;

/**
 * 通用删除操作配置
 */
export interface DeleteOperationConfig<T extends { name: string }> {
  serverId: string;
  currentPath: string;
  fileName: string;
  t: TranslateFunction;
  setFiles: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * 执行删除文件/目录操作 (带 toast.promise 和差异更新)
 */
export async function performDelete<T extends { name: string }>({
  serverId,
  currentPath,
  fileName,
  t,
  setFiles,
}: DeleteOperationConfig<T>): Promise<void> {
  const fullPath = currentPath.endsWith('/')
    ? `${currentPath}${fileName}`
    : `${currentPath}/${fileName}`;

  const deletePromise = sftpApi.delete(serverId, fullPath).then(() => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
  });

  toast.promise(deletePromise, {
    loading: t("toastDeleteLoading", { file: fileName }),
    success: t("toastDeleteSuccessSingle", { file: fileName }),
    error: (err) => getErrorMessage(err, t("toastDeleteFailed", { message: "" })),
  });

  return deletePromise;
}

/**
 * 通用创建文件夹操作配置
 */
export interface CreateFolderOperationConfig<T extends { name: string }> {
  serverId: string;
  currentPath: string;
  name: string;
  t: TranslateFunction;
  setFiles: React.Dispatch<React.SetStateAction<T[]>>;
  convertFileInfo: (info: FileInfo) => T;
}

/**
 * 执行创建文件夹操作 (带 toast.promise 和差异更新)
 */
export async function performCreateFolder<T extends { name: string }>({
  serverId,
  currentPath,
  name,
  t,
  setFiles,
  convertFileInfo,
}: CreateFolderOperationConfig<T>): Promise<void> {
  const fullPath = currentPath.endsWith('/')
    ? `${currentPath}${name}`
    : `${currentPath}/${name}`;

  const createPromise = sftpApi.createDirectory(serverId, fullPath).then((info) => {
    const item = convertFileInfo(info);
    setFiles(prev => upsertFileItem(prev, item));
  });

  toast.promise(createPromise, {
    loading: t("toastCreateFolderLoading", { name }),
    success: t("toastCreateFolderSuccess", { name }),
    error: (err) => getErrorMessage(err, t("toastCreateFolderFailed")),
  });

  return createPromise;
}

/**
 * 通用创建文件操作配置
 */
export interface CreateFileOperationConfig<T extends { name: string }> {
  serverId: string;
  currentPath: string;
  name: string;
  t: TranslateFunction;
  setFiles: React.Dispatch<React.SetStateAction<T[]>>;
  convertFileInfo: (info: FileInfo) => T;
}

/**
 * 执行创建文件操作 (带 toast.promise 和差异更新)
 */
export async function performCreateFile<T extends { name: string }>({
  serverId,
  currentPath,
  name,
  t,
  setFiles,
  convertFileInfo,
}: CreateFileOperationConfig<T>): Promise<void> {
  const fullPath = currentPath.endsWith('/')
    ? `${currentPath}${name}`
    : `${currentPath}/${name}`;

  const createPromise = sftpApi.writeFile(serverId, fullPath, '').then((info) => {
    const item = convertFileInfo(info);
    setFiles(prev => upsertFileItem(prev, item));
  });

  toast.promise(createPromise, {
    loading: t("toastSaveFileLoading", { file: name }),
    success: t("toastSaveFileSuccess", { file: name }),
    error: (err) => getErrorMessage(err, t("toastSaveFileFailed")),
  });

  return createPromise;
}

/**
 * 通用重命名操作配置
 */
export interface RenameOperationConfig<T extends { name: string }> {
  serverId: string;
  currentPath: string;
  oldName: string;
  newName: string;
  t: TranslateFunction;
  setFiles: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * 执行重命名文件/目录操作 (带 toast.promise 和差异更新)
 */
export async function performRename<T extends { name: string }>({
  serverId,
  currentPath,
  oldName,
  newName,
  t,
  setFiles,
}: RenameOperationConfig<T>): Promise<void> {
  const oldPath = currentPath.endsWith('/')
    ? `${currentPath}${oldName}`
    : `${currentPath}/${oldName}`;

  const newPath = currentPath.endsWith('/')
    ? `${currentPath}${newName}`
    : `${currentPath}/${newName}`;

  const renamePromise = sftpApi.rename(serverId, oldPath, newPath).then(() => {
    setFiles(prev =>
      prev.map(f =>
        f.name === oldName
          ? { ...f, name: newName }
          : f
      )
    );
  });

  toast.promise(renamePromise, {
    loading: t("toastRenameLoading", { oldName }),
    success: t("toastRenameSuccess", { oldName, newName }),
    error: (err) => getErrorMessage(err, t("toastRenameFailed")),
  });

  return renamePromise;
}

/**
 * 通用保存文件操作配置
 */
export interface SaveFileOperationConfig<T extends { name: string }> {
  serverId: string;
  currentPath: string;
  fileName: string;
  content: string;
  t: TranslateFunction;
  setFiles: React.Dispatch<React.SetStateAction<T[]>>;
  convertFileInfo: (info: FileInfo) => T;
}

/**
 * 执行保存文件操作 (带 toast.promise 和差异更新)
 */
export async function performSaveFile<T extends { name: string }>({
  serverId,
  currentPath,
  fileName,
  content,
  t,
  setFiles,
  convertFileInfo,
}: SaveFileOperationConfig<T>): Promise<void> {
  const fullPath = currentPath.endsWith('/')
    ? `${currentPath}${fileName}`
    : `${currentPath}/${fileName}`;

  const savePromise = sftpApi.writeFile(serverId, fullPath, content).then((info) => {
    const updated = convertFileInfo(info);
    setFiles(prev => upsertFileItem(prev, updated));
  });

  toast.promise(savePromise, {
    loading: t("toastSaveFileLoading", { file: fileName }),
    success: t("toastSaveFileSuccess", { file: fileName }),
    error: (err) => getErrorMessage(err, t("toastSaveFileFailed")),
  });

  return savePromise;
}

/**
 * 通用批量删除操作配置
 */
export interface BatchDeleteOperationConfig<T extends { name: string }> {
  serverId: string;
  currentPath: string;
  fileNames: string[];
  t: TranslateFunction;
  setFiles: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * 批量删除结果类型
 */
export interface BatchDeleteResult {
  success: string[];
  failed: Array<{ path: string; error: string }>;
  total: number;
}

/**
 * 执行批量删除操作 (带 toast.promise 和差异更新)
 */
export async function performBatchDelete<T extends { name: string }>({
  serverId,
  currentPath,
  fileNames,
  t,
  setFiles,
}: BatchDeleteOperationConfig<T>): Promise<BatchDeleteResult> {
  const fullPaths = fileNames.map((fileName) =>
    currentPath.endsWith('/')
      ? `${currentPath}${fileName}`
      : `${currentPath}/${fileName}`
  );

  const batchDeletePromise = sftpApi.batchDelete(serverId, fullPaths).then((result) => {
    // 获取成功删除的文件名
    const successNames = new Set(
      result.success.map(p => {
        const parts = p.split('/');
        return parts[parts.length - 1] || p;
      })
    );

    // 差异更新
    setFiles(prev => prev.filter(f => !successNames.has(f.name)));

    // 部分失败提示
    if (result.failed.length > 0) {
      const failedNames = result.failed.map(f => {
        const parts = f.path.split('/');
        return parts[parts.length - 1] || f.path;
      }).join(', ');
      toast.error(
        t("toastBatchDeletePartialFailed", {
          count: result.failed.length,
          names: failedNames,
        })
      );
    }

    // 返回包含 total 的结果
    return {
      ...result,
      total: fileNames.length,
    };
  });

  toast.promise(batchDeletePromise, {
    loading: t("toastBatchDeleteLoading", { count: fileNames.length }),
    success: (result) => t("toastBatchDeleteSuccess", { count: result.success.length }),
    error: (err) => getErrorMessage(err, t("toastBatchDeleteFailed")),
  });

  return batchDeletePromise;
}

/**
 * useSftpSession Hook
 * 管理SFTP会话的状态和操作
 */
export function useSftpSession(serverId: string, initialPath: string = '/') {
  const tSftp = useTranslations("sftp");
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileTransfer = useFileTransfer();

  /**
   * 转换后端FileInfo为前端FileItem
   */
  const convertFileInfo = useCallback((info: FileInfo): FileItem => {
    // 将数字模式转换为权限字符串（如果需要）
    const formatMode = (mode: number, isDir: boolean): string => {
      if (!mode && mode !== 0) {
        return '---------'
      }
      const perms = [
        mode & 0o400 ? 'r' : '-',
        mode & 0o200 ? 'w' : '-',
        mode & 0o100 ? 'x' : '-',
        mode & 0o040 ? 'r' : '-',
        mode & 0o020 ? 'w' : '-',
        mode & 0o010 ? 'x' : '-',
        mode & 0o004 ? 'r' : '-',
        mode & 0o002 ? 'w' : '-',
        mode & 0o001 ? 'x' : '-',
      ]
      return (isDir ? 'd' : '-') + perms.join('')
    }

    // 格式化修改时间
    const formatModTime = (modTime: string): string => {
      if (!modTime) return '-'
      try {
        const date = new Date(modTime)
        if (isNaN(date.getTime())) {
          return '-'
        }
        // 格式化为 YYYY-MM-DD HH:mm:ss
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
      } catch {
        return '-'
      }
    }

    return {
      name: info.name,
      type: info.is_dir ? 'directory' : 'file',
      size: formatBytesString(info.size),
      sizeBytes: info.size,
      modified: formatModTime(info.mod_time),
      permissions: info.permission || formatMode(info.mode, info.is_dir),
    };
  }, []);

  /**
   * 加载目录内容
   */
  const loadDirectory = useCallback(async (path: string) => {
    if (!serverId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response: DirectoryListResponse = await sftpApi.listDirectory(
        serverId,
        path
      );

      const fileItems = response.files.map(convertFileInfo);
      setFiles(fileItems);
      setCurrentPath(response.path);
    } catch (err: unknown) {
      console.error('[useSftpSession] 加载目录失败:', err);
      const errorMessage = err instanceof Error ? err.message : '加载目录失败';
      setError(errorMessage);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [serverId, convertFileInfo]);

  /**
   * 导航到指定路径
   */
  const navigate = useCallback(
    (path: string) => {
      loadDirectory(path);
    },
    [loadDirectory]
  );

  /**
   * 刷新当前目录
   */
  const refresh = useCallback(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  /**
   * 上传文件
   */
  const uploadFiles = useCallback(
    async (fileList: FileList, onProgress?: (fileName: string, loaded: number, total: number) => void) => {
      // 这里仍采用“上传完成后整目录刷新”的策略:
      // - 上传往往会在目录中引入多个新文件,且用户可能在上传过程中切换目录
      // - 为保证列表与服务器完全一致,这里保留一次性刷新,其他操作则采用差异更新
      const uploadPromises: Promise<unknown>[] = [];

      for (const file of Array.from(fileList)) {
        const promise = fileTransfer.uploadFile(
          serverId,
          currentPath,
          file,
          onProgress ? (loaded, total) => onProgress(file.name, loaded, total) : undefined,
          true // 启用 WebSocket 进度跟踪
        );
        uploadPromises.push(promise);
      }

      try {
        await Promise.all(uploadPromises);
        // 上传完成后刷新当前目录
        refresh();
        // 上传成功提示（与 SFTP 页面保持一致风格）
        if (fileList.length > 0) {
          toast.success(
            tSftp("toastUploadSuccess", { count: fileList.length })
          );
        }
      } catch (error) {
        console.error('[useSftpSession] 上传失败:', error);
        toast.error(getErrorMessage(error, tSftp("toastUploadFailed", { count: fileList.length })));
        throw error;
      }
    },
    [serverId, currentPath, fileTransfer, refresh]
  );

  /**
   * 下载文件（使用浏览器原生下载）
   */
  const downloadFile = useCallback(
    async (fileName: string) => {
      const file = files.find((f) => f.name === fileName);
      if (!file || file.type === 'directory') return;

      const fullPath = currentPath.endsWith('/')
        ? `${currentPath}${fileName}`
        : `${currentPath}/${fileName}`;

      await sftpApi.downloadFile(serverId, fullPath, fileName);
      // 下载开始提示
      toast.success(tSftp("toastDownloadStartSingle", { file: fileName }));
    },
    [serverId, currentPath, files]
  );

  /**
   * 删除文件或目录 (使用通用函数)
   */
  const deleteFile = useCallback(
    (fileName: string) => performDelete({
      serverId,
      currentPath,
      fileName,
      t: tSftp,
      setFiles,
    }),
    [serverId, currentPath, tSftp]
  );

  /**
   * 创建文件夹 (使用通用函数)
   */
  const createFolder = useCallback(
    (name: string) => performCreateFolder({
      serverId,
      currentPath,
      name,
      t: tSftp,
      setFiles,
      convertFileInfo,
    }),
    [serverId, currentPath, convertFileInfo, tSftp]
  );

  /**
   * 创建文件 (使用通用函数)
   */
  const createFile = useCallback(
    (name: string) => performCreateFile({
      serverId,
      currentPath,
      name,
      t: tSftp,
      setFiles,
      convertFileInfo,
    }),
    [serverId, currentPath, convertFileInfo, tSftp]
  );

  /**
   * 重命名文件或目录 (使用通用函数)
   */
  const renameFile = useCallback(
    (oldName: string, newName: string) => performRename({
      serverId,
      currentPath,
      oldName,
      newName,
      t: tSftp,
      setFiles,
    }),
    [serverId, currentPath, tSftp]
  );

  /**
   * 读取文件内容
   */
  const readFile = useCallback(
    async (fileName: string): Promise<string> => {
      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${fileName}`
          : `${currentPath}/${fileName}`;

        const content = await sftpApi.readFile(serverId, fullPath);

        return content;
      } catch (error) {
        console.error('[useSftpSession] 读取文件失败:', error);
        toast.error(getErrorMessage(error, tSftp("toastReadFileFailed")));
        throw error;
      }
    },
    [serverId, currentPath]
  );

  /**
   * 保存文件内容 (使用通用函数)
   */
  const saveFile = useCallback(
    (fileName: string, content: string) => performSaveFile({
      serverId,
      currentPath,
      fileName,
      content,
      t: tSftp,
      setFiles,
      convertFileInfo,
    }),
    [serverId, currentPath, convertFileInfo, tSftp]
  );

  /**
   * 批量删除文件或目录 (使用通用函数)
   */
  const batchDeleteFiles = useCallback(
    (fileNames: string[]) => performBatchDelete({
      serverId,
      currentPath,
      fileNames,
      t: tSftp,
      setFiles,
    }),
    [serverId, currentPath, tSftp]
  );

  /**
   * 批量下载文件(打包为 ZIP 或 tar.gz，使用浏览器原生下载)
   */
  const batchDownloadFiles = useCallback(
    async (fileNames: string[], mode: "fast" | "compatible" = "fast", excludePatterns?: string[]) => {
      try {
        // 构建完整路径
        const fullPaths = fileNames.map((fileName) =>
          currentPath.endsWith('/')
            ? `${currentPath}${fileName}`
            : `${currentPath}/${fileName}`
        );

        // 直接调用 API 的批量下载，内部使用浏览器下载机制
        await sftpApi.batchDownload(serverId, fullPaths, mode, excludePatterns);
        toast.success(
          tSftp("toastBatchDownloadStart", { count: fileNames.length })
        );
      } catch (error) {
        console.error('[useSftpSession] 批量下载失败:', error);
        toast.error(getErrorMessage(error, tSftp("toastBatchDownloadFailed")));
        throw error;
      }
    },
    [serverId, currentPath]
  );

  // 初始加载
  useEffect(() => {
    if (serverId) {
      loadDirectory(initialPath);
    }
  }, [serverId, initialPath, loadDirectory]);

  return {
    // 状态
    currentPath,
    files,
    isLoading,
    error,
    transferTasks: fileTransfer.tasks,

    // 操作
    navigate,
    refresh,
    uploadFiles,
    downloadFile,
    deleteFile,
    createFolder,
    createFile,
    renameFile,
    readFile,
    saveFile,

    // 批量操作
    batchDeleteFiles,
    batchDownloadFiles,

    // 传输管理
    cancelTransfer: fileTransfer.cancelTask,
    removeTransfer: fileTransfer.removeTask,
    clearCompletedTransfers: fileTransfer.clearCompleted,
  };
}
