"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Bot,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Terminal,
  Code,
  FileText,
  Zap,
  Download,
  Copy,
  Check,
  RotateCcw,
  Square,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Search,
  MoreHorizontal,
  Pencil,
  X,
  Brain,
  Wrench,
  Shield,
  Server as ServerIcon,
} from "lucide-react"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useAIChat } from "@/hooks/use-ai-chat"
import { useAIConfig } from "@/hooks/use-ai-config"
import type { ChatMessage, ToolCall, PermissionMode } from "@/lib/api/ai"
import { serversApi, type Server as ManagedServer } from "@/lib/api/servers"
import { ToolCallList } from "@/components/ai/tool-call-card"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/shadcn-io/ai/conversation"
import { Response } from "@/components/ui/shadcn-io/ai/response"
import { Loader } from "@/components/ui/shadcn-io/ai/loader"
import { Suggestions, Suggestion } from "@/components/ui/shadcn-io/ai/suggestion"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputModelSelect,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectValue,
} from "@/components/ui/shadcn-io/ai/prompt-input"
import { Actions, Action } from "@/components/ui/shadcn-io/ai/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ========== 类型定义 ==========
interface ToolCallState {
  toolCall: ToolCall
  status: "pending" | "executing" | "completed" | "error"
  result?: string
  isError?: boolean
}

interface ToolCallWithMessage extends ToolCallState {
  messageId: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  modelContent?: string
  timestamp: number
  toolCalls?: ToolCallState[]
}

interface ConversationData {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

interface AttachedFile {
  id: string
  file: File
  progress: number
  uploading: boolean
}

function createLocalId(prefix: string = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const ATTACHMENT_MAX_FILES = 6
const ATTACHMENT_MAX_BYTES_PER_FILE = 256 * 1024
const ATTACHMENT_MAX_CHARS_PER_FILE = 8000
const ATTACHMENT_MAX_TOTAL_CHARS = 24000

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()
  return ext ? ext.toLowerCase() : ""
}

function isTextLikeFile(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type.startsWith("text/")) return true
  if (
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("yaml") ||
    type.includes("csv") ||
    type.includes("javascript") ||
    type.includes("typescript") ||
    type.includes("x-sh")
  ) {
    return true
  }

  const textExtensions = new Set([
    "txt", "md", "json", "csv", "xml", "yaml", "yml", "log",
    "ini", "conf", "cfg", "env", "sh", "bash", "zsh", "py",
    "js", "ts", "tsx", "jsx", "go", "java", "c", "cpp", "h",
    "hpp", "rs", "sql", "toml", "properties",
  ])

  return textExtensions.has(getFileExtension(file.name))
}

async function buildAttachmentContext(files: AttachedFile[]): Promise<string> {
  if (files.length === 0) return ""

  const selected = files.slice(0, ATTACHMENT_MAX_FILES)
  const blocks: string[] = []
  let remainingChars = ATTACHMENT_MAX_TOTAL_CHARS

  for (const [index, entry] of selected.entries()) {
    const file = entry.file
    const fileMeta = `文件${index + 1}：${file.name}（${file.type || "未知类型"}，${(file.size / 1024).toFixed(1)}KB）`

    if (!isTextLikeFile(file)) {
      blocks.push(`${fileMeta}\n该文件为二进制或暂不支持直接解析文本内容，请结合文件名和类型给出建议。`)
      continue
    }

    try {
      const partialText = await file.slice(0, ATTACHMENT_MAX_BYTES_PER_FILE).text()
      const normalized = partialText.replace(/\r\n/g, "\n").trim()

      if (!normalized) {
        blocks.push(`${fileMeta}\n（文件内容为空）`)
        continue
      }

      const currentFileCharLimit = Math.min(ATTACHMENT_MAX_CHARS_PER_FILE, remainingChars)
      if (currentFileCharLimit <= 0) break

      let excerpt = normalized.slice(0, currentFileCharLimit)
      if (excerpt.includes("```")) {
        excerpt = excerpt.replace(/```/g, "` ` `")
      }

      const isTruncated =
        normalized.length > currentFileCharLimit ||
        file.size > ATTACHMENT_MAX_BYTES_PER_FILE

      blocks.push(
        `${fileMeta}\n内容摘录：\n\`\`\`text\n${excerpt}\n\`\`\`${isTruncated ? "\n（内容过长，已截断）" : ""}`
      )

      remainingChars -= excerpt.length
      if (remainingChars <= 0) break
    } catch {
      blocks.push(`${fileMeta}\n（读取失败，无法解析文本内容）`)
    }
  }

  if (blocks.length === 0) return ""

  const omittedCount = files.length - selected.length
  const omittedSuffix = omittedCount > 0 ? `\n\n其余 ${omittedCount} 个附件未纳入上下文（超过数量限制）。` : ""

  return `【附件上下文】以下为用户随消息附带的文件信息，请作为补充上下文：\n\n${blocks.join("\n\n---\n\n")}${omittedSuffix}`
}

// ========== 解析思考内容 ==========
interface ParsedContent {
  thinking: string | null
  content: string
}

/**
 * 解析 AI 响应中的 <think> 标签
 * 支持格式：<think>思考内容</think>正文内容
 */
function parseThinkingContent(text: string): ParsedContent {
  // 匹配 <think>...</think> 标签（支持多行）
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i)

  if (thinkMatch) {
    const thinking = thinkMatch[1].trim()
    // 移除 <think>...</think> 部分，保留剩余内容
    const content = text.replace(/<think>[\s\S]*?<\/think>/i, "").trim()
    return { thinking, content }
  }

  // 处理未闭合的 <think> 标签（流式传输中可能出现）
  const unclosedMatch = text.match(/<think>([\s\S]*)$/i)
  if (unclosedMatch) {
    return { thinking: unclosedMatch[1].trim(), content: "" }
  }

  return { thinking: null, content: text }
}

// ========== 解析工具状态标签 ==========
interface ParsedToolStatus {
  toolStatus: string | null  // 工具执行状态描述
  content: string            // 移除工具状态标签后的内容
}

/**
 * 解析 AI 响应中的 <tool-status> 标签
 * 支持格式：<tool-status>正在查询服务器列表</tool-status>
 */
function parseToolStatus(text: string): ParsedToolStatus {
  // 匹配最后一个 <tool-status>...</tool-status> 标签
  const toolStatusMatches = text.match(/<tool-status>([\s\S]*?)<\/tool-status>/gi)

  if (toolStatusMatches && toolStatusMatches.length > 0) {
    // 获取最后一个工具状态
    const lastMatch = toolStatusMatches[toolStatusMatches.length - 1]
    const statusMatch = lastMatch.match(/<tool-status>([\s\S]*?)<\/tool-status>/i)
    const toolStatus = statusMatch ? statusMatch[1].trim() : null

    // 移除所有 <tool-status>...</tool-status> 部分
    const content = text.replace(/<tool-status>[\s\S]*?<\/tool-status>/gi, "").trim()
    return { toolStatus, content }
  }

  // 处理未闭合的 <tool-status> 标签（流式传输中可能出现）
  const unclosedMatch = text.match(/<tool-status>([\s\S]*)$/i)
  if (unclosedMatch) {
    return { toolStatus: unclosedMatch[1].trim(), content: text.replace(/<tool-status>[\s\S]*$/i, "").trim() }
  }

  return { toolStatus: null, content: text }
}

// ========== 历史消息净化 ==========
function sanitizeAssistantContentForHistory(text: string): string {
  const withoutToolStatus = parseToolStatus(text).content
  return parseThinkingContent(withoutToolStatus).content
}

function countUnresolvedToolCalls(messages: Message[], ignoreToolCallIds?: Set<string>): number {
  let count = 0
  for (const msg of messages) {
    for (const tc of msg.toolCalls || []) {
      if (ignoreToolCallIds?.has(tc.toolCall.id)) continue
      if (tc.status === "pending" || tc.status === "executing") count++
    }
  }
  return count
}

function collectGroupedToolCalls(messages: Message[]): ToolCallWithMessage[] {
  const toolCallMap = new Map<string, ToolCallWithMessage>()
  const orderedIds: string[] = []

  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.toolCalls || msg.toolCalls.length === 0) continue
    for (const tc of msg.toolCalls) {
      if (!toolCallMap.has(tc.toolCall.id)) {
        orderedIds.push(tc.toolCall.id)
      }
      toolCallMap.set(tc.toolCall.id, {
        ...tc,
        messageId: msg.id,
      })
    }
  }

  return orderedIds
    .map((id) => toolCallMap.get(id))
    .filter((item): item is ToolCallWithMessage => Boolean(item))
}

