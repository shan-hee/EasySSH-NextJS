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
  modifiedTime: string;
  permissions?: string;
  owner?: string;
  group?: string;
}

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
    return {
      name: info.name,
      type: info.is_dir ? 'directory' : 'file',
      size: formatBytesString(info.size),
      sizeBytes: info.size,
      modifiedTime: info.mod_time,
      permissions: info.permissions,
      owner: info.owner,
      group: info.group,
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
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      const response: DirectoryListResponse = await sftpApi.listDirectory(
        token,
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
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      const uploadPromises: Promise<void>[] = [];

      for (const file of Array.from(fileList)) {
        const promise = fileTransfer.uploadFile(
          token,
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
        // 上传完成后刷新
        refresh();
      } catch (error) {
        console.error('[useSftpSession] 上传失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, fileTransfer, refresh]
  );

  /**
   * 下载文件
   */
  const downloadFile = useCallback(
    async (fileName: string) => {
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      const file = files.find((f) => f.name === fileName);
      if (!file || file.type === 'directory') return;

      const fullPath = currentPath.endsWith('/')
        ? `${currentPath}${fileName}`
        : `${currentPath}/${fileName}`;

      await fileTransfer.downloadFile(
        token,
        serverId,
        fullPath,
        fileName,
        file.sizeBytes
      );
    },
    [serverId, currentPath, files, fileTransfer]
  );

  /**
   * 删除文件或目录
   */
  const deleteFile = useCallback(
    async (fileName: string) => {
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${fileName}`
          : `${currentPath}/${fileName}`;

        await sftpApi.delete(token, serverId, fullPath);
        refresh();
      } catch (error) {
        console.error('[useSftpSession] 删除失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, refresh]
  );

  /**
   * 创建文件夹
   */
  const createFolder = useCallback(
    async (name: string) => {
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${name}`
          : `${currentPath}/${name}`;

        await sftpApi.createDirectory(token, serverId, fullPath);
        refresh();
      } catch (error) {
        console.error('[useSftpSession] 创建文件夹失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, refresh]
  );

  /**
   * 创建文件
   */
  const createFile = useCallback(
    async (name: string) => {
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${name}`
          : `${currentPath}/${name}`;

        // 创建空文件
        await sftpApi.writeFile(token, serverId, fullPath, '');
        refresh();
      } catch (error) {
        console.error('[useSftpSession] 创建文件失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, refresh]
  );

  /**
   * 重命名文件或目录
   */
  const renameFile = useCallback(
    async (oldName: string, newName: string) => {
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      try {
        const oldPath = currentPath.endsWith('/')
          ? `${currentPath}${oldName}`
          : `${currentPath}/${oldName}`;

        const newPath = currentPath.endsWith('/')
          ? `${currentPath}${newName}`
          : `${currentPath}/${newName}`;

        await sftpApi.rename(token, serverId, oldPath, newPath);
        refresh();
      } catch (error) {
        console.error('[useSftpSession] 重命名失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, refresh]
  );

  /**
   * 读取文件内容
   */
  const readFile = useCallback(
    async (fileName: string): Promise<string> => {
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${fileName}`
          : `${currentPath}/${fileName}`;

        const content = await sftpApi.readFile(token, serverId, fullPath);

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
      const token = localStorage.getItem('easyssh_access_token');
      if (!token) {
        throw new Error('未找到访问令牌');
      }

      try {
        const fullPath = currentPath.endsWith('/')
          ? `${currentPath}${fileName}`
          : `${currentPath}/${fileName}`;

        await sftpApi.writeFile(token, serverId, fullPath, content);
        refresh();
      } catch (error) {
        console.error('[useSftpSession] 保存文件失败:', error);
        throw error;
      }
    },
    [serverId, currentPath, refresh]
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

    // 传输管理
    cancelTransfer: fileTransfer.cancelTask,
    removeTransfer: fileTransfer.removeTask,
    clearCompletedTransfers: fileTransfer.clearCompleted,
  };
}
