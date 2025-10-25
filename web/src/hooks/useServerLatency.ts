/**
 * 测量客户端到 EasySSH 服务器的延迟
 */

import { useEffect, useState, useRef } from 'react';
import { getApiUrl } from '@/lib/config';

interface UseServerLatencyOptions {
  /** 测量间隔（毫秒），默认 5000ms (5秒) */
  interval?: number;
  /** 是否启用测量，默认 true */
  enabled?: boolean;
}

/**
 * 测量到服务器的网络延迟
 *
 * @example
 * const latency = useServerLatency({ interval: 5000 });
 * console.log(`延迟: ${latency}ms`);
 */
export function useServerLatency(options: UseServerLatencyOptions = {}) {
  const { interval = 5000, enabled = true } = options;
  const [latency, setLatency] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLatency(0);
      return;
    }

    const measureLatency = async () => {
      // 取消上一次请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        const start = performance.now();

        const apiUrl = getApiUrl();
        await fetch(`${apiUrl}/ping`, {
          method: 'HEAD',
          cache: 'no-store',
          signal: abortControllerRef.current.signal,
        });

        const rtt = Math.round(performance.now() - start);
        setLatency(rtt);
      } catch (error: any) {
        // 忽略 abort 错误
        if (error.name !== 'AbortError') {
          console.error('[useServerLatency] 测量失败:', error);
          setLatency(-1); // 错误标记
        }
      }
    };

    // 立即测量一次
    measureLatency();

    // 定期测量
    const timer = setInterval(measureLatency, interval);

    return () => {
      clearInterval(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [interval, enabled]);

  return latency;
}
