/**
 * 整合网络延迟测量
 * 结合客户端到服务器延迟和服务器到SSH目标延迟
 */

import { useMemo } from 'react';
import { useServerLatency } from './useServerLatency';

interface NetworkNode {
  name: string;
  latency: number;
  icon?: "monitor" | "wifi" | "server";
}

interface NetworkLatency {
  /** 总延迟（毫秒） */
  total: number;
  /** 本地到 EasySSH 服务器延迟（毫秒） */
  local: number;
  /** EasySSH 服务器到 SSH 目标延迟（毫秒） */
  ssh: number;
  /** 节点列表（用于可视化） */
  nodes: NetworkNode[];
}

interface UseNetworkLatencyOptions {
  /** SSH 延迟（来自监控数据） */
  sshLatencyMs?: number;
  /** 若提供，则直接使用基于 WS 的本地 RTT，跳过 HTTP ping */
  localLatencyMsOverride?: number;
  /** 是否启用本地延迟测量 */
  enabled?: boolean;
  /** 本地延迟测量间隔（毫秒），默认 5000ms (5秒) */
  interval?: number;
}

/**
 * 综合网络延迟测量 Hook
 *
 * @example
 * const { metrics } = useMonitorWebSocket({ serverId });
 * const latency = useNetworkLatency({ sshLatencyMs: metrics?.sshLatencyMs });
 *
 * <NetworkLatencyPopover
 *   currentLatency={latency.total}
 *   nodes={latency.nodes}
 * />
 */
export function useNetworkLatency(options: UseNetworkLatencyOptions = {}): NetworkLatency {
  const { sshLatencyMs = 0, enabled = true, interval = 5000, localLatencyMsOverride } = options;

  // 优先使用来自 WS 的 RTT；否则回退到 HTTP HEAD /ping
  const serverLatency = useServerLatency({ interval, enabled });
  const localLatency = typeof localLatencyMsOverride === 'number'
    ? localLatencyMsOverride
    : serverLatency;

  // 计算并生成节点数据
  return useMemo(() => {
    const total = localLatency + sshLatencyMs;

    return {
      total,
      local: localLatency,
      ssh: sshLatencyMs,
      nodes: [
        { name: "本地", latency: 0, icon: "monitor" as const },
        { name: "EasySSH", latency: localLatency, icon: "wifi" as const },
        { name: "服务器", latency: total, icon: "server" as const },
      ],
    };
  }, [localLatency, sshLatencyMs]);
}
