import { useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

/**
 * Toast Hook
 * 简单的Toast通知系统
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastMessage = {
        id,
        ...toast,
        duration: toast.duration || 3000,
      };

      setToasts((prev) => [...prev, newToast]);

      // 自动移除
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, description?: string) => {
      return showToast({ type: 'success', title, description });
    },
    [showToast]
  );

  const error = useCallback(
    (title: string, description?: string) => {
      return showToast({ type: 'error', title, description, duration: 5000 });
    },
    [showToast]
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      return showToast({ type: 'warning', title, description });
    },
    [showToast]
  );

  const info = useCallback(
    (title: string, description?: string) => {
      return showToast({ type: 'info', title, description });
    },
    [showToast]
  );

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
