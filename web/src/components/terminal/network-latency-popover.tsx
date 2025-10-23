"use client"

import { Globe, Monitor, Server, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface NetworkNode {
  name: string
  latency: number
  icon?: "monitor" | "wifi" | "server"
}

interface NetworkLatencyPopoverProps {
  /** 当前延迟(ms) */
  currentLatency: number
  /** 节点列表 */
  nodes?: NetworkNode[]
}

export function NetworkLatencyPopover({
  currentLatency,
  nodes = [
    { name: "本地", latency: 1, icon: "monitor" },
    { name: "EasySSH", latency: 2, icon: "wifi" },
    { name: "服务器", latency: 3, icon: "server" },
  ],
}: NetworkLatencyPopoverProps) {
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
  const getLatencyStatus = (latency: number) => {
    if (latency < 50) return {
      textColor: "text-status-connected",
      bgColor: "bg-status-connected",
      label: "优秀"
    }
    if (latency < 100) return {
      textColor: "text-status-warning",
      bgColor: "bg-status-warning",
      label: "良好"
    }
    return {
      textColor: "text-status-danger",
      bgColor: "bg-status-danger",
      label: "较慢"
    }
  }

  const status = getLatencyStatus(currentLatency)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-md transition-colors flex items-center gap-2 px-2.5 text-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="网络延迟"
        >
          <Globe className="h-3.5 w-3.5" />
          <div className="flex flex-col items-start leading-none text-left">
            <span className="text-[9px] uppercase font-semibold text-muted-foreground">
              RTT
            </span>
            <span className={`text-xs tabular-nums font-medium ${status.textColor}`}>
              {currentLatency} ms
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
              网络延迟: <span className={status.textColor}>{currentLatency} ms</span>
            </h4>
          </div>

          {/* 节点横向布局 */}
          <div className="relative px-6">
            {/* 节点和延迟混合布局 */}
            <div className="flex items-start">
              {nodes.map((node, index) => {
                const isLast = index === nodes.length - 1
                const nextNode = nodes[index + 1]
                const segmentLatency = nextNode ? nextNode.latency - node.latency : 0

                return (
                  <div key={node.name} className="flex items-start">
                    {/* 节点 */}
                    <div className="flex flex-col items-center gap-3">
                      {/* 节点图标 */}
                      <div className="text-foreground relative z-10 bg-background">
                        {getNodeIcon(node.icon)}
                      </div>

                      {/* 节点名称 */}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {node.name}
                      </span>
                    </div>

                    {/* 连接线和延迟 */}
                    {!isLast && (
                      <div className="flex flex-col items-center pt-[7px] px-4">
                        {/* 连接线 */}
                        <div className="w-full h-px bg-border mb-1.5" />

                        {/* 延迟信息 */}
                        <span className={`text-xs font-mono tabular-nums ${getLatencyStatus(segmentLatency).textColor}`}>
                          ~ {segmentLatency} ms
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
