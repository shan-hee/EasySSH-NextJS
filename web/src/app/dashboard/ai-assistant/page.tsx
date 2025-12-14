"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  PanelLeftClose,
  PanelLeft,
  RotateCcw,
  Square,
  ChevronRight,
  Settings,
  AlertCircle,
} from "lucide-react"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useAIChat } from "@/hooks/use-ai-chat"
import { useAIConfig } from "@/hooks/use-ai-config"
import { ChatMessage as APIChatMessage } from "@/lib/api/ai"
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
} from "@/components/ui/shadcn-io/ai/prompt-input"
import { Actions, Action } from "@/components/ui/shadcn-io/ai/actions"
import { SmartAvatar } from "@/components/ui/smart-avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

// ========== 消息气泡组件 ==========
function MessageBubble({
  message,
  onCopy,
  onRegenerate,
  copiedId,
  isLast,
  isLoading,
  t,
}: {
  message: Message
  onCopy: (content: string, id: string) => void
  onRegenerate?: () => void
  copiedId: string | null
  isLast: boolean
  isLoading: boolean
  t: ReturnType<typeof useTranslations<"aiAssistant">>
}) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "group flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* 头像 */}
      {isUser ? (
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      ) : (
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      {/* 消息内容 */}
      <div
        className={cn(
          "flex flex-col gap-1.5 max-w-[75%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted/80 text-foreground rounded-bl-md border border-border/50"
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : (
            <Response className="prose prose-sm dark:prose-invert max-w-none">
              {message.content}
            </Response>
          )}
        </div>

        {/* 消息元信息和操作 */}
        <div
          className={cn(
            "flex items-center gap-2 px-1",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span className="text-[11px] text-muted-foreground/70">
            {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          {/* 操作按钮 */}
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
            {!isUser && isLast && !isLoading && onRegenerate && (
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

// ========== 加载指示器 ==========
function LoadingIndicator({ t }: { t: ReturnType<typeof useTranslations<"aiAssistant">> }) {
  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-2 bg-muted/80 rounded-2xl rounded-bl-md px-4 py-3 border border-border/50">
        <Loader size={14} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t("thinkingLabel")}</span>
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
      {/* 大图标 */}
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
          <Bot className="h-10 w-10 text-violet-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center ring-2 ring-background">
          <Sparkles className="h-3 w-3 text-white" />
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

// ========== 对话侧边栏 ==========
function ConversationSidebar({
  conversations,
  currentId,
  onSelect,
  onDelete,
  onNew,
  isCollapsed,
  onToggle,
  t,
}: {
  conversations: ConversationData[]
  currentId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  isCollapsed: boolean
  onToggle: () => void
  t: ReturnType<typeof useTranslations<"aiAssistant">>
}) {
  return (
    <div
      className={cn(
        "flex flex-col border-r bg-muted/30 transition-all duration-300",
        isCollapsed ? "w-0 border-r-0 overflow-hidden" : "w-72"
      )}
    >
      {/* 侧边栏头部 */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{t("sidebarTitle")}</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onNew}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("newConversation")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 对话列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group relative p-3 rounded-lg cursor-pointer transition-all duration-200",
                conv.id === currentId
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-accent/50 border border-transparent"
              )}
              onClick={() => onSelect(conv.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{conv.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("sidebarMessageCount", { count: conv.messages.length })}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                {conversations.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(conv.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const { ready } = useAuthReady()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // AI 配置状态
  const { isConfigured, isLoading: isConfigLoading } = useAIConfig()

  // AI 聊天 Hook
  const {
    sendMessage: sendAIMessage,
    isLoading,
    stop: stopGenerating,
    error: aiError,
    clearError,
  } = useAIChat()

  // 初始化对话
  useEffect(() => {
    setMounted(true)
    const initialConv: ConversationData = {
      id: "1",
      title: t("newConversation"),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setConversations([initialConv])
    setCurrentConversationId("1")
  }, [])

  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === currentConversationId),
    [conversations, currentConversationId]
  )

  // 发送消息
  const handleSendMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!inputMessage.trim() || !currentConversation || isLoading) return

      // 清除之前的错误
      clearError()

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: inputMessage.trim(),
        timestamp: Date.now(),
      }

      // 创建 AI 消息占位符
      const assistantMessageId = (Date.now() + 1).toString()
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      }

      // 添加用户消息和 AI 占位消息
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [...conv.messages, userMessage, assistantMessage],
                title:
                  conv.messages.length === 0
                    ? inputMessage.slice(0, 30) + (inputMessage.length > 30 ? "..." : "")
                    : conv.title,
                updatedAt: Date.now(),
              }
            : conv
        )
      )

      setInputMessage("")
      setStreamingMessageId(assistantMessageId)

      // 构建历史消息
      const historyMessages: APIChatMessage[] = currentConversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      // 添加当前用户消息
      historyMessages.push({
        role: "user",
        content: inputMessage.trim(),
      })

      try {
        // 使用流式 API
        await sendAIMessage(historyMessages, (delta) => {
          // 更新 AI 消息内容
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === currentConversationId
                ? {
                    ...conv,
                    messages: conv.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + delta }
                        : msg
                    ),
                    updatedAt: Date.now(),
                  }
                : conv
            )
          )
        })
      } catch (error) {
        // 如果发生错误，更新消息显示错误
        const errorMessage = error instanceof Error ? error.message : t("chatError")
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: `❌ ${errorMessage}` }
                      : msg
                  ),
                }
              : conv
          )
        )
      } finally {
        setStreamingMessageId(null)
      }
    },
    [inputMessage, currentConversation, currentConversationId, isLoading, sendAIMessage, clearError, t]
  )

  // 新建对话
  const handleNewConversation = useCallback(() => {
    const newConv: ConversationData = {
      id: Date.now().toString(),
      title: t("newConversation"),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setConversations((prev) => [newConv, ...prev])
    setCurrentConversationId(newConv.id)
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

    // 创建新的 AI 消息占位符
    const assistantMessageId = Date.now().toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    }

    // 更新对话：移除旧的 AI 消息，添加新的占位
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...messagesWithoutLastAI, assistantMessage],
            }
          : conv
      )
    )

    setStreamingMessageId(assistantMessageId)

    // 构建历史消息（不包含最后一条 AI 消息）
    const historyMessages: APIChatMessage[] = messagesWithoutLastAI.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    try {
      await sendAIMessage(historyMessages, (delta) => {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + delta }
                      : msg
                  ),
                  updatedAt: Date.now(),
                }
              : conv
          )
        )
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("chatError")
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: `❌ ${errorMessage}` }
                    : msg
                ),
              }
            : conv
        )
      )
    } finally {
      setStreamingMessageId(null)
    }
  }, [currentConversation, currentConversationId, isLoading, sendAIMessage, t])

  // 加载状态
  if (!mounted || !ready) {
    return null
  }

  const hasMessages = currentConversation && currentConversation.messages.length > 0

  return (
    <>
      <PageHeader title={t("pageTitle")}>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  {sidebarCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {sidebarCollapsed ? t("expandSidebar") : t("collapseSidebar")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportConversation}
            disabled={!hasMessages}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("exportConversation")}
          </Button>
          <Button size="sm" onClick={handleNewConversation}>
            <Plus className="mr-2 h-4 w-4" />
            {t("newConversation")}
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* 对话历史侧边栏 */}
        <ConversationSidebar
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={setCurrentConversationId}
          onDelete={handleDeleteConversation}
          onNew={handleNewConversation}
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          t={t}
        />

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {!hasMessages ? (
            <WelcomePanel onUseTemplate={handleUseTemplate} t={t} />
          ) : (
            <Conversation className="flex-1">
              <ConversationContent className="space-y-6 pb-4">
                {currentConversation?.messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onCopy={handleCopyMessage}
                    onRegenerate={handleRegenerate}
                    copiedId={copiedId}
                    isLast={index === currentConversation.messages.length - 1}
                    isLoading={isLoading}
                    t={t}
                  />
                ))}
                {isLoading && <LoadingIndicator t={t} />}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          )}

          {/* 输入区域 */}
          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-4xl mx-auto p-4">
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

              {/* 输入框 */}
              <PromptInput
                onSubmit={handleSendMessage}
                className="shadow-lg border-border/50"
              >
                <PromptInputTextarea
                  ref={inputRef as any}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isConfigured ? t("inputPlaceholder") : t("aiNotConfiguredPlaceholder")}
                  className="min-h-[52px]"
                  disabled={!isConfigured}
                />
                <PromptInputToolbar>
                  <PromptInputTools>
                    {isConfigLoading ? (
                      <Badge variant="secondary" className="text-xs font-normal gap-1">
                        <Loader size={10} className="text-muted-foreground" />
                        {t("checkingConfig")}
                      </Badge>
                    ) : isConfigured ? (
                      <Badge variant="secondary" className="text-xs font-normal gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        {t("statusOnline")}
                      </Badge>
                    ) : (
                      <Link href="/dashboard/settings?tab=ai">
                        <Badge variant="destructive" className="text-xs font-normal gap-1 cursor-pointer hover:opacity-80">
                          <AlertCircle className="h-3 w-3" />
                          {t("aiNotConfigured")}
                        </Badge>
                      </Link>
                    )}
                  </PromptInputTools>
                  <div className="flex items-center gap-2">
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

              {/* 提示文字 */}
              <p className="text-[11px] text-muted-foreground/70 text-center mt-2">
                {t("safetyNotice")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
