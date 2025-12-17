"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  User,
  MessageSquare,
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
} from "lucide-react"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useAIChat } from "@/hooks/use-ai-chat"
import { useAIConfig } from "@/hooks/use-ai-config"
import { ChatMessage } from "@/lib/api/ai"
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
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ========== 类型定义 ==========
interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

interface ConversationData {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

// 快捷模板图标映射
const quickTemplateIcons = [Terminal, Code, FileText, Zap] as const

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
  isWaitingForResponse,
  isStreaming,
  onCopy,
  onRegenerate,
  copiedId,
  isLast,
  isLoading,
  t,
}: {
  message?: Message
  isWaitingForResponse: boolean
  isStreaming?: boolean
  onCopy: (content: string, id: string) => void
  onRegenerate?: () => void
  copiedId: string | null
  isLast: boolean
  isLoading: boolean
  t: ReturnType<typeof useTranslations<"aiAssistant">>
}) {
  // 解析 AI 消息中的思考内容
  const parsedContent = useMemo(() => {
    if (!message) return { thinking: null, content: "" }
    return parseThinkingContent(message.content)
  }, [message?.content])

  // 判断是否正在流式输出思考内容
  const isThinkingStreaming = Boolean(isStreaming && parsedContent.thinking && !parsedContent.content)

  // 判断当前显示状态
  const showLoadingIndicator = isWaitingForResponse && !message?.content
  const showThinkingBlock = parsedContent.thinking
  const showContent = parsedContent.content

  // 是否有实际内容（思考或正文）
  const hasContent = showThinkingBlock || showContent

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
  const { ready } = useAuthReady()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 文件附件状态，包含上传进度
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    file: File
    progress: number // 0-100
    uploading: boolean
  }>>([])

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
    sendMessage: sendAIMessage,
    isLoading,
    stop: stopGenerating,
    error: aiError,
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

  // 发送消息
  const handleSendMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!inputMessage.trim() || isLoading) return

      // 清除之前的错误
      clearError()

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: inputMessage.trim(),
        timestamp: Date.now(),
      }

      // 预生成 AI 消息 ID（用于后续流式更新）
      const assistantMessageId = (Date.now() + 1).toString()
      let targetConversationId = currentConversationId
      let assistantMessageCreated = false

      // 如果是新聊天模式，创建新会话（只包含用户消息）
      if (isNewChat || !currentConversation) {
        const newConv: ConversationData = {
          id: Date.now().toString(),
          title: inputMessage.slice(0, 30) + (inputMessage.length > 30 ? "..." : ""),
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
                      ? inputMessage.slice(0, 30) + (inputMessage.length > 30 ? "..." : "")
                      : conv.title,
                  updatedAt: Date.now(),
                }
              : conv
          )
        )
      }

      setInputMessage("")
      setStreamingMessageId(assistantMessageId)

      // 构建历史消息
      const historyMessages: ChatMessage[] = currentConversation
        ? currentConversation.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))
        : []

      // 添加当前用户消息
      historyMessages.push({
        role: "user",
        content: inputMessage.trim(),
      })

      try {
        // 使用流式 API，传入选中的模型
        await sendAIMessage(historyMessages, (delta) => {
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
        }, selectedModel || undefined)
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
    [inputMessage, currentConversation, currentConversationId, isLoading, isNewChat, sendAIMessage, clearError, t, selectedModel]
  )

  // 新建对话
  const handleNewConversation = useCallback(() => {
    // 开发环境：直接创建会话（用于测试）
    if (process.env.NODE_ENV === "development") {
      const newConv: ConversationData = {
        id: Date.now().toString(),
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
        if (currentConversationId === id && filtered.length > 0) {
          setCurrentConversationId(filtered[0].id)
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
  const simulateUpload = useCallback((fileIndex: number) => {
    const interval = setInterval(() => {
      setAttachedFiles(prev => {
        const newFiles = [...prev]
        if (newFiles[fileIndex]) {
          const currentProgress = newFiles[fileIndex].progress
          if (currentProgress >= 100) {
            clearInterval(interval)
            newFiles[fileIndex] = { ...newFiles[fileIndex], progress: 100, uploading: false }
          } else {
            // 模拟上传进度，每次增加 10-30%
            const increment = Math.random() * 20 + 10
            newFiles[fileIndex] = {
              ...newFiles[fileIndex],
              progress: Math.min(100, currentProgress + increment)
            }
          }
        }
        return newFiles
      })
    }, 200)
    return interval
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const startIndex = attachedFiles.length
      const newFileEntries = Array.from(files).map(file => ({
        file,
        progress: 0,
        uploading: true
      }))
      setAttachedFiles(prev => [...prev, ...newFileEntries])

      // 为每个新文件启动模拟上传
      newFileEntries.forEach((_, idx) => {
        simulateUpload(startIndex + idx)
      })
    }
    // 重置 input 以便可以再次选择相同文件
    e.target.value = ""
  }, [attachedFiles.length, simulateUpload])

  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

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
    const assistantMessageId = Date.now().toString()

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
      ...messagesBeforeEdit.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: newContent,
      },
    ]

    try {
      await sendAIMessage(historyMessages, (delta) => {
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
      }, selectedModel || undefined)
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
  }, [currentConversation, currentConversationId, isLoading, sendAIMessage, clearError, t, selectedModel])

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

    // 获取最后一条用户消息
    const lastUserMessage = currentConversation.messages
      .filter((m) => m.role === "user")
      .pop()

    if (!lastUserMessage) return

    // 移除最后一条AI消息
    const messagesWithoutLastAI = currentConversation.messages.slice(0, -1)

    // 预生成新的 AI 消息 ID
    const assistantMessageId = Date.now().toString()

    // 更新对话：移除旧的 AI 消息（不添加占位符）
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: messagesWithoutLastAI,
            }
          : conv
      )
    )

    setStreamingMessageId(assistantMessageId)

    // 构建历史消息（不包含最后一条 AI 消息）
    const historyMessages: ChatMessage[] = messagesWithoutLastAI.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    try {
      await sendAIMessage(historyMessages, (delta) => {
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
      }, selectedModel || undefined)
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
  }, [currentConversation, currentConversationId, isLoading, sendAIMessage, t, selectedModel])

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
        titleDropdown={(trigger) => (
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

                  // 查找当前正在流式输出的 AI 消息
                  const streamingAssistantMessage = streamingMessageId
                    ? messages.find(m => m.id === streamingMessageId)
                    : null

                  for (let i = 0; i < messages.length; i++) {
                    const message = messages[i]
                    const nextMessage = messages[i + 1]

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

                      // 检查是否需要显示 AI 响应区块
                      const isLastUserMessage = i === messages.length - 1
                      const hasNextAssistantMessage = nextMessage?.role === "assistant"

                      // 如果是最后一条用户消息且正在加载，或者下一条是正在流式输出的 AI 消息
                      // 使用固定的 key 来保持组件不被替换
                      if (isLastUserMessage && isLoading && !hasNextAssistantMessage) {
                        // 等待响应状态 - 使用固定 key
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
                    } else if (message.role === "assistant") {
                      // 渲染 AI 消息
                      const isLastMessage = i === messages.length - 1
                      const prevMessage = messages[i - 1]
                      // 使用与等待状态相同的 key 格式，确保组件复用
                      const blockKey = prevMessage?.role === "user"
                        ? `ai-response-after-${prevMessage.id}`
                        : message.id

                      elements.push(
                        <AIResponseBlock
                          key={blockKey}
                          message={message}
                          isWaitingForResponse={false}
                          isStreaming={streamingMessageId === message.id}
                          onCopy={handleCopyMessage}
                          onRegenerate={handleRegenerate}
                          copiedId={copiedId}
                          isLast={isLastMessage}
                          isLoading={isLoading}
                          t={t}
                        />
                      )
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
              {hasMessages && !isLoading && (
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
                          {attachedFiles.map((fileEntry, index) => (
                            <div
                              key={index}
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
                                onClick={() => handleRemoveFile(index)}
                                className="ml-1 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <PromptInputTextarea
                        ref={inputRef as any}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder={isConfigured ? t("inputPlaceholder") : t("aiNotConfiguredPlaceholder")}
                        className="min-h-[52px] text-base"
                        disabled={!isConfigured}
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
                          disabled={!isConfigured}
                          title={t("attachFile")}
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
                            disabled={!inputMessage.trim() || !isConfigured}
                            className="h-8 w-8"
                          />
                        )}
                      </div>
                    </PromptInputToolbar>
                  </PromptInput>
                </div>
              </div>

              {/* 快捷键提示 */}
              <div className="mt-2 text-center text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  Enter
                </kbd>{" "}
                {t("panelHintSend")} •{" "}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  Shift+Enter
                </kbd>{" "}
                {t("panelHintNewline")}
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
