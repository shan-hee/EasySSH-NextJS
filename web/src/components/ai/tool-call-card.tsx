"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Play,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ToolCall } from "@/lib/api/ai"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"

// 工具名称映射
const toolNames: Record<string, string> = {
  list_servers: "列出服务器",
  get_server_info: "获取服务器信息",
  execute_command: "执行命令",
  list_directory: "列出目录",
  read_file: "读取文件",
  write_file: "写入文件",
  create_directory: "创建目录",
  delete_file: "删除文件",
  get_system_info: "获取系统信息",
}

// 危险工具列表
const dangerousTools = ["execute_command", "write_file", "delete_file"]

interface ToolCallCardProps {
  toolCall: ToolCall
  status: "pending" | "executing" | "completed" | "error"
  result?: string
  isError?: boolean
  onExecute: () => void
  onCancel: () => void
}

export function ToolCallCard({
  toolCall,
  status,
  result,
  isError,
  onExecute,
  onCancel,
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toolName = toolNames[toolCall.name] || toolCall.name
  const isDangerous = toolCall.dangerous ?? dangerousTools.includes(toolCall.name)

  // 格式化参数显示
  const formatArgs = (args: Record<string, unknown>) => {
    return Object.entries(args).map(([key, value]) => {
      let displayValue = String(value)
      if (displayValue.length > 100) {
        displayValue = displayValue.slice(0, 100) + "..."
      }
      return { key, value: displayValue }
    })
  }

  const formattedArgs = formatArgs(toolCall.arguments)

  // 获取简短的参数摘要
  const getArgsSummary = () => {
    const args = Object.entries(toolCall.arguments)
    if (args.length === 0) return null

    // 优先显示关键参数
    const keyParams = ["command", "path", "server_id"]
    for (const key of keyParams) {
      const value = toolCall.arguments[key]
      if (value) {
        const strValue = String(value)
        return strValue.length > 40 ? strValue.slice(0, 40) + "..." : strValue
      }
    }
    return null
  }

  const argsSummary = getArgsSummary()

  return (
    <div className={cn(
      "rounded-lg border transition-all duration-200",
      status === "pending" && "border-border bg-card hover:border-primary/30",
      status === "executing" && "border-primary/50 bg-primary/5",
      status === "completed" && !isError && "border-green-500/30 bg-green-500/5",
      (status === "error" || isError) && "border-red-500/30 bg-red-500/5"
    )}>
      {/* 主要内容行 */}
      <div className="flex items-center gap-3 p-3">
        {/* 状态指示（不显示工具图标） */}
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          status === "pending" && "bg-muted",
          status === "executing" && "bg-primary/10",
          status === "completed" && !isError && "bg-green-500/10",
          (status === "error" || isError) && "bg-red-500/10"
        )}>
          {status === "executing" ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : status === "completed" && !isError ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : status === "error" || isError ? (
            <X className="h-4 w-4 text-red-500" />
          ) : (
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                isDangerous ? "bg-amber-500" : "bg-muted-foreground/60"
              )}
            />
          )}
        </div>

        {/* 工具信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{toolName}</span>
            {isDangerous && status === "pending" && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
          {argsSummary && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {argsSummary}
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {status === "pending" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={onCancel}
              >
                跳过
              </Button>
              <Button
                size="sm"
                className={cn(
                  "h-7 px-3 text-xs",
                  isDangerous && "bg-amber-500 hover:bg-amber-600 text-white"
                )}
                onClick={onExecute}
              >
                <Play className="h-3 w-3 mr-1" />
                执行
              </Button>
            </>
          )}

          {/* 展开/收起按钮 */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 展开的详细内容 */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-3">
            {/* 参数 */}
            {formattedArgs.length > 0 && (
              <div className="rounded-md bg-muted/50 p-2.5 text-xs font-mono">
                {formattedArgs.map(({ key, value }) => (
                  <div key={key} className="flex gap-2 py-0.5">
                    <span className="text-primary/70 shrink-0">{key}:</span>
                    <span className="text-foreground/80 break-all">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 执行结果 */}
            {result && (
              <div className={cn(
                "rounded-md p-2.5 text-xs font-mono max-h-48 overflow-auto",
                isError ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted/50"
              )}>
                <pre className="whitespace-pre-wrap break-all">{result}</pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

interface ToolCallListProps {
  toolCalls: Array<{
    toolCall: ToolCall
    status: "pending" | "executing" | "completed" | "error"
    result?: string
    isError?: boolean
  }>
  onExecute: (toolCallId: string) => void
  onCancel: (toolCallId: string) => void
  onExecuteAll: () => void
}

export function ToolCallList({
  toolCalls,
  onExecute,
  onCancel,
  onExecuteAll,
}: ToolCallListProps) {
  const pendingCount = toolCalls.filter(tc => tc.status === "pending").length
  const hasDangerous = toolCalls.some(
    (tc) => tc.status === "pending" && (tc.toolCall.dangerous ?? dangerousTools.includes(tc.toolCall.name))
  )

  return (
    <div className="space-y-2">
      {/* 批量操作栏 */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-muted-foreground">
            {pendingCount} 个操作等待确认
          </span>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 text-xs",
              hasDangerous && "border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
            )}
            onClick={onExecuteAll}
          >
            <Play className="h-3 w-3 mr-1" />
            全部执行
          </Button>
        </div>
      )}

      {/* 工具调用列表 */}
      <div className="space-y-2">
        {toolCalls.map((tc) => (
          <ToolCallCard
            key={tc.toolCall.id}
            toolCall={tc.toolCall}
            status={tc.status}
            result={tc.result}
            isError={tc.isError}
            onExecute={() => onExecute(tc.toolCall.id)}
            onCancel={() => onCancel(tc.toolCall.id)}
          />
        ))}
      </div>
    </div>
  )
}
