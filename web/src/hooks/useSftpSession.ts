"use client"

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from "next-intl";
import { sftpApi, type FileInfo, type DirectoryListResponse } from '@/lib/api/sftp';
import { useFileTransfer } from './useFileTransfer';
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/error-utils";
import { convertSftpFileInfo, type SftpFileItem } from "@/lib/sftp-file-utils";

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
  const currentPathRef = useRef(initialPath);
  const [pathBackStack, setPathBackStack] = useState<string[]>([]);
  const [pathForwardStack, setPathForwardStack] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileTransfer = useFileTransfer();

  /**
   * 转换后端FileInfo为前端FileItem
   */
  const convertFileInfo = useCallback((info: FileInfo): FileItem => {
    const converted = convertSftpFileInfo(info, {
      // 终端文件管理器默认显示目录 size 为 "-"
      showDirSizeDash: true,
    }) satisfies SftpFileItem
    return converted
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
      currentPathRef.current = response.path;
      return response.path;
    } catch (err: unknown) {
      console.error('[useSftpSession] 加载目录失败:', err);
      const errorMessage = err instanceof Error ? err.message : '加载目录失败';
      setError(errorMessage);
      setFiles([]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [serverId, convertFileInfo]);

  /**
   * 导航到指定路径
   */
  const navigate = useCallback(
    async (path: string) => {
      const previousPath = currentPathRef.current;
      const loadedPath = await loadDirectory(path);

      if (loadedPath && loadedPath !== previousPath) {
        setPathBackStack((prev) => [...prev, previousPath].slice(-50));
        setPathForwardStack([]);
      }
    },
    [loadDirectory]
  );

  /**
   * 回到本会话内上一次访问的目录
   */
  const goBack = useCallback(async () => {
    const previousPath = pathBackStack[pathBackStack.length - 1];
    if (!previousPath) return;

    const currentBeforeBack = currentPathRef.current;
    const loadedPath = await loadDirectory(previousPath);
    if (!loadedPath) return;

    setPathBackStack((prev) => prev.slice(0, -1));
    if (loadedPath !== currentBeforeBack) {
      setPathForwardStack((prev) => [...prev, currentBeforeBack].slice(-50));
    }
  }, [loadDirectory, pathBackStack]);

  /**
   * 前进到本会话内下一次访问的目录，暂未暴露 UI，但保留状态能力。
   */
  const goForward = useCallback(async () => {
    const nextPath = pathForwardStack[pathForwardStack.length - 1];
    if (!nextPath) return;

    const currentBeforeForward = currentPathRef.current;
    const loadedPath = await loadDirectory(nextPath);
    if (!loadedPath) return;

    setPathForwardStack((prev) => prev.slice(0, -1));
    if (loadedPath !== currentBeforeForward) {
      setPathBackStack((prev) => [...prev, currentBeforeForward].slice(-50));
    }
  }, [loadDirectory, pathForwardStack]);

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
    [serverId, currentPath, fileTransfer, refresh, tSftp]
  );

  /**
   * 下载文件（使用浏览器原生下载）
   */
  const downloadFile = useCallback(
    (fileName: string) => {
      const file = files.find((f) => f.name === fileName);
      if (!file || file.type === 'directory') return;

      const fullPath = currentPath.endsWith('/')
        ? `${currentPath}${fileName}`
        : `${currentPath}/${fileName}`;

      // 直接触发浏览器下载，由浏览器自带下载管理器处理
      sftpApi.downloadFile(serverId, fullPath, fileName);
      toast.success(tSftp("toastDownloadStartSingle", { file: fileName }));
    },
    [serverId, currentPath, files, tSftp]
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
    [serverId, currentPath, tSftp]
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
    [serverId, currentPath, tSftp]
  );

  // 初始加载
  useEffect(() => {
    if (serverId) {
      loadDirectory(initialPath);
    }
  }, [serverId, initialPath, loadDirectory]);

  // 切换服务器时清空路径访问历史，避免不同连接之间串历史。
  useEffect(() => {
    currentPathRef.current = initialPath;
    setCurrentPath(initialPath);
    setPathBackStack([]);
    setPathForwardStack([]);
  }, [serverId, initialPath]);

  // 页面卸载/切换 serverId 时，主动关闭连接以加速资源回收
  useEffect(() => {
    if (!serverId) return;
    return () => {
      sftpApi.closeConnection(serverId).catch(() => {
        // cleanup 阶段不打扰用户；失败时等待后端空闲回收即可
      });
    };
  }, [serverId]);

  return {
    // 状态
    currentPath,
    files,
    isLoading,
    error,
    transferTasks: fileTransfer.tasks,
    canGoBack: pathBackStack.length > 0,
    canGoForward: pathForwardStack.length > 0,

    // 操作
    navigate,
    goBack,
    goForward,
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
