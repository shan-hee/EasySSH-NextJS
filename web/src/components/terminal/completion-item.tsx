/**
 * 补全项组件
 */

import { Terminal, FileText, Folder, Variable, History } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CompletionItem } from "@/lib/completion/types"
import { useTerminalTheme } from "@/contexts/terminal-theme-context"

interface CompletionItemProps {
  item: CompletionItem
  isSelected: boolean
  matchedPrefix: string
  showIcon?: boolean
  showDescription?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}

/**
 * 获取补全项图标
 */
function getIcon(type: CompletionItem["type"]) {
  switch (type) {
    case "command":
      return Terminal
    case "subcommand":
      return Terminal
    case "file":
      return FileText
    case "directory":
      return Folder
    case "variable":
      return Variable
    case "history":
      return History
    default:
      return Terminal
  }
}

/**
 * 获取来源标签文本
 */
function getSourceLabel(source: CompletionItem["source"]): string {
  switch (source) {
    case "local":
      return "本地"
    case "remote":
      return "远端"
    case "history":
      return "历史"
    case "script":
      return "脚本库"
    case "ai":
      return "AI"
    default:
      return ""
  }
}

/**
 * 高亮匹配的前缀
 */
function HighlightedText({
  text,
  prefix,
  theme,
}: {
  text: string
  prefix: string
  theme: ReturnType<typeof useTerminalTheme>
}) {
  if (!prefix || !text.toLowerCase().startsWith(prefix.toLowerCase())) {
    return <span className="text-zinc-800 dark:text-zinc-200">{text}</span>
  }

  const matched = text.slice(0, prefix.length)
  const remaining = text.slice(prefix.length)

  return (
    <>
      <span
        className="font-semibold"
        style={{ color: theme.green || "#22c55e" }}
      >
        {matched}
      </span>
      <span className="text-zinc-800 dark:text-zinc-200">{remaining}</span>
    </>
  )
}

export function CompletionItemComponent({
  item,
  isSelected,
  matchedPrefix,
  showIcon = true,
  showDescription = true,
  onClick,
  onMouseEnter,
}: CompletionItemProps) {
  const theme = useTerminalTheme()

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1 cursor-pointer transition-colors ${
        isSelected ? "bg-zinc-100 dark:bg-zinc-900" : "bg-transparent"
      }`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {/* 主文本 */}
      <div className="flex-1 min-w-0 font-mono text-sm">
        <HighlightedText
          text={item.displayText || item.text}
          prefix={matchedPrefix}
          theme={theme}
        />
      </div>

      {/* 描述（脚本名称） */}
      {showDescription && item.description && (
        <div className="flex-shrink-0 text-xs max-w-[200px] truncate text-zinc-500 dark:text-zinc-400">
          {item.description}
        </div>
      )}

      {/* 来源标签 */}
      <div className="flex-shrink-0">
        <span className="text-xs px-1.5 py-0.5 rounded font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
          {getSourceLabel(item.source)}
        </span>
      </div>
    </div>
  )
}
