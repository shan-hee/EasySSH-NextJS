import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sftpApi } from '@/lib/api/sftp';
import { getWsUrl } from '@/lib/config';
import { createAuthTicket } from '@/lib/auth-ticket';
import { useAuthStore } from '@/stores/auth-store';
import {
  createFileTransferController,
  type FileTransferSftpApi,
} from '@/lib/session/transfer-manager-controller';
import type { TransferTask, TransferTaskUpdate } from '@/lib/session/transfer-tasks';
import {
  createTransferConcurrencyLimiter,
  createTransferRuntimeHandleStore,
  type TransferAuthTicketProvider,
  type TransferConcurrencyLimiter,
  type TransferRuntimeHandleStore,
  type TransferWebSocketConstructor,
  type TransferWebSocketUrlResolver,
} from '@/lib/session/transfer-runtime';

export type { TransferTask }
export type { FileTransferSftpApi }

export interface UseFileTransferOptions {
  api?: FileTransferSftpApi;
  createTicket?: TransferAuthTicketProvider;
  resolveWebSocketUrl?: TransferWebSocketUrlResolver;
  WebSocketCtor?: TransferWebSocketConstructor;
  uploadLimiter?: TransferConcurrencyLimiter;
}

/**
 * 文件传输 Hook。
 * React 只负责状态持有和登录态触发，传输流程由 session transfer controller 承接。
 */
export function useFileTransfer({
  api = sftpApi,
  createTicket = createAuthTicket,
  resolveWebSocketUrl = getWsUrl,
  WebSocketCtor,
  uploadLimiter: providedUploadLimiter,
}: UseFileTransferOptions = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const tasksRef = useRef<TransferTask[]>(tasks);
  tasksRef.current = tasks;

  const transferHandlesRef = useRef<TransferRuntimeHandleStore | null>(null);
  const transferHandles = transferHandlesRef.current ?? createTransferRuntimeHandleStore();
  if (!transferHandlesRef.current) {
    transferHandlesRef.current = transferHandles;
  }

  const defaultUploadLimiterRef = useRef<TransferConcurrencyLimiter | null>(null);
  const defaultUploadLimiter = defaultUploadLimiterRef.current ?? createTransferConcurrencyLimiter();
  if (!defaultUploadLimiterRef.current) {
    defaultUploadLimiterRef.current = defaultUploadLimiter;
  }
  const uploadLimiter = providedUploadLimiter ?? defaultUploadLimiter;

  const updateTransferTasks = useCallback((updater: (tasks: readonly TransferTask[]) => TransferTask[]) => {
    setTasks((current) => updater(current));
  }, []);

  const controller = useMemo(() => createFileTransferController({
    api,
    createTicket,
    resolveWebSocketUrl,
    uploadLimiter,
    handles: transferHandles,
    getTasks: () => tasksRef.current,
    setTasks: updateTransferTasks,
    WebSocketCtor,
    logError: (message, error) => {
      console.error(message.replace('[transfer-manager]', '[useFileTransfer]'), error);
    },
    logWarn: (message, ...args) => {
      console.warn(message.replace('[transfer-manager]', '[useFileTransfer]'), ...args);
    },
  }), [api, createTicket, resolveWebSocketUrl, uploadLimiter, transferHandles, updateTransferTasks, WebSocketCtor]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;
    void controller.restoreUploadTasks({
      shouldSkip: () => cancelled,
    }).catch((err) => {
      console.warn('[useFileTransfer] Failed to load upload tasks:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, controller]);

  const updateTask = useCallback((taskId: string, update: TransferTaskUpdate) => {
    controller.updateTask(taskId, update);
  }, [controller]);

  return {
    tasks,
    uploadFile: controller.uploadFile,
    cancelTask: controller.cancelTask,
    removeTask: controller.removeTask,
    clearCompleted: controller.clearCompleted,
    clearAll: controller.clearAll,
    createTransferTask: controller.createTransferTask,
    addTask: controller.addTask,
    updateTask,
    directTransfer: controller.directTransfer,
    cancelDirectTransfer: controller.cancelDirectTransfer,
  };
}
