"use client"

import { useMemo } from "react"
import { Globe, Monitor, Server, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTranslations } from "next-intl"
import { useSystemConfig } from "@/contexts/system-config-context"
import { useTerminalStore } from "@/stores/terminal-store"

interface NetworkNode {
  name: string
  latency: number | null
  icon?: "monitor" | "wifi" | "server"
}

interface NetworkLatencyPopoverProps {
  sessionId: string
}

/**
 * 网络延迟展示组件
 *
 * 从当前终端 WebSocket 获取链路延迟数据。
 * 这里不再使用监控采集耗时，避免把远端命令执行时间误判为网络 RTT。
 */
export function NetworkLatencyPopover({ sessionId }: NetworkLatencyPopoverProps) {
  const t = useTranslations("terminal")
  const { config } = useSystemConfig()
  const latencyData = useTerminalStore((state) => state.terminals.get(sessionId)?.latency)

  // 计算综合网络延迟和节点拓扑
  const { currentLatency, currentLatencyLowerBound, nodes } = useMemo(() => {
    const localLatency =
      latencyData?.terminalWsLatencySmoothedMs ??
      latencyData?.terminalWsLatencyMs ??
      null
    const sshLatency = latencyData?.terminalSshLatencyMs ?? null
    const total =
      localLatency !== null && sshLatency !== null
        ? localLatency + sshLatency
        : null
    const lowerBound = [localLatency, sshLatency].reduce<number | null>(
      (sum, latency) => latency === null ? sum : (sum ?? 0) + latency,
      null
    )

    const networkNodes: NetworkNode[] = [
      { name: t("latencyNodeLocal"), latency: 0, icon: "monitor" },
      {
        name: config?.system_name || "EasySSH",
        latency: localLatency,
        icon: "wifi",
      },
      { name: t("latencyNodeServer"), latency: total, icon: "server" },
    ]

    return {
      currentLatency: total,
      currentLatencyLowerBound: total === null ? lowerBound : null,
      nodes: networkNodes,
    }
    // t 和 config 只影响展示文案，不影响数值
  }, [
    latencyData?.terminalWsLatencyMs,
    latencyData?.terminalWsLatencySmoothedMs,
    latencyData?.terminalSshLatencyMs,
    t,
    config?.system_name,
  ])
  // 获取节点图标
  const getNodeIcon = (icon?: string) => {
    const iconClass = "h-3.5 w-3.5"
    switch (icon) {
      case "monitor":
        return <Monitor className={iconClass} />
      case "wifi":
        return <Wifi className={iconClass} />
      case "server":
        return <Server className={iconClass} />
      default:
        return <Globe className={iconClass} />
    }
  }
  // 根据延迟判断状态和颜色
  const getLatencyStatus = (latency: number | null) => {
    if (latency === null) return {
      textColor: "text-muted-foreground",
      bgColor: "bg-muted-foreground",
      label: t("latencyStatusUnknown"),
    }
    if (latency < 50) return {
      textColor: "text-status-connected",
      bgColor: "bg-status-connected",
      label: t("latencyStatusExcellent"),
    }
    if (latency < 100) return {
      textColor: "text-status-warning",
      bgColor: "bg-status-warning",
      label: t("latencyStatusGood"),
    }
    return {
      textColor: "text-status-danger",
      bgColor: "bg-status-danger",
      label: t("latencyStatusSlow"),
    }
  }

  const status = getLatencyStatus(currentLatency ?? currentLatencyLowerBound)
  const formatLatency = (latency: number | null) =>
    latency === null ? t("latencyStatusUnknown") : `${latency} ms`
  const formatTotalLatency = () => {
    if (currentLatency !== null) {
      return formatLatency(currentLatency)
    }
    if (currentLatencyLowerBound !== null) {
      return `≥ ${currentLatencyLowerBound} ms`
    }
    return t("latencyStatusUnknown")
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-md transition-colors flex items-center gap-2 px-2.5 text-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label={t("latencyAriaLabel")}
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col items-start leading-none text-left min-w-[3rem]">
            <span className="text-[9px] uppercase font-semibold text-muted-foreground">
              RTT
            </span>
            <span className={`text-xs tabular-nums font-medium ${status.textColor}`}>
              {formatTotalLatency()}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[320px] p-4"
        align="center"
        sideOffset={8}
      >
        <div className="space-y-4">
          {/* 标题 - 居中对齐 */}
          <div className="text-center">
            <h4 className="text-sm font-medium text-foreground">
              {t("latencyTitle")}:{" "}
              <span className={`${status.textColor} inline-block min-w-[4.5rem] text-center tabular-nums`}>
                {formatTotalLatency()}
              </span>
            </h4>
          </div>

          {/* 节点横向布局 */}
          <div className="relative px-6">
            {/* 节点和延迟混合布局 */}
            <div className="flex items-start">
              {nodes.map((node, index) => {
                const isLast = index === nodes.length - 1
                const nextNode = nodes[index + 1]
                const segmentLatency =
                  nextNode && node.latency !== null && nextNode.latency !== null
                    ? nextNode.latency - node.latency
                    : null

                return (
                  <div key={node.name} className="flex items-start">
                    {/* 节点 */}
                    <div className="flex flex-col items-center gap-3 w-[3.5rem]">
                      {/* 节点图标 */}
                      <div className="text-foreground relative z-10 bg-background w-[14px] h-[14px] flex items-center justify-center">
                        {getNodeIcon(node.icon)}
                      </div>

                      {/* 节点名称 */}
                      <span className="text-xs text-muted-foreground whitespace-nowrap text-center w-full">
                        {node.name}
                      </span>
                    </div>

                    {/* 连接线和延迟 */}
                    {!isLast && (
                      <div className="flex flex-col items-center pt-[7px] w-[80px]">
                        {/* 连接线 */}
                        <div className="w-full h-px bg-border mb-1.5" />

                        {/* 延迟信息 - 固定宽度，居中对齐 */}
                        <span className={`text-xs font-mono tabular-nums text-center ${getLatencyStatus(segmentLatency).textColor}`}>
                          ~ {formatLatency(segmentLatency)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
