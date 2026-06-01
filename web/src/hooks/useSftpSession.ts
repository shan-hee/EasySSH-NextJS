"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { FileInfo } from '@/lib/api/sftp';
import { useFileTransfer, type UseFileTransferOptions } from './useFileTransfer';
import { getErrorMessage } from "@/lib/error-utils";
import { convertSftpFileInfo, type SftpFileItem } from "@/lib/sftp-file-utils";
import { loadSftpDirectory } from "@/lib/session/sftp-directory";
import {
  performBatchDelete,
  performCreateFile,
  performCreateFolder,
  performDelete,
  performRename,
  performSaveFile,
  type SftpOperationNotifier,
  type TranslateFunction,
} from "@/lib/session/sftp-operations";
import {
  createSftpSessionApi,
  type SftpSessionApiAdapter,
} from "@/lib/session/sftp-session-api";

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
export type FileItem = SftpFileItem;

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

export interface SftpSessionNotifier extends SftpOperationNotifier {
  success: (message: string) => unknown;
  error: (message: string) => unknown;
}

export interface UseSftpSessionOptions {
  api?: SftpSessionApiAdapter;
  notifier?: SftpSessionNotifier;
  t?: TranslateFunction;
  fileTransferOptions?: UseFileTransferOptions;
}

const defaultSessionNotifier: SftpSessionNotifier = {
  success: () => undefined,
  error: () => undefined,
  promise: <T,>(promise: Promise<T>, messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  }) => {
    void messages;
    void promise.catch(() => undefined);
    return promise;
  },
};

/**
 * useSftpSession Hook
 * 管理SFTP会话的状态和操作
 */
export function useSftpSession(
  serverId: string,
  initialPath: string = '/',
  { api, notifier, t, fileTransferOptions }: UseSftpSessionOptions = {}
) {
  const defaultTranslate: TranslateFunction = (key) => key;
  const tSftp = t ?? defaultTranslate;
  const sessionNotifier = notifier ?? defaultSessionNotifier;
  const sessionApi = useMemo(() => createSftpSessionApi(api), [api]);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const currentPathRef = useRef(initialPath);
  const [pathBackStack, setPathBackStack] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileTransfer = useFileTransfer(fileTransferOptions);

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
      const directory = await loadSftpDirectory({
        serverId,
        path,
        convertFileInfo,
        withParentEntry: false,
        api: sessionApi,
      });

      setFiles(directory.files);
      setCurrentPath(directory.path);
      currentPathRef.current = directory.path;
      return directory.path;
    } catch (err: unknown) {
      console.error('[useSftpSession] 加载目录失败:', err);
      const errorMessage = err instanceof Error ? err.message : '加载目录失败';
      setError(errorMessage);
      setFiles([]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [serverId, convertFileInfo, sessionApi]);

  /**
   * 导航到指定路径
   */
  const navigate = useCallback(
    async (path: string) => {
      const previousPath = currentPathRef.current;
      const loadedPath = await loadDirectory(path);

      if (loadedPath && loadedPath !== previousPath) {
        setPathBackStack((prev) => [...prev, previousPath].slice(-50));
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

    const loadedPath = await loadDirectory(previousPath);
    if (!loadedPath) return;

    setPathBackStack((prev) => prev.slice(0, -1));
  }, [loadDirectory, pathBackStack]);

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
          sessionNotifier.success(
            tSftp("toastUploadSuccess", { count: fileList.length })
          );
        }
      } catch (error) {
        console.error('[useSftpSession] 上传失败:', error);
        sessionNotifier.error(getErrorMessage(error, tSftp("toastUploadFailed", { count: fileList.length })));
        throw error;
      }
    },
    [serverId, currentPath, fileTransfer, refresh, sessionNotifier, tSftp]
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
      sessionApi.downloadFile(serverId, fullPath);
      sessionNotifier.success(tSftp("toastDownloadStartSingle", { file: fileName }));
    },
    [serverId, currentPath, files, sessionApi, sessionNotifier, tSftp]
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
      notifier: sessionNotifier,
      setFiles,
      api: sessionApi,
    }),
    [serverId, currentPath, sessionApi, sessionNotifier, tSftp]
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
      notifier: sessionNotifier,
      setFiles,
      convertFileInfo,
      api: sessionApi,
    }),
    [serverId, currentPath, convertFileInfo, sessionApi, sessionNotifier, tSftp]
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
      notifier: sessionNotifier,
      setFiles,
      convertFileInfo,
      api: sessionApi,
    }),
    [serverId, currentPath, convertFileInfo, sessionApi, sessionNotifier, tSftp]
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
      notifier: sessionNotifier,
      setFiles,
      api: sessionApi,
    }),
    [serverId, currentPath, sessionApi, sessionNotifier, tSftp]
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

        const content = await sessionApi.readFile(serverId, fullPath);

        return content;
      } catch (error) {
        console.error('[useSftpSession] 读取文件失败:', error);
        sessionNotifier.error(getErrorMessage(error, tSftp("toastReadFileFailed")));
        throw error;
      }
    },
    [serverId, currentPath, sessionApi, sessionNotifier, tSftp]
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
      notifier: sessionNotifier,
      setFiles,
      convertFileInfo,
      api: sessionApi,
    }),
    [serverId, currentPath, convertFileInfo, sessionApi, sessionNotifier, tSftp]
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
      notifier: sessionNotifier,
      setFiles,
      api: sessionApi,
    }),
    [serverId, currentPath, sessionApi, sessionNotifier, tSftp]
  );

  /**
   * 批量下载文件（终端/文件管理器固定使用推荐的快速下载方案）
   */
  const batchDownloadFiles = useCallback(
    async (fileNames: string[], excludePatterns?: string[]) => {
      try {
        // 构建完整路径
        const fullPaths = fileNames.map((fileName) =>
          currentPath.endsWith('/')
            ? `${currentPath}${fileName}`
            : `${currentPath}/${fileName}`
        );

        // 直接调用 API 的批量下载，内部使用浏览器下载机制
        await sessionApi.batchDownload(serverId, fullPaths, "fast", excludePatterns);
        sessionNotifier.success(
          tSftp("toastBatchDownloadStart", { count: fileNames.length })
        );
      } catch (error) {
        console.error('[useSftpSession] 批量下载失败:', error);
        sessionNotifier.error(getErrorMessage(error, tSftp("toastBatchDownloadFailed")));
        throw error;
      }
    },
    [serverId, currentPath, sessionApi, sessionNotifier, tSftp]
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
  }, [serverId, initialPath]);

  // 页面卸载/切换 serverId 时，主动关闭连接以加速资源回收
  useEffect(() => {
    if (!serverId) return;
    return () => {
      sessionApi.closeConnection?.(serverId)?.catch(() => {
        // cleanup 阶段不打扰用户；失败时等待后端空闲回收即可
      });
    };
  }, [serverId, sessionApi]);

  return {
    // 状态
    currentPath,
    files,
    isLoading,
    error,
    transferTasks: fileTransfer.tasks,
    canGoBack: pathBackStack.length > 0,

    // 操作
    navigate,
    goBack,
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
