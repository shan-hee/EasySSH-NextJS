"use client"

import { useState, useCallback, useEffect } from 'react';
import { sftpApi, type FileInfo, type DirectoryListResponse } from '@/lib/api/sftp';
import { formatBytesString } from '@/lib/format-utils';
import { useFileTransfer } from './useFileTransfer';

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
 * 在当前文件列表中插入或更新单个文件项
 * - 如果已存在同名项,则覆盖
 * - 否则在末尾追加(具体排序由 UI 层再处理)
 */
const upsertFileItem = (items: FileItem[], item: FileItem): FileItem[] => {
  const index = items.findIndex(f => f.name === item.name);
  if (index === -1) {
    return [...items, item];
  }
  const next = [...items];
  next[index] = item;
  return next;
};

/**
 * useSftpSession Hook
 * 管理SFTP会话的状态和操作
 */
export function useSftpSession(serverId: string, initialPath: string = '/') {
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
      } catch (error) {
        console.error('[useSftpSession] 上传失败:', error);
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

      const downloadUrl = sftpApi.getDownloadUrl(serverId, fullPath);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [serverId, currentPath, files]
  );

  /**
   * 删除文件或目录
   */
  const deleteFile = useCallback(
    async (fileName: string) => {
      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${fileName}`
          : `${currentPath}/${fileName}`;

        await sftpApi.delete(serverId, fullPath);

        // 差异更新: 本地移除对应项
        setFiles(prev => prev.filter(f => f.name !== fileName));
      } catch (error) {
        console.error('[useSftpSession] 删除失败:', error);
        throw error;
      }
    },
    [serverId, currentPath]
  );

  /**
   * 创建文件夹
   */
  const createFolder = useCallback(
    async (name: string) => {
      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${name}`
          : `${currentPath}/${name}`;

        const info = await sftpApi.createDirectory(serverId, fullPath);
        const item = convertFileInfo(info);
        setFiles(prev => upsertFileItem(prev, item));
      } catch (error) {
        console.error('[useSftpSession] 创建文件夹失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, refresh, convertFileInfo]
  );

  /**
   * 创建文件
   */
  const createFile = useCallback(
    async (name: string) => {
      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${name}`
          : `${currentPath}/${name}`;

        // 创建空文件,后端返回 FileInfo
        const info = await sftpApi.writeFile(serverId, fullPath, '');
        const item = convertFileInfo(info);
        setFiles(prev => upsertFileItem(prev, item));
      } catch (error) {
        console.error('[useSftpSession] 创建文件失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, refresh, convertFileInfo]
  );

  /**
   * 重命名文件或目录
   */
  const renameFile = useCallback(
    async (oldName: string, newName: string) => {
      try {
        const oldPath = currentPath.endsWith('/')
          ? `${currentPath}${oldName}`
          : `${currentPath}/${oldName}`;

        const newPath = currentPath.endsWith('/')
          ? `${currentPath}${newName}`
          : `${currentPath}/${newName}`;

        await sftpApi.rename(serverId, oldPath, newPath);

        // 差异更新: 本地仅更新名称(大小/时间通常保持不变)
        setFiles(prev =>
          prev.map(f =>
            f.name === oldName
              ? { ...f, name: newName }
              : f
          )
        );
      } catch (error) {
        console.error('[useSftpSession] 重命名失败:', error);
        throw error;
      }
    },
    [serverId, currentPath]
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
        throw error;
      }
    },
    [serverId, currentPath]
  );

  /**
   * 保存文件内容
   */
  const saveFile = useCallback(
    async (fileName: string, content: string) => {
      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${fileName}`
          : `${currentPath}/${fileName}`;

        const info = await sftpApi.writeFile(serverId, fullPath, content);
        const updated = convertFileInfo(info);

        // 差异更新: 仅更新对应文件的大小/时间/权限等字段
        setFiles(prev =>
          prev.map(f =>
            f.name === fileName
              ? {
                  ...f,
                  size: updated.size,
                  sizeBytes: updated.sizeBytes,
                  modified: updated.modified,
                  permissions: updated.permissions,
                }
              : f
          )
        );
      } catch (error) {
        console.error('[useSftpSession] 保存文件失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, refresh, convertFileInfo]
  );

  /**
   * 批量删除文件或目录
   */
  const batchDeleteFiles = useCallback(
    async (fileNames: string[]) => {
      try {
        // 构建完整路径
        const fullPaths = fileNames.map((fileName) =>
          currentPath.endsWith('/')
            ? `${currentPath}${fileName}`
            : `${currentPath}/${fileName}`
        );

        // 调用批量删除 API
        const result = await sftpApi.batchDelete(serverId, fullPaths);

        // 差异更新: 仅移除删除成功的条目
        const successNames = new Set(
          result.success.map(p => {
            const parts = p.split('/');
            return parts[parts.length - 1] || p;
          })
        );

        setFiles(prev => prev.filter(f => !successNames.has(f.name)));

        // 返回结果供调用者处理
        return result;
      } catch (error) {
        console.error('[useSftpSession] 批量删除失败:', error);
        throw error;
      }
    },
    [serverId, currentPath]
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
      } catch (error) {
        console.error('[useSftpSession] 批量下载失败:', error);
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