function buildHistoryMessages(
  messages: Message[],
  toolResultOverrides?: Record<string, string>
): ChatMessage[] {
  const result: ChatMessage[] = []

  for (const msg of messages) {
    const base: ChatMessage = {
      role: msg.role,
      content:
        msg.role === "assistant"
          ? sanitizeAssistantContentForHistory(msg.content)
          : msg.modelContent || msg.content,
    }

    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      base.tool_calls = msg.toolCalls.map((tc) => tc.toolCall)
    }

    result.push(base)

    // 将已完成的工具执行结果补成 role=tool 消息，保证协议完整
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        const overrideExists =
          toolResultOverrides &&
          Object.prototype.hasOwnProperty.call(toolResultOverrides, tc.toolCall.id)
        const isFinished = tc.status === "completed" || tc.status === "error" || overrideExists
        if (!isFinished) continue
        const content = overrideExists ? toolResultOverrides![tc.toolCall.id] : tc.result
        if (content === undefined || content === null) continue

        result.push({
          role: "tool",
          content,
          tool_call_id: tc.toolCall.id,
        })
      }
    }
  }

  return result
}

// ========== 圆环进度条组件 ==========
function CircularProgress({ progress, size = 32 }: { progress: number; size?: number }) {
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* 背景圆环 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      {/* 进度圆环 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-200"
      />
    </svg>
  )
}

// ========== 波浪拂过效果组件 ==========
function WaveText({ text }: { text: string }) {
  return (
    <span className="font-medium inline-flex">
      {text.split("").map((char, index) => (
        <span
          key={index}
          className="animate-pulse"
          style={{
            animationDelay: `${index * 150}ms`,
            animationDuration: "2s",
          }}
        >
          {char}
        </span>
      ))}
    </span>
  )
}

// ========== 工具执行状态组件（带呼吸动画） ==========
function ToolStatusIndicator({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
      <Wrench className="h-4 w-4 animate-pulse" />
      <WaveText text={status} />
    </div>
  )
}

// ========== 思考内容折叠组件 ==========
function ThinkingBlock({
  thinking,
  isStreaming,
  t
}: {
  thinking: string
  isStreaming?: boolean
  t: ReturnType<typeof useTranslations<"aiAssistant">>
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Brain className="h-4 w-4" />
          {/* 流式输出时显示波浪效果的"思考中..."，完成后显示"思考过程" */}
          {isStreaming ? (
            <WaveText text={t("thinkingLabel")} />
          ) : (
            <span>{t("thinkingProcess")}</span>
          )}
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ========== 消息组件 ==========
function MessageBubble({
  message,
  onCopy,
  onRegenerate,
  onEdit,
  copiedId,
  isLast,
  isLoading,
  isStreaming,
  t,
}: {
  message: Message
  onCopy: (content: string, id: string) => void
  onRegenerate?: () => void
  onEdit?: (messageId: string, newContent: string) => void
  copiedId: string | null
  isLast: boolean
  isLoading: boolean
  isStreaming?: boolean
  t: ReturnType<typeof useTranslations<"aiAssistant">>
}) {
  const isUser = message.role === "user"
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // 进入编辑模式时聚焦
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus()
      // 将光标移到末尾
      editTextareaRef.current.selectionStart = editTextareaRef.current.value.length
    }
  }, [isEditing])

  // 解析 AI 消息中的思考内容
  const parsedContent = useMemo(() => {
    if (isUser) return { thinking: null, content: message.content }
    return parseThinkingContent(message.content)
  }, [message.content, isUser])

  // 判断是否正在流式输出思考内容
  const isThinkingStreaming = Boolean(isStreaming && parsedContent.thinking && !parsedContent.content)

  // 处理编辑提交
  const handleEditSubmit = useCallback(() => {
    if (!editContent.trim() || !onEdit) return
    onEdit(message.id, editContent.trim())
    setIsEditing(false)
  }, [editContent, message.id, onEdit])

  // 处理取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditContent(message.content)
    setIsEditing(false)
  }, [message.content])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    } else if (e.key === "Escape") {
      handleCancelEdit()
    }
  }, [handleEditSubmit, handleCancelEdit])

  // 用户消息 - 简约风格，右对齐
  if (isUser) {
    // 编辑模式
    if (isEditing) {
      return (
        <div className="flex justify-end animate-in fade-in duration-200">
          <div className="flex flex-col gap-2 max-w-[75%] w-full">
            <textarea
              ref={editTextareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-muted text-foreground border border-primary/50 focus:border-primary focus:outline-none resize-none min-h-[60px]"
              rows={Math.min(10, editContent.split("\n").length + 1)}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="h-7 px-3 text-xs"
              >
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleEditSubmit}
                disabled={!editContent.trim()}
                className="h-7 px-3 text-xs"
              >
                {t("send")}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // 正常显示模式
    return (
      <div className="group flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* 消息内容 */}
        <div className="flex flex-col gap-1.5 max-w-[75%] items-end">
          <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-muted text-foreground rounded-br-md">
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          </div>

          {/* 消息元信息和操作 */}
          <div className="flex items-center gap-2 px-1 flex-row-reverse">
            <span className="text-[11px] text-muted-foreground/70">
              {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <Actions className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Action
                tooltip={copiedId === message.id ? t("copied") : t("copy")}
                onClick={() => onCopy(message.content, message.id)}
                className="h-6 w-6"
              >
                {copiedId === message.id ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Action>
              {onEdit && !isLoading && (
                <Action
                  tooltip={t("edit")}
                  onClick={() => setIsEditing(true)}
                  className="h-6 w-6"
                >
                  <Pencil className="h-3 w-3" />
                </Action>
              )}
            </Actions>
          </div>
        </div>
      </div>
    )
  }

  // AI 消息 - 不使用气泡，直接输出内容
  return (
    <div className="group flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 头像 */}
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
        <Bot className="h-4 w-4 text-white" />
      </div>

      {/* 消息内容 */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* 思考内容 - 折叠显示 */}
        {parsedContent.thinking && (
          <ThinkingBlock
            thinking={parsedContent.thinking}
            isStreaming={isThinkingStreaming}
            t={t}
          />
        )}

        {/* 正文内容 - 直接显示，无气泡 */}
        {parsedContent.content && (
          <div className="text-sm leading-relaxed text-foreground">
            <Response className="prose prose-sm dark:prose-invert max-w-none">
              {parsedContent.content}
            </Response>
          </div>
        )}

        {/* 消息元信息和操作 */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/70">
            {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          <Actions className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Action
              tooltip={copiedId === message.id ? t("copied") : t("copy")}
              onClick={() => onCopy(parsedContent.content || message.content, message.id)}
              className="h-6 w-6"
            >
              {copiedId === message.id ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Action>
            {isLast && !isLoading && onRegenerate && (
              <Action
                tooltip={t("regenerate")}
                onClick={onRegenerate}
                className="h-6 w-6"
              >
                <RotateCcw className="h-3 w-3" />
              </Action>
            )}
          </Actions>
        </div>
      </div>
    </div>
  )
}

// ========== AI 响应区块（统一头像，内容平滑切换） ==========
function AIResponseBlock({
  message,
  groupedToolCalls,
  isWaitingForResponse,
  isStreaming,
  isStreamingByGap,
  onCopy,
  onRegenerate,
  copiedId,
  isLast,
  isLoading,
  t,
  conversationId,
  onExecuteToolCall,
  onCancelToolCall,
  onExecuteAllToolCalls,
}: {
  message?: Message
  groupedToolCalls?: ToolCallWithMessage[]
  isWaitingForResponse: boolean
  isStreaming?: boolean
  isStreamingByGap?: boolean
  onCopy: (content: string, id: string) => void
  onRegenerate?: () => void
  copiedId: string | null
  isLast: boolean
  isLoading: boolean
  t: ReturnType<typeof useTranslations<"aiAssistant">>
  conversationId?: string
  onExecuteToolCall?: (conversationId: string, messageId: string, toolCallId: string) => void
  onCancelToolCall?: (conversationId: string, messageId: string, toolCallId: string) => void
  onExecuteAllToolCalls?: (conversationId: string, messageId: string) => void
}) {
  // 解析 AI 消息中的工具状态和思考内容
  const { parsedContent, toolStatus } = useMemo(() => {
    if (!message) return { parsedContent: { thinking: null, content: "" }, toolStatus: null }
    // 先解析工具状态
    const toolStatusResult = parseToolStatus(message.content)
    // 再解析思考内容（从移除工具状态后的内容中解析）
    const thinkingResult = parseThinkingContent(toolStatusResult.content)
    return {
      parsedContent: thinkingResult,
      toolStatus: toolStatusResult.toolStatus
    }
  }, [message])

  // 判断是否正在流式输出思考内容
  const isThinkingStreaming = Boolean(isStreaming && parsedContent.thinking && !parsedContent.content)

  const displayToolCalls = useMemo(() => {
    if (groupedToolCalls && groupedToolCalls.length > 0) {
      return groupedToolCalls
    }
    if (!message?.toolCalls || !message.id) {
      return [] as ToolCallWithMessage[]
    }
    return message.toolCalls.map((tc) => ({
      ...tc,
      messageId: message.id,
    }))
  }, [groupedToolCalls, message])

  const toolCallMessageMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const tc of displayToolCalls) {
      map[tc.toolCall.id] = tc.messageId
    }
    return map
  }, [displayToolCalls])

  const leadingToolCalls = useMemo(() => {
    if (!message?.id) return [] as ToolCallWithMessage[]
    return displayToolCalls.filter((tc) => tc.messageId !== message.id)
  }, [displayToolCalls, message])

  const trailingToolCalls = useMemo(() => {
    if (!message?.id) return displayToolCalls
    return displayToolCalls.filter((tc) => tc.messageId === message.id)
  }, [displayToolCalls, message])

  // 判断当前显示状态
  const showLoadingIndicator = isWaitingForResponse && !message?.content
  const showThinkingBlock = parsedContent.thinking
  const showContent = parsedContent.content
  // 只在流式输出时显示工具状态（工具执行完成后不再显示）
  const showToolStatus = isStreaming && toolStatus
  // 工具调用过程中，可能出现无文本空档，这里补一个“思考中...”指示
  const hasProgressedToolCall = displayToolCalls.some(
    (tc) => tc.status === "executing" || tc.status === "completed" || tc.status === "error"
  )
  const showToolThinkingIndicator = Boolean(
    isStreamingByGap &&
    !showToolStatus &&
    !showThinkingBlock &&
    hasProgressedToolCall
  )

  // 是否有实际内容（思考或正文）
  const hasContent = showThinkingBlock || showContent

  const renderToolCallList = (toolCalls: ToolCallWithMessage[]) => {
    if (!conversationId || toolCalls.length === 0) return null

    return (
      <div className="mt-2 animate-in fade-in duration-200">
        <ToolCallList
          toolCalls={toolCalls.map((item) => ({
            toolCall: item.toolCall,
            status: item.status,
            result: item.result,
            isError: item.isError,
          }))}
          onExecute={(toolCallId) => {
            const targetMessageId = toolCallMessageMap[toolCallId]
            if (!targetMessageId) return
            onExecuteToolCall?.(conversationId, targetMessageId, toolCallId)
          }}
          onCancel={(toolCallId) => {
            const targetMessageId = toolCallMessageMap[toolCallId]
            if (!targetMessageId) return
            onCancelToolCall?.(conversationId, targetMessageId, toolCallId)
          }}
          onExecuteAll={() => {
            const firstMessageId = toolCalls[0]?.messageId
            if (!firstMessageId) return
            onExecuteAllToolCalls?.(conversationId, firstMessageId)
          }}
        />
      </div>
    )
  }

  return (
    <div className="group flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 头像 - 简约风格 */}
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Bot className="h-4 w-4 text-foreground" />
      </div>

      {/* 内容区域 - 平滑切换 */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* 加载指示器 - 等待响应时只显示旋转图标，与头像底部对齐 */}
        {showLoadingIndicator && (
          <div className="h-8 flex items-end pb-1">
            <Loader size={16} className="text-muted-foreground" />
          </div>
        )}

        {/* 工具执行状态 - 带呼吸动画 */}
        {showToolStatus && (
          <div className="animate-in fade-in duration-200 pt-1">
            <ToolStatusIndicator status={toolStatus} />
          </div>
        )}

        {/* 聚合模式下，前序轮次产生的工具卡片放在正文前，保持时间顺序 */}
        {renderToolCallList(leadingToolCalls)}

        {/* 思考内容 - 折叠显示，位置与加载指示器对齐 */}
        {showThinkingBlock && (
          <div className="animate-in fade-in duration-200 pt-3">
            <ThinkingBlock
              thinking={parsedContent.thinking!}
              isStreaming={isThinkingStreaming}
              t={t}
            />
          </div>
        )}

        {/* 正文内容 - 位置与加载指示器对齐 */}
        {showContent && !showThinkingBlock && (
          <div className="text-sm leading-relaxed text-foreground animate-in fade-in duration-200 pt-3">
            <Response className="prose prose-sm dark:prose-invert max-w-none">
              {parsedContent.content}
            </Response>
          </div>
        )}

        {/* 正文内容 - 思考内容后面的正文，不需要额外上边距 */}
        {showContent && showThinkingBlock && (
          <div className="text-sm leading-relaxed text-foreground animate-in fade-in duration-200">
            <Response className="prose prose-sm dark:prose-invert max-w-none">
              {parsedContent.content}
            </Response>
          </div>
        )}

        {/* 当前轮次的工具卡片仍放在正文后 */}
        {renderToolCallList(trailingToolCalls)}

        {/* 工具调用空档期提示（放在工具列表下方） */}
        {showToolThinkingIndicator && (
          <div className="animate-in fade-in duration-200 pt-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader size={14} className="text-muted-foreground" />
              <WaveText text={t("thinkingLabel")} />
            </div>
          </div>
        )}

        {/* 消息元信息和操作 - 仅在有内容时显示 */}
        {message && hasContent && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground/70">
              {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <Actions className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Action
                tooltip={copiedId === message.id ? t("copied") : t("copy")}
                onClick={() => onCopy(parsedContent.content || message.content, message.id)}
                className="h-6 w-6"
              >
                {copiedId === message.id ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Action>
              {isLast && !isLoading && onRegenerate && (
                <Action
                  tooltip={t("regenerate")}
                  onClick={onRegenerate}
                  className="h-6 w-6"
                >
                  <RotateCcw className="h-3 w-3" />
                </Action>
              )}
            </Actions>
          </div>
        )}
      </div>
    </div>
  )
}

// ========== 欢迎面板 ==========
function WelcomePanel({
  onUseTemplate,
  t,
}: {
  onUseTemplate: (prompt: string) => void
  t: ReturnType<typeof useTranslations<"aiAssistant">>
}) {
  const templates = useMemo(
    () => [
      {
        icon: Terminal,
        titleKey: "templateRunCommandTitle" as const,
        descKey: "templateRunCommandDesc" as const,
        promptKey: "templateRunCommandPrompt" as const,
      },
      {
        icon: Code,
        titleKey: "templateScriptTitle" as const,
        descKey: "templateScriptDesc" as const,
        promptKey: "templateScriptPrompt" as const,
      },
      {
        icon: FileText,
        titleKey: "templateLogsTitle" as const,
        descKey: "templateLogsDesc" as const,
        promptKey: "templateLogsPrompt" as const,
      },
      {
        icon: Zap,
        titleKey: "templatePerfTitle" as const,
        descKey: "templatePerfDesc" as const,
        promptKey: "templatePerfPrompt" as const,
      },
    ],
    []
  )

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      {/* 大图标 - 简约风格 */}
      <div className="mb-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Bot className="h-8 w-8 text-foreground" />
        </div>
      </div>

      {/* 标题 */}
      <h2 className="text-2xl font-semibold mb-2">{t("cardTitle")}</h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        {t("emptyDescriptionIntro")}
      </p>

      {/* 快捷模板网格 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 w-full max-w-3xl">
        {templates.map((template, index) => {
          const Icon = template.icon
          return (
            <button
              key={index}
              className={cn(
                "group relative p-4 rounded-xl border bg-card/50 backdrop-blur",
                "hover:bg-accent/50 hover:border-primary/30 hover:shadow-md",
                "transition-all duration-200 text-left"
              )}
              onClick={() => onUseTemplate(t(template.promptKey))}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1 truncate">
                    {t(template.titleKey)}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {t(template.descKey)}
                  </p>
                </div>
              </div>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ========== 主页面组件 ==========
export default function AIAssistantPage() {
  const t = useTranslations("aiAssistant")
  const [conversations, setConversations] = useState<ConversationData[]>([])
  const [currentConversationId, setCurrentConversationId] = useState("")
  const [inputMessage, setInputMessage] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isNewChat, setIsNewChat] = useState(false)
  const [isPreparingAttachments, setIsPreparingAttachments] = useState(false)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("balanced")
  const [availableServers, setAvailableServers] = useState<ManagedServer[]>([])
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([])
  const [isLoadingServers, setIsLoadingServers] = useState(false)
  const [serversLoaded, setServersLoaded] = useState(false)
  const { ready } = useAuthReady()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadingServersRef = useRef(false)
  const uploadIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const conversationsRef = useRef<ConversationData[]>([])
  // 文件附件状态，包含上传进度
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])

  // AI 配置状态
  const { isConfigured, isLoading: isConfigLoading, models, model: defaultModel } = useAIConfig()

  // 当获取到配置时，设置默认选中模型
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(defaultModel || models[0])
    }
  }, [models, defaultModel, selectedModel])

  // AI 聊天 Hook
  const {
    sendMessageWithTools,
    executeToolCall,
    isLoading,
    stop: stopGenerating,
    clearError,
  } = useAIChat()

  // 初始化
  useEffect(() => {
    setMounted(true)
    // 初始为新聊天模式，不创建空会话
    setIsNewChat(true)
  }, [])

  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId),
    [conversations, currentConversationId]
  )

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const loadServersForReference = useCallback(async () => {
    if (loadingServersRef.current) return
    loadingServersRef.current = true
    setIsLoadingServers(true)
    try {
      const response = await serversApi.list({ page: 1, limit: 1000 })
      setAvailableServers(response.data || [])
      setServersLoaded(true)
    } catch (error) {
      console.error("Failed to load servers for AI reference:", error)
    } finally {
      loadingServersRef.current = false
      setIsLoadingServers(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || serversLoaded) return
    void loadServersForReference()
  }, [ready, serversLoaded, loadServersForReference])

  const clearUploadInterval = useCallback((fileId: string) => {
    const interval = uploadIntervalsRef.current.get(fileId)
    if (interval) {
      clearInterval(interval)
      uploadIntervalsRef.current.delete(fileId)
    }
  }, [])

  const clearAllUploadIntervals = useCallback(() => {
    uploadIntervalsRef.current.forEach((interval) => {
      clearInterval(interval)
    })
    uploadIntervalsRef.current.clear()
  }, [])

  useEffect(() => {
    return () => {
      clearAllUploadIntervals()
    }
  }, [clearAllUploadIntervals])

  const unresolvedToolCallCount = useMemo(() => {
    if (!currentConversation) return 0
    return countUnresolvedToolCalls(currentConversation.messages)
  }, [currentConversation])

  const hasUnresolvedToolCalls = unresolvedToolCallCount > 0

  const permissionModeOptions = useMemo(
    () => [
      {
        value: "readonly" as PermissionMode,
        label: t("permissionModeReadonly"),
        description: t("permissionModeReadonlyDesc"),
        rule: t("permissionContextReadonlyRule"),
      },
      {
        value: "balanced" as PermissionMode,
        label: t("permissionModeBalanced"),
        description: t("permissionModeBalancedDesc"),
        rule: t("permissionContextBalancedRule"),
      },
      {
        value: "privileged" as PermissionMode,
        label: t("permissionModePrivileged"),
        description: t("permissionModePrivilegedDesc"),
        rule: t("permissionContextPrivilegedRule"),
      },
    ],
    [t]
  )

  const selectedPermissionOption = useMemo(
    () => permissionModeOptions.find((option) => option.value === permissionMode) || permissionModeOptions[1],
    [permissionMode, permissionModeOptions]
  )

  const selectedReferencedServers = useMemo(() => {
    if (selectedServerIds.length === 0) return [] as ManagedServer[]
    const selectedSet = new Set(selectedServerIds)
    return availableServers.filter((server) => selectedSet.has(server.id))
  }, [availableServers, selectedServerIds])

  const toggleReferencedServer = useCallback((serverId: string) => {
    setSelectedServerIds((prev) =>
      prev.includes(serverId)
        ? prev.filter((id) => id !== serverId)
        : [...prev, serverId]
    )
  }, [])

  const permissionContextForModel = useMemo(() => {
    const current = selectedPermissionOption || permissionModeOptions[1]
    return `${t("permissionContextHeader", { mode: current.label })}\n${current.rule}`
  }, [selectedPermissionOption, permissionModeOptions, t])

  const serverReferenceContextForModel = useMemo(() => {
    if (selectedReferencedServers.length === 0) return ""
    const lines = selectedReferencedServers.map((server, idx) => {
      const displayName = server.name?.trim() || server.host
      return `${idx + 1}. ${displayName}（ID=${server.id}, ${server.username}@${server.host}:${server.port}, ${server.status}）`
    })
    return `${t("referenceContextHeader")}\n${lines.join("\n")}\n${t("referenceContextRule")}`
  }, [selectedReferencedServers, t])

  // 过滤后的对话列表
  // 开发环境：显示所有会话（包括空会话，用于测试）
  // 生产环境：只显示有消息的会话
  const filteredConversations = useMemo(
    () => {
      const baseList = process.env.NODE_ENV === "development"
        ? conversations
        : conversations.filter((c) => c.messages.length > 0)
      return searchQuery.trim()
        ? baseList.filter((c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : baseList
    },
    [conversations, searchQuery]
  )

  // 处理工具调用
  const handleToolCallsReceived = useCallback(
    (toolCalls: ToolCall[], targetConversationId: string, assistantMessageId: string) => {
      const toolCallStates: ToolCallState[] = toolCalls.map((tc) => ({
        toolCall: tc,
        status: "pending" as const,
      }))

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== targetConversationId) return conv

          const hasAssistantMessage = conv.messages.some(
            (msg) => msg.id === assistantMessageId
          )

          const updatedMessages = hasAssistantMessage
            ? conv.messages.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, toolCalls: toolCallStates }
                  : msg
              )
            : [
                ...conv.messages,
                {
                  id: assistantMessageId,
                  role: "assistant" as const,
                  content: "",
                  timestamp: Date.now(),
                  toolCalls: toolCallStates,
                },
              ]

          return {
            ...conv,
            messages: updatedMessages,
            updatedAt: Date.now(),
          }
        })
      )
    },
    []
  )

  // 执行单个工具调用（内部函数，不触发继续对话）
  const executeToolCallInternal = useCallback(
    async (conversationId: string, messageId: string, toolCallId: string): Promise<{ toolCallId: string; content: string; isError: boolean } | null> => {
      // 找到工具调用
      const conv = conversationsRef.current.find((c) => c.id === conversationId)
      const msg = conv?.messages.find((m) => m.id === messageId)
      const toolCallState = msg?.toolCalls?.find((tc) => tc.toolCall.id === toolCallId)
      if (!toolCallState) return null

      // 更新状态为执行中
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c
          return {
            ...c,
            messages: c.messages.map((m) => {
              if (m.id !== messageId) return m
              return {
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.toolCall.id === toolCallId
                    ? { ...tc, status: "executing" as const }
                    : tc
                ),
              }
            }),
          }
        })
      )

      // 执行工具
      const result = await executeToolCall(toolCallState.toolCall, permissionMode)

      // 更新结果
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c
          return {
            ...c,
            messages: c.messages.map((m) => {
              if (m.id !== messageId) return m
              return {
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.toolCall.id === toolCallId
                    ? {
                        ...tc,
                        status: result.isError ? ("error" as const) : ("completed" as const),
                        result: result.content,
                        isError: result.isError,
                      }
                    : tc
                ),
              }
            }),
          }
        })
      )

      return { toolCallId, content: result.content, isError: result.isError }
    },
    [executeToolCall, permissionMode]
  )

  // 执行单个工具调用并继续对话
  const handleExecuteToolCall = useCallback(
    async (conversationId: string, messageId: string, toolCallId: string) => {
      const result = await executeToolCallInternal(conversationId, messageId, toolCallId)
      if (!result) return

      // 获取当前对话的所有消息，构建历史
      const conv = conversationsRef.current.find((c) => c.id === conversationId)
      if (!conv) return

      // 找到包含工具调用的消息
      const assistantMsg = conv.messages.find((m) => m.id === messageId)
      if (!assistantMsg) return
      const remainingUnresolved =
        assistantMsg.toolCalls?.filter(
          (tc) =>
            (tc.status === "pending" || tc.status === "executing") &&
            tc.toolCall.id !== toolCallId
        ).length || 0
      if (remainingUnresolved > 0) return
      if (countUnresolvedToolCalls(conv.messages, new Set([toolCallId])) > 0) return

      // 构建消息历史（包含工具结果）
      const historyMessages: ChatMessage[] = buildHistoryMessages(conv.messages, {
        [result.toolCallId]: result.content,
      })

      // 预生成新的 AI 消息 ID
      const newAssistantMessageId = createLocalId("assistant")
      setStreamingMessageId(newAssistantMessageId)

      // 处理流式内容更新
      const handleDelta = (delta: string) => {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c

            const existingAssistantMsg = c.messages.find(
              (msg) => msg.id === newAssistantMessageId
            )

            if (existingAssistantMsg) {
              return {
                ...c,
                messages: c.messages.map((msg) =>
                  msg.id === newAssistantMessageId
                    ? { ...msg, content: msg.content + delta }
                    : msg
                ),
                updatedAt: Date.now(),
              }
            } else {
              const newMessage: Message = {
                id: newAssistantMessageId,
                role: "assistant",
                content: delta,
                timestamp: Date.now(),
              }
              return {
                ...c,
                messages: [...c.messages, newMessage],
                updatedAt: Date.now(),
              }
            }
          })
        )
      }

      try {
        // 继续对话，让 AI 处理工具结果
        await sendMessageWithTools(
          historyMessages,
          handleDelta,
          (toolCalls) => handleToolCallsReceived(toolCalls, conversationId, newAssistantMessageId),
          selectedModel || undefined,
          permissionMode
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t("chatError")
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c
            const existingMsg = c.messages.find((msg) => msg.id === newAssistantMessageId)
            if (existingMsg) {
              return {
                ...c,
                messages: c.messages.map((msg) =>
                  msg.id === newAssistantMessageId
                    ? { ...msg, content: `❌ ${errorMessage}` }
                    : msg
                ),
              }
            } else {
              return {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: newAssistantMessageId,
                    role: "assistant" as const,
                    content: `❌ ${errorMessage}`,
                    timestamp: Date.now(),
                  },
                ],
              }
            }
          })
        )
      } finally {
        setStreamingMessageId(null)
      }
    },
    [executeToolCallInternal, sendMessageWithTools, handleToolCallsReceived, selectedModel, permissionMode, t]
  )

  // 取消工具调用
  const handleCancelToolCall = useCallback(
    (conversationId: string, messageId: string, toolCallId: string) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c
          return {
            ...c,
            messages: c.messages.map((m) => {
              if (m.id !== messageId) return m
              return {
                ...m,
                toolCalls: m.toolCalls?.filter((tc) => tc.toolCall.id !== toolCallId),
              }
            }),
          }
        })
      )
    },
    []
  )

  // 执行所有待处理的工具调用并继续对话
  const handleExecuteAllToolCalls = useCallback(
    async (conversationId: string, messageId: string) => {
      const conv = conversationsRef.current.find((c) => c.id === conversationId)
      if (!conv) return

      const pendingToolCalls = conv.messages.flatMap((msg) =>
        (msg.toolCalls || [])
          .filter((tc) => tc.status === "pending")
          .map((tc) => ({
            messageId: msg.id,
            toolCallId: tc.toolCall.id,
          }))
      )

      if (pendingToolCalls.length === 0) return

      const prioritizedPendingToolCalls = [
        ...pendingToolCalls.filter((tc) => tc.messageId === messageId),
        ...pendingToolCalls.filter((tc) => tc.messageId !== messageId),
      ]

      // 执行所有工具并收集结果
      const results: Array<{ toolCallId: string; content: string; isError: boolean }> = []
      for (const tc of prioritizedPendingToolCalls) {
        const result = await executeToolCallInternal(conversationId, tc.messageId, tc.toolCallId)
        if (result) {
          results.push(result)
        }
      }

      if (results.length === 0) return

      // 重新获取对话（因为状态可能已更新）
      const updatedConv = conversationsRef.current.find((c) => c.id === conversationId)
      if (!updatedConv) return

      const ignoreIds = new Set(results.map((r) => r.toolCallId))
      if (countUnresolvedToolCalls(updatedConv.messages, ignoreIds) > 0) return

      const toolResultOverrides = results.reduce<Record<string, string>>((acc, r) => {
        acc[r.toolCallId] = r.content
        return acc
      }, {})

      // 构建消息历史（包含所有工具结果）
      const historyMessages: ChatMessage[] = buildHistoryMessages(updatedConv.messages, toolResultOverrides)

      // 预生成新的 AI 消息 ID
      const newAssistantMessageId = createLocalId("assistant")
      setStreamingMessageId(newAssistantMessageId)

      // 处理流式内容更新
      const handleDelta = (delta: string) => {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c

            const existingAssistantMsg = c.messages.find(
              (m) => m.id === newAssistantMessageId
            )

            if (existingAssistantMsg) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === newAssistantMessageId
                    ? { ...m, content: m.content + delta }
                    : m
                ),
                updatedAt: Date.now(),
              }
            } else {
              const newMessage: Message = {
                id: newAssistantMessageId,
                role: "assistant",
                content: delta,
                timestamp: Date.now(),
              }
              return {
                ...c,
                messages: [...c.messages, newMessage],
                updatedAt: Date.now(),
              }
            }
          })
        )
      }

      try {
        // 继续对话，让 AI 处理工具结果
        await sendMessageWithTools(
          historyMessages,
          handleDelta,
          (toolCalls) => handleToolCallsReceived(toolCalls, conversationId, newAssistantMessageId),
          selectedModel || undefined,
          permissionMode
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t("chatError")
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c
            const existingMsg = c.messages.find((m) => m.id === newAssistantMessageId)
            if (existingMsg) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === newAssistantMessageId
                    ? { ...m, content: `❌ ${errorMessage}` }
                    : m
                ),
              }
            } else {
              return {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: newAssistantMessageId,
                    role: "assistant" as const,
                    content: `❌ ${errorMessage}`,
                    timestamp: Date.now(),
                  },
                ],
              }
            }
          })
        )
      } finally {
        setStreamingMessageId(null)
      }
    },
    [executeToolCallInternal, sendMessageWithTools, handleToolCallsReceived, selectedModel, permissionMode, t]
  )

  // 发送消息
  const handleSendMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmedInput = inputMessage.trim()
      if (!trimmedInput || isLoading || isPreparingAttachments) return
      if (currentConversation && countUnresolvedToolCalls(currentConversation.messages) > 0) return

      // 清除之前的错误
      clearError()

      let userMessageForModel = trimmedInput
      const controlContextBlocks = [permissionContextForModel]
      if (serverReferenceContextForModel) {
        controlContextBlocks.push(serverReferenceContextForModel)
      }
      if (controlContextBlocks.length > 0) {
        userMessageForModel = `${userMessageForModel}\n\n${controlContextBlocks.join("\n\n")}`
      }
      if (attachedFiles.length > 0) {
        setIsPreparingAttachments(true)
        try {
          const attachmentContext = await buildAttachmentContext(attachedFiles)
          if (attachmentContext) {
            userMessageForModel = `${userMessageForModel}\n\n${attachmentContext}`
          }
        } finally {
          setIsPreparingAttachments(false)
        }
      }

      const userMessage: Message = {
        id: createLocalId("user"),
        role: "user",
        content: trimmedInput,
        modelContent:
          userMessageForModel === trimmedInput
            ? undefined
            : userMessageForModel,
        timestamp: Date.now(),
      }

      // 预生成 AI 消息 ID（用于后续流式更新）
      const assistantMessageId = createLocalId("assistant")
      let targetConversationId = currentConversationId

      // 如果是新聊天模式，创建新会话（只包含用户消息）
      if (isNewChat || !currentConversation) {
        const newConv: ConversationData = {
          id: createLocalId("conv"),
          title: trimmedInput.slice(0, 30) + (trimmedInput.length > 30 ? "..." : ""),
          messages: [userMessage],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        setConversations((prev) => [newConv, ...prev])
        setCurrentConversationId(newConv.id)
        setIsNewChat(false)
        targetConversationId = newConv.id
      } else {
        // 添加用户消息到现有会话（不添加 AI 占位符）
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, userMessage],
                  title:
                    conv.messages.length === 0
                      ? trimmedInput.slice(0, 30) + (trimmedInput.length > 30 ? "..." : "")
                      : conv.title,
                  updatedAt: Date.now(),
                }
              : conv
          )
        )
      }

      setInputMessage("")
      if (attachedFiles.length > 0) {
        attachedFiles.forEach((file) => {
          clearUploadInterval(file.id)
        })
        setAttachedFiles([])
      }
      setStreamingMessageId(assistantMessageId)

      // 构建历史消息
      const historyMessages: ChatMessage[] = currentConversation
        ? buildHistoryMessages(currentConversation.messages)
        : []

      // 添加当前用户消息
      historyMessages.push({
        role: "user",
        content: userMessageForModel,
      })

      // 处理流式内容更新
      const handleDelta = (delta: string) => {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id !== targetConversationId) return conv

            // 查找是否已存在 AI 消息
            const existingAssistantMsg = conv.messages.find(
              (msg) => msg.id === assistantMessageId
            )

            if (existingAssistantMsg) {
              // 已存在，追加内容
              return {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + delta }
                    : msg
                ),
                updatedAt: Date.now(),
              }
            } else {
              // 不存在，创建新的 AI 消息
              const newAssistantMessage: Message = {
                id: assistantMessageId,
                role: "assistant",
                content: delta,
                timestamp: Date.now(),
              }
              return {
                ...conv,
                messages: [...conv.messages, newAssistantMessage],
                updatedAt: Date.now(),
              }
            }
          })
        )
      }

      try {
        // 使用带工具的流式 API（默认开启）
        await sendMessageWithTools(
          historyMessages,
          handleDelta,
          (toolCalls) => handleToolCallsReceived(toolCalls, targetConversationId, assistantMessageId),
          selectedModel || undefined,
          permissionMode
        )
      } catch (error) {
        // 如果发生错误，创建或更新消息显示错误
        const errorMessage = error instanceof Error ? error.message : t("chatError")
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id !== targetConversationId) return conv

            const existingAssistantMsg = conv.messages.find(
              (msg) => msg.id === assistantMessageId
            )

            if (existingAssistantMsg) {
              // 已有消息，更新为错误
              return {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: `❌ ${errorMessage}` }
                    : msg
                ),
              }
            } else {
              // 没有消息，创建错误消息
              return {
                ...conv,
                messages: [
                  ...conv.messages,
                  {
                    id: assistantMessageId,
                    role: "assistant" as const,
                    content: `❌ ${errorMessage}`,
                    timestamp: Date.now(),
                  },
                ],
              }
            }
          })
        )
      } finally {
        setStreamingMessageId(null)
      }
    },
    [
      inputMessage,
      currentConversation,
      currentConversationId,
      isLoading,
      isPreparingAttachments,
      isNewChat,
      attachedFiles,
      clearUploadInterval,
      sendMessageWithTools,
      handleToolCallsReceived,
      clearError,
      t,
      selectedModel,
      permissionMode,
      permissionContextForModel,
      serverReferenceContextForModel,
    ]
  )

  // 新建对话
  const handleNewConversation = useCallback(() => {
    // 开发环境：直接创建会话（用于测试）
    if (process.env.NODE_ENV === "development") {
      const newConv: ConversationData = {
        id: createLocalId("conv"),
        title: t("newConversation"),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setConversations((prev) => [newConv, ...prev])
      setCurrentConversationId(newConv.id)
      setIsNewChat(false)
    } else {
      // 生产环境：进入新聊天模式，发送首条消息时才创建会话
      setCurrentConversationId("")
      setIsNewChat(true)
    }
  }, [t])

  // 删除对话
  const handleDeleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id)
        if (currentConversationId === id) {
          if (filtered.length > 0) {
            setCurrentConversationId(filtered[0].id)
            setIsNewChat(false)
          } else {
            setCurrentConversationId("")
            setIsNewChat(true)
          }
        }
        return filtered
      })
    },
    [currentConversationId]
  )

  // 开始重命名
  const handleStartRename = useCallback((conv: ConversationData) => {
    setRenamingId(conv.id)
    setRenameValue(conv.title)
  }, [])

  // 确认重命名
  const handleConfirmRename = useCallback(() => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null)
      setRenameValue("")
      return
    }
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === renamingId
          ? { ...conv, title: renameValue.trim(), updatedAt: Date.now() }
          : conv
      )
    )
    setRenamingId(null)
    setRenameValue("")
  }, [renamingId, renameValue])

  // 取消重命名
  const handleCancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameValue("")
  }, [])

  // 文件上传处理
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // 模拟文件上传进度
  const simulateUpload = useCallback((fileId: string) => {
    clearUploadInterval(fileId)

    const interval = setInterval(() => {
      setAttachedFiles((prev) => {
        const fileIndex = prev.findIndex((item) => item.id === fileId)
        if (fileIndex === -1) {
          clearUploadInterval(fileId)
          return prev
        }

        const target = prev[fileIndex]
        if (!target.uploading) {
          clearUploadInterval(fileId)
          return prev
        }

        const increment = Math.random() * 20 + 10
        const nextProgress = Math.min(100, target.progress + increment)
        const uploadFinished = nextProgress >= 100

        const nextFiles = [...prev]
        nextFiles[fileIndex] = {
          ...target,
          progress: nextProgress,
          uploading: !uploadFinished,
        }

        if (uploadFinished) {
          clearUploadInterval(fileId)
        }

        return nextFiles
      })
    }, 200)

    uploadIntervalsRef.current.set(fileId, interval)
  }, [clearUploadInterval])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const availableSlots = Math.max(0, ATTACHMENT_MAX_FILES - attachedFiles.length)
      if (availableSlots === 0) {
        e.target.value = ""
        return
      }

      const selectedFiles = Array.from(files).slice(0, availableSlots)
      const newFileEntries = selectedFiles.map(file => ({
        id: createLocalId("file"),
        file,
        progress: 0,
        uploading: true
      }))
      setAttachedFiles(prev => [...prev, ...newFileEntries])

      // 为每个新文件启动模拟上传
      newFileEntries.forEach((entry) => {
        simulateUpload(entry.id)
      })
    }
    // 重置 input 以便可以再次选择相同文件
    e.target.value = ""
  }, [attachedFiles.length, simulateUpload])

  const handleRemoveFile = useCallback((fileId: string) => {
    clearUploadInterval(fileId)
    setAttachedFiles(prev => prev.filter((file) => file.id !== fileId))
  }, [clearUploadInterval])

  // 使用模板
  const handleUseTemplate = useCallback((prompt: string) => {
    setInputMessage(prompt)
    inputRef.current?.focus()
  }, [])

  // 复制消息
  const handleCopyMessage = useCallback((content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // 编辑消息 - 删除该消息之后的所有消息，更新当前消息内容，重新发送
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!currentConversation || isLoading) return
    if (countUnresolvedToolCalls(currentConversation.messages) > 0) return

    // 找到被编辑消息的索引
    const messageIndex = currentConversation.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // 清除之前的错误
    clearError()

    // 保留该消息之前的所有消息（不包括被编辑的消息）
    const messagesBeforeEdit = currentConversation.messages.slice(0, messageIndex)

    // 创建更新后的用户消息
    const updatedUserMessage: Message = {
      id: messageId,
      role: "user",
      content: newContent,
      timestamp: Date.now(),
    }

    // 预生成 AI 消息 ID
    const assistantMessageId = createLocalId("assistant")

    // 更新对话：保留编辑前的消息 + 更新后的用户消息
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...messagesBeforeEdit, updatedUserMessage],
              updatedAt: Date.now(),
            }
          : conv
      )
    )

    setStreamingMessageId(assistantMessageId)

    // 构建历史消息（编辑前的消息 + 更新后的用户消息）
    const historyMessages: ChatMessage[] = [
      ...buildHistoryMessages(messagesBeforeEdit),
      {
        role: "user" as const,
        content: newContent,
      },
    ]

    try {
      const onDelta = (delta: string) => {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id !== currentConversationId) return conv

            const existingAssistantMsg = conv.messages.find(
              (msg) => msg.id === assistantMessageId
            )

            if (existingAssistantMsg) {
              return {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + delta }
                    : msg
                ),
                updatedAt: Date.now(),
              }
            } else {
              const newAssistantMessage: Message = {
                id: assistantMessageId,
                role: "assistant",
                content: delta,
                timestamp: Date.now(),
              }
              return {
                ...conv,
                messages: [...conv.messages, newAssistantMessage],
                updatedAt: Date.now(),
              }
            }
          })
        )
      }

      await sendMessageWithTools(
        historyMessages,
        onDelta,
        (toolCalls) => handleToolCallsReceived(toolCalls, currentConversationId, assistantMessageId),
        selectedModel || undefined,
        permissionMode
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("chatError")
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== currentConversationId) return conv

          const existingAssistantMsg = conv.messages.find(
            (msg) => msg.id === assistantMessageId
          )

          if (existingAssistantMsg) {
            return {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: `❌ ${errorMessage}` }
                  : msg
              ),
            }
          } else {
            return {
              ...conv,
              messages: [
                ...conv.messages,
                {
                  id: assistantMessageId,
                  role: "assistant" as const,
                  content: `❌ ${errorMessage}`,
                  timestamp: Date.now(),
                },
              ],
            }
          }
        })
      )
    } finally {
      setStreamingMessageId(null)
    }
  }, [currentConversation, currentConversationId, isLoading, clearError, sendMessageWithTools, handleToolCallsReceived, t, selectedModel, permissionMode])

  // 导出对话
  const handleExportConversation = useCallback(() => {
    if (!currentConversation) return
    const content = currentConversation.messages
      .map(
        (msg) =>
          `${msg.role === "user" ? t("exportRoleUser") : t("exportRoleAssistant")} (${new Date(msg.timestamp).toLocaleString()}):\n${msg.content}\n`
      )
      .join("\n---\n\n")

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `conversation-${currentConversation.title}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [currentConversation, t])

  // 停止生成
  const handleStopGenerating = useCallback(() => {
    stopGenerating()
  }, [stopGenerating])

  // 重新生成
  const handleRegenerate = useCallback(async () => {
    if (!currentConversation || currentConversation.messages.length < 2 || isLoading) return
    if (countUnresolvedToolCalls(currentConversation.messages) > 0) return

    const lastMessage = currentConversation.messages[currentConversation.messages.length - 1]
    if (!lastMessage || lastMessage.role !== "assistant") return

    // 清除之前的错误
    clearError()

    // 移除最后一条AI消息
    const messagesWithoutLastAI = currentConversation.messages.slice(0, -1)

    const hasUserMessage = messagesWithoutLastAI.some((m) => m.role === "user")
    if (!hasUserMessage) return

    // 预生成新的 AI 消息 ID
    const assistantMessageId = createLocalId("assistant")

    // 更新对话：移除旧的 AI 消息（不添加占位符）
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: messagesWithoutLastAI,
              updatedAt: Date.now(),
            }
          : conv
      )
    )

    setStreamingMessageId(assistantMessageId)

    // 构建历史消息（不包含最后一条 AI 消息）
    const historyMessages: ChatMessage[] = buildHistoryMessages(messagesWithoutLastAI)

    try {
      const onDelta = (delta: string) => {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id !== currentConversationId) return conv

            // 查找是否已存在 AI 消息
            const existingAssistantMsg = conv.messages.find(
              (msg) => msg.id === assistantMessageId
            )

            if (existingAssistantMsg) {
              // 已存在，追加内容
              return {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + delta }
                    : msg
                ),
                updatedAt: Date.now(),
              }
            } else {
              // 不存在，创建新的 AI 消息
              const newAssistantMessage: Message = {
                id: assistantMessageId,
                role: "assistant",
                content: delta,
                timestamp: Date.now(),
              }
              return {
                ...conv,
                messages: [...conv.messages, newAssistantMessage],
                updatedAt: Date.now(),
              }
            }
          })
        )
      }

      await sendMessageWithTools(
        historyMessages,
        onDelta,
        (toolCalls) => handleToolCallsReceived(toolCalls, currentConversationId, assistantMessageId),
        selectedModel || undefined,
        permissionMode
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("chatError")
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== currentConversationId) return conv

          const existingAssistantMsg = conv.messages.find(
            (msg) => msg.id === assistantMessageId
          )

          if (existingAssistantMsg) {
            return {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: `❌ ${errorMessage}` }
                  : msg
              ),
            }
          } else {
            return {
              ...conv,
              messages: [
                ...conv.messages,
                {
                  id: assistantMessageId,
                  role: "assistant" as const,
                  content: `❌ ${errorMessage}`,
                  timestamp: Date.now(),
                },
              ],
            }
          }
        })
      )
    } finally {
      setStreamingMessageId(null)
    }
  }, [currentConversation, currentConversationId, isLoading, clearError, sendMessageWithTools, handleToolCallsReceived, t, selectedModel, permissionMode])

  // 加载状态
  if (!mounted || !ready) {
    return null
  }

  // 新聊天模式下没有消息，或者当前会话没有消息
  const hasMessages = !isNewChat && currentConversation && currentConversation.messages.length > 0

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        titleDropdown={() => (
          <div className="flex items-center gap-1">
            <DropdownMenu onOpenChange={(open) => !open && setSearchQuery("")}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-foreground font-normal hover:text-foreground/80 transition-colors">
                  {t("pageTitle")}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" alignOffset={-100} sideOffset={8} className="w-72 p-0">
                {/* 搜索框和新建按钮 */}
                <div className="p-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="h-8 w-8 shrink-0"
                    onClick={handleNewConversation}
                    title={t("newConversation")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {/* 对话列表 */}
                <div className="max-h-[400px] overflow-y-auto scrollbar-custom [scrollbar-gutter:stable] px-1 pb-1">
                  {filteredConversations.length > 0 ? (
                    filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "group flex items-center justify-between gap-2 cursor-pointer py-2 px-2 rounded-md hover:bg-accent",
                          conv.id === currentConversationId && !isNewChat && "bg-accent"
                        )}
                        onClick={() => {
                          if (renamingId !== conv.id) {
                            setCurrentConversationId(conv.id)
                            setIsNewChat(false)
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          {renamingId === conv.id ? (
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  handleConfirmRename()
                                } else if (e.key === "Escape") {
                                  handleCancelRename()
                                }
                              }}
                              onBlur={handleCancelRename}
                              onClick={(e) => e.stopPropagation()}
                              className="h-5 text-sm font-medium px-1 py-0"
                              autoFocus
                            />
                          ) : (
                            <div className="font-medium text-sm truncate">{conv.title}</div>
                          )}
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{t("sidebarMessageCount", { count: conv.messages.length })}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(conv.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {renamingId !== conv.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={4}>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartRename(conv)
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                {t("rename")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteConversation(conv.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      {t("noConversationsFound")}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportConversation}
            disabled={!hasMessages}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("exportConversation")}
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* 主内容区 */}
        <div className="relative flex-1 flex flex-col min-w-0 bg-background">
          {!hasMessages ? (
            <WelcomePanel onUseTemplate={handleUseTemplate} t={t} />
          ) : (
            <Conversation className="flex-1">
              <ConversationContent className="space-y-6 pb-56 max-w-4xl mx-auto px-4">
                {(() => {
                  const messages = currentConversation?.messages || []
                  const elements: React.ReactNode[] = []
                  const hasStreamingAssistantMessage = Boolean(
                    streamingMessageId && messages.some((msg) => msg.id === streamingMessageId)
                  )

                  for (let i = 0; i < messages.length; i++) {
                    const message = messages[i]

                    if (message.role === "user") {
                      // 渲染用户消息
                      elements.push(
                        <MessageBubble
                          key={message.id}
                          message={message}
                          onCopy={handleCopyMessage}
                          onRegenerate={handleRegenerate}
                          onEdit={handleEditMessage}
                          copiedId={copiedId}
                          isLast={false}
                          isLoading={isLoading}
                          isStreaming={false}
                          t={t}
                        />
                      )

                      // 聚合同一轮中的连续 assistant 消息，避免重复头像
                      let groupEnd = i + 1
                      while (groupEnd < messages.length && messages[groupEnd].role === "assistant") {
                        groupEnd++
                      }

                      const assistantGroup = messages.slice(i + 1, groupEnd)
                      const isLastUserMessage = groupEnd >= messages.length

                      if (assistantGroup.length === 0) {
                        // 还在等待首条 assistant 消息
                        if (isLastUserMessage && isLoading) {
                          elements.push(
                            <AIResponseBlock
                              key={`ai-response-after-${message.id}`}
                              isWaitingForResponse={true}
                              onCopy={handleCopyMessage}
                              onRegenerate={handleRegenerate}
                              copiedId={copiedId}
                              isLast={true}
                              isLoading={isLoading}
                              t={t}
                            />
                          )
                        }
                        continue
                      }

                      const lastAssistantMessage = assistantGroup[assistantGroup.length - 1]
                      const groupedToolCalls = collectGroupedToolCalls(assistantGroup)
                      const isGroupStreamingById = assistantGroup.some(
                        (assistantMsg) => assistantMsg.id === streamingMessageId
                      )
                      const isGroupStreamingByGap =
                        Boolean(isLoading && streamingMessageId) &&
                        !hasStreamingAssistantMessage &&
                        groupEnd === messages.length
                      const isGroupStreaming = isGroupStreamingById || isGroupStreamingByGap

                      elements.push(
                        <AIResponseBlock
                          key={`ai-response-after-${message.id}`}
                          message={lastAssistantMessage}
                          groupedToolCalls={groupedToolCalls}
                          isWaitingForResponse={false}
                          isStreaming={isGroupStreaming}
                          isStreamingByGap={isGroupStreamingByGap}
                          onCopy={handleCopyMessage}
                          onRegenerate={handleRegenerate}
                          copiedId={copiedId}
                          isLast={groupEnd === messages.length}
                          isLoading={isLoading}
                          t={t}
                          conversationId={currentConversationId}
                          onExecuteToolCall={handleExecuteToolCall}
                          onCancelToolCall={handleCancelToolCall}
                          onExecuteAllToolCalls={handleExecuteAllToolCalls}
                        />
                      )

                      // 跳过已被合并渲染的 assistant 消息
                      i = groupEnd - 1
                    } else if (i === 0) {
                      // 兼容历史数据：会话第一条就是 assistant 时也进行分组渲染
                      let groupEnd = i
                      while (groupEnd < messages.length && messages[groupEnd].role === "assistant") {
                        groupEnd++
                      }

                      const assistantGroup = messages.slice(i, groupEnd)
                      const lastAssistantMessage = assistantGroup[assistantGroup.length - 1]
                      const groupedToolCalls = collectGroupedToolCalls(assistantGroup)
                      const isGroupStreamingById = assistantGroup.some(
                        (assistantMsg) => assistantMsg.id === streamingMessageId
                      )
                      const isGroupStreamingByGap =
                        Boolean(isLoading && streamingMessageId) &&
                        !hasStreamingAssistantMessage &&
                        groupEnd === messages.length
                      const isGroupStreaming = isGroupStreamingById || isGroupStreamingByGap

                      if (lastAssistantMessage) {
                        elements.push(
                          <AIResponseBlock
                            key={`ai-response-leading-${lastAssistantMessage.id}`}
                            message={lastAssistantMessage}
                            groupedToolCalls={groupedToolCalls}
                            isWaitingForResponse={false}
                            isStreaming={isGroupStreaming}
                            isStreamingByGap={isGroupStreamingByGap}
                            onCopy={handleCopyMessage}
                            onRegenerate={handleRegenerate}
                            copiedId={copiedId}
                            isLast={groupEnd === messages.length}
                            isLoading={isLoading}
                            t={t}
                            conversationId={currentConversationId}
                            onExecuteToolCall={handleExecuteToolCall}
                            onCancelToolCall={handleCancelToolCall}
                            onExecuteAllToolCalls={handleExecuteAllToolCalls}
                          />
                        )
                      }
                      i = groupEnd - 1
                    }
                  }

                  return elements
                })()}
              </ConversationContent>
              <ConversationScrollButton className="bottom-52" />
            </Conversation>
          )}

          {/* 输入区域 - 悬浮在底部，与内容区域同宽，不遮挡滚动条 */}
          <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
            <div className="w-full max-w-4xl mx-auto px-4 pb-4 pointer-events-auto bg-gradient-to-t from-background via-background to-transparent">
              {/* 快捷建议（对话进行中显示） */}
              {hasMessages && !isLoading && !hasUnresolvedToolCalls && (
                <Suggestions className="mb-3">
                  <Suggestion
                    suggestion={t("templateRunCommandPrompt")}
                    onClick={handleUseTemplate}
                  >
                    <Terminal className="h-3 w-3 mr-1" />
                    {t("templateRunCommandTitle")}
                  </Suggestion>
                  <Suggestion
                    suggestion={t("templateScriptPrompt")}
                    onClick={handleUseTemplate}
                  >
                    <Code className="h-3 w-3 mr-1" />
                    {t("templateScriptTitle")}
                  </Suggestion>
                  <Suggestion
                    suggestion={t("templateLogsPrompt")}
                    onClick={handleUseTemplate}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {t("templateLogsTitle")}
                  </Suggestion>
                </Suggestions>
              )}

              {hasUnresolvedToolCalls && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t("pendingToolsHint", { count: unresolvedToolCallCount })}</span>
                </div>
              )}

              {/* 输入框容器 - 带背景光晕 */}
              <div className="relative">
                {/* 背景光晕效果 */}
                <div className="absolute -inset-4 bg-gradient-to-t from-primary/20 via-primary/10 to-transparent blur-xl rounded-3xl opacity-100 animate-pulse" />

                {/* 输入框主体 */}
                <div className="relative">
                  <PromptInput
                    onSubmit={handleSendMessage}
                    className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-xl ring-1 ring-primary/10"
                  >
                    {/* 文件预览和输入框包装在一起，避免 divide-y 产生分隔线 */}
                    <div>
                      {/* 已选文件预览 - 带过渡动画 */}
                      {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-3 px-3 pt-3 pb-1 animate-in fade-in slide-in-from-top-2 duration-300">
                          {attachedFiles.map((fileEntry) => (
                            <div
                              key={fileEntry.id}
                              className="relative flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm animate-in fade-in zoom-in-95 duration-200"
                            >
                              {/* 文件图标 + 进度环覆盖 */}
                              <div className="relative flex-shrink-0 h-7 w-7">
                                {/* 底层图标 */}
                                <div className={cn(
                                  "absolute inset-0 rounded-full bg-primary/10 flex items-center justify-center transition-opacity duration-300",
                                  fileEntry.uploading ? "opacity-40" : "opacity-100"
                                )}>
                                  <FileText className="h-4 w-4 text-primary" />
                                </div>
                                {/* 进度环覆盖在图标上 */}
                                {fileEntry.uploading && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <CircularProgress progress={fileEntry.progress} size={28} />
                                  </div>
                                )}
                              </div>
                              {/* 文件名 */}
                              <span className="max-w-[150px] truncate font-medium">{fileEntry.file.name}</span>
                              {/* 删除按钮 */}
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(fileEntry.id)}
                                className="ml-1 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedReferencedServers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-1 animate-in fade-in duration-200">
                          <span className="text-[11px] text-muted-foreground">
                            {t("referencedServersLabel")}
                          </span>
                          {selectedReferencedServers.map((server) => {
                            const displayName = server.name?.trim() || server.host
                            return (
                              <button
                                key={server.id}
                                type="button"
                                onClick={() => toggleReferencedServer(server.id)}
                                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary hover:bg-primary/10 transition-colors"
                              >
                                <ServerIcon className="h-3 w-3" />
                                <span className="max-w-[140px] truncate">{displayName}</span>
                                <X className="h-3 w-3" />
                              </button>
                            )
                          })}
                        </div>
                      )}
                      <PromptInputTextarea
                        ref={inputRef}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder={
                          !isConfigured
                            ? t("aiNotConfiguredPlaceholder")
                            : hasUnresolvedToolCalls
                              ? t("pendingToolsPlaceholder")
                              : t("inputPlaceholder")
                        }
                        className="min-h-[52px] text-base"
                        disabled={!isConfigured || hasUnresolvedToolCalls || isPreparingAttachments}
                      />
                    </div>
                    <PromptInputToolbar>
                      <PromptInputTools>
                        {/* 模型选择器 */}
                        {isConfigured && models.length > 0 ? (
                          models.length === 1 ? (
                            // 单个模型：只显示模型名称，不需要下拉
                            <div className="flex items-center gap-1.5 px-2.5 h-8 text-xs text-muted-foreground">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>{models[0]}</span>
                            </div>
                          ) : (
                            // 多个模型：显示下拉选择器
                            <PromptInputModelSelect value={selectedModel} onValueChange={setSelectedModel}>
                              <PromptInputModelSelectTrigger className="gap-1.5 pl-2.5 pr-3 h-8 text-xs">
                                <Sparkles className="h-3.5 w-3.5" />
                                <PromptInputModelSelectValue />
                              </PromptInputModelSelectTrigger>
                              <PromptInputModelSelectContent>
                                {models.map((model) => (
                                  <PromptInputModelSelectItem key={model} value={model}>
                                    {model}
                                  </PromptInputModelSelectItem>
                                ))}
                              </PromptInputModelSelectContent>
                            </PromptInputModelSelect>
                          )
                        ) : !isConfigLoading ? (
                          // 未配置时显示"未配置"
                          <Link href="/dashboard/settings?tab=ai">
                            <div className="flex items-center gap-1.5 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>{t("notConfigured")}</span>
                            </div>
                          </Link>
                        ) : null}

                        {/* 权限控制 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                              disabled={!isConfigured || hasUnresolvedToolCalls || isPreparingAttachments}
                            >
                              <Shield className="h-3.5 w-3.5" />
                              <span className="max-w-[84px] truncate">{selectedPermissionOption.label}</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" side="top" className="w-72">
                            <DropdownMenuLabel>{t("permissionControl")}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup
                              value={permissionMode}
                              onValueChange={(value) => setPermissionMode(value as PermissionMode)}
                            >
                              {permissionModeOptions.map((option) => (
                                <DropdownMenuRadioItem key={option.value} value={option.value}>
                                  <div className="flex min-w-0 flex-col">
                                    <span className="font-medium">{option.label}</span>
                                    <span className="text-xs text-muted-foreground">{option.description}</span>
                                  </div>
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* 选择服务器 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                              disabled={!isConfigured || hasUnresolvedToolCalls || isPreparingAttachments}
                            >
                              <ServerIcon className="h-3.5 w-3.5" />
                              <span className="max-w-[88px] truncate">
                                {selectedReferencedServers.length > 0
                                  ? t("referenceServerSelected", { count: selectedReferencedServers.length })
                                  : t("referenceServer")}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" side="top" className="w-80">
                            <DropdownMenuLabel>{t("referenceServer")}</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => void loadServersForReference()}
                              disabled={isLoadingServers}
                            >
                              <ServerIcon className="h-4 w-4" />
                              {isLoadingServers ? t("referenceServerLoading") : t("referenceServerRefresh")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setSelectedServerIds([])}
                              disabled={selectedServerIds.length === 0}
                            >
                              <X className="h-4 w-4" />
                              {t("referenceServerClear")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <div className="px-2 pb-1 text-xs text-muted-foreground">
                              {t("referenceServerHint")}
                            </div>
                            <div className="max-h-56 overflow-y-auto">
                              {isLoadingServers ? (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  {t("referenceServerLoading")}
                                </div>
                              ) : availableServers.length === 0 ? (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  {t("referenceServerEmpty")}
                                </div>
                              ) : (
                                availableServers.map((server) => {
                                  const displayName = server.name?.trim() || server.host
                                  const checked = selectedServerIds.includes(server.id)
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={server.id}
                                      checked={checked}
                                      onCheckedChange={() => toggleReferencedServer(server.id)}
                                    >
                                      <div className="flex min-w-0 flex-col">
                                        <span className="truncate font-medium">{displayName}</span>
                                        <span className="truncate text-xs text-muted-foreground">
                                          {server.username}@{server.host}:{server.port}
                                        </span>
                                      </div>
                                    </DropdownMenuCheckboxItem>
                                  )
                                })
                              )}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* 文件上传按钮 */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileChange}
                          accept="image/*,.pdf,.txt,.md,.json,.csv,.xml,.yaml,.yml,.log"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleFileSelect}
                          disabled={!isConfigured || hasUnresolvedToolCalls || isPreparingAttachments}
                          title={`${t("attachFile")} · ${t("attachmentLimitHint", { count: ATTACHMENT_MAX_FILES })}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>

                      </PromptInputTools>

                      <div className="flex items-center gap-2">
                        {/* 停止生成按钮 或 提交按钮 */}
                        {isLoading ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleStopGenerating}
                            className="gap-1.5"
                          >
                            <Square className="h-3 w-3" />
                            {t("stopGenerating")}
                          </Button>
                        ) : (
                          <PromptInputSubmit
                            disabled={!inputMessage.trim() || !isConfigured || hasUnresolvedToolCalls || isPreparingAttachments}
                            status={isPreparingAttachments ? "submitted" : undefined}
                            className="h-8 w-8"
                          />
                        )}
                      </div>
                    </PromptInputToolbar>
                  </PromptInput>
                </div>
              </div>

              {/* 安全提示 */}
              <p className="text-[11px] text-muted-foreground/70 text-center mt-1">
                {t("safetyNotice")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
