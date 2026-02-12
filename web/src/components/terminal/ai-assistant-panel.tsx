"use client"

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, User, Sparkles, Loader2, Square, Trash2, Settings2, X, Brain, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { Button } from "@/components/ui/button"
import { useAIChat } from "@/hooks/use-ai-chat"
import { useAIConfig } from "@/hooks/use-ai-config"
import type { ChatMessage } from "@/lib/api/ai"
// 注意：使用简化的代码块样式，避免引入额外依赖
// 如果需要完整语法高亮，可以后续使用 shiki（你已安装）

// ========== 常量定义 ==========
const ANIMATION_DELAY = 300
const DEFAULT_MESSAGE_HEIGHT = 300
const MAX_HEIGHT_RATIO = 0.5
const MIN_DRAG_DISTANCE = 5
const AUTO_COLLAPSE_HEIGHT = 50

// ========== 类型定义 ==========
type MessageRole = "user" | "assistant"

interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
}

interface ParsedContent {
  thinking: string | null
  content: string
}

interface ParsedToolStatus {
  toolStatus: string | null
  content: string
}

interface ParsedAssistantMessage extends ParsedContent {
  toolStatus: string | null
}

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
}

function parseThinkingContent(text: string): ParsedContent {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i)

  if (thinkMatch) {
    const thinking = thinkMatch[1].trim()
    const content = text.replace(/<think>[\s\S]*?<\/think>/i, "").trim()
    return { thinking, content }
  }

  const unclosedMatch = text.match(/<think>([\s\S]*)$/i)
  if (unclosedMatch) {
    return { thinking: unclosedMatch[1].trim(), content: "" }
  }

  return { thinking: null, content: text }
}

function parseToolStatus(text: string): ParsedToolStatus {
  const toolStatusMatches = text.match(/<tool-status>([\s\S]*?)<\/tool-status>/gi)

  if (toolStatusMatches && toolStatusMatches.length > 0) {
    const lastMatch = toolStatusMatches[toolStatusMatches.length - 1]
    const statusMatch = lastMatch.match(/<tool-status>([\s\S]*?)<\/tool-status>/i)
    const toolStatus = statusMatch ? statusMatch[1].trim() : null
    const content = text.replace(/<tool-status>[\s\S]*?<\/tool-status>/gi, "").trim()
    return { toolStatus, content }
  }

  const unclosedMatch = text.match(/<tool-status>([\s\S]*)$/i)
  if (unclosedMatch) {
    return {
      toolStatus: unclosedMatch[1].trim(),
      content: text.replace(/<tool-status>[\s\S]*$/i, "").trim(),
    }
  }

  return { toolStatus: null, content: text }
}

function parseAssistantMessageContent(text: string): ParsedAssistantMessage {
  const toolStatusResult = parseToolStatus(text)
  const thinkingResult = parseThinkingContent(toolStatusResult.content)
  return {
    toolStatus: toolStatusResult.toolStatus,
    thinking: thinkingResult.thinking,
    content: thinkingResult.content,
  }
}

function sanitizeAssistantContentForHistory(text: string): string {
  return parseAssistantMessageContent(text).content
}

// ========== 消息内容渲染组件 ==========
// 支持代码块和换行（使用优化的样式）
const MessageContent = memo(({ content }: { content: string }) => {
  // 使用正则提取代码块：```language\ncode```
  const parts = content.split(/```(\w+)?\n?([\s\S]*?)```/g)

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        // index % 3 === 1 是语言标识，index % 3 === 2 是代码内容
        if (index % 3 === 2) {
          const language = parts[index - 1] || 'text'
          return (
            <div key={index} className="relative group">
              {/* 语言标签 */}
              {language && language !== 'text' && (
                <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-background/80 rounded border border-border">
                  {language}
                </div>
              )}
              {/* 代码块 */}
              <pre className="bg-zinc-950 dark:bg-zinc-900/50 rounded-md p-3 overflow-x-auto border border-zinc-800/50">
                <code className="text-xs font-mono text-zinc-100 dark:text-zinc-300 leading-relaxed">
                  {part.trim()}
                </code>
              </pre>
            </div>
          )
        } else if (index % 3 === 0 && part) {
          // 普通文本
          return (
            <div key={index} className="whitespace-pre-wrap">
              {part}
            </div>
          )
        }
        return null
      })}
    </div>
  )
})

MessageContent.displayName = 'MessageContent'

// ========== 消息项组件 ==========
// 使用 memo 优化，避免所有消息在新消息到来时重新渲染
const MessageItem = memo(({
  message,
  thinkingLabel,
  thinkingProcessLabel,
  isStreaming,
}: {
  message: Message
  thinkingLabel: string
  thinkingProcessLabel: string
  isStreaming?: boolean
}) => {
  const [isThinkingOpen, setIsThinkingOpen] = useState(false)
  const parsedAssistant = useMemo(
    () => (message.role === "assistant" ? parseAssistantMessageContent(message.content) : null),
    [message.role, message.content]
  )

  const isThinkingStreaming = Boolean(
    isStreaming && parsedAssistant?.thinking && !parsedAssistant?.content
  )
  const hasAssistantVisualContent = Boolean(
    parsedAssistant?.toolStatus || parsedAssistant?.thinking || parsedAssistant?.content
  )

  if (message.role === "user") {
    return (
      <div className="flex gap-3 items-start flex-row-reverse">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <User className="h-3.5 w-3.5" />
        </div>

        <div className="flex flex-col gap-1 max-w-[85%] items-end">
          <div className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground">
            <MessageContent content={message.content} />
          </div>
          <span className="text-xs text-muted-foreground px-1">
            {message.timestamp.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    )
  }

  if (!hasAssistantVisualContent) {
    return null
  }

  return (
    <div className="flex gap-3 items-start">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Bot className="h-3.5 w-3.5" />
      </div>

      <div className="flex flex-col gap-1.5 max-w-[85%] items-start">
        {parsedAssistant?.toolStatus && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 bg-muted/60 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{parsedAssistant.toolStatus}</span>
          </div>
        )}

        {parsedAssistant?.thinking && (
          <Collapsible open={isThinkingOpen} onOpenChange={setIsThinkingOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Brain className="h-3.5 w-3.5" />
                <span>{isThinkingStreaming ? thinkingLabel : thinkingProcessLabel}</span>
                <ChevronRight
                  className={cn("h-3.5 w-3.5 transition-transform", isThinkingOpen && "rotate-90")}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 px-3 py-2 rounded-lg text-xs bg-muted/70 text-muted-foreground whitespace-pre-wrap">
                {parsedAssistant.thinking}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {parsedAssistant?.content && (
          <div className="px-3 py-2 rounded-lg text-sm bg-muted text-foreground">
            <MessageContent content={parsedAssistant.content} />
          </div>
        )}

        <span className="text-xs text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
})

MessageItem.displayName = 'MessageItem'

export function AiAssistantPanel({ isOpen, onClose }: AiAssistantPanelProps) {
  // ========== 状态管理 ==========
  const tAI = useTranslations("aiAssistant")
  const { isConfigured, isLoading: isConfigLoading, models, model: defaultModel } = useAIConfig()

  const [input, setInput] = useState("")
  const [model, setModel] = useState("auto")
  const [isExpanded, setIsExpanded] = useState(false)
  const [messageHeight, setMessageHeight] = useState(DEFAULT_MESSAGE_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartHeight, setDragStartHeight] = useState(DEFAULT_MESSAGE_HEIGHT)
  const [hasMoved, setHasMoved] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [error, setError] = useState<string | null>(null) // 错误状态

  // ========== Refs ==========
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wasOpenRef = useRef(false)

  // ========== 消息数据 ==========
  const [messages, setMessages] = useState<Message[]>([])
  const {
    sendMessage,
    isLoading: isChatLoading,
    stop,
    clearError,
  } = useAIChat()

  const toChatMessages = useCallback(
    (items: Message[]): ChatMessage[] =>
      items.map((item) => ({
        role: item.role,
        content:
          item.role === "assistant"
            ? sanitizeAssistantContentForHistory(item.content)
            : item.content,
      })),
    []
  )

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement | null
    if (!viewport) return
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    })
  }, [])

  const getPanelMaxHeight = useCallback(() => {
    const terminalContainer =
      containerRef.current?.closest(".flex.flex-col.h-full.relative") ??
      containerRef.current?.closest(".flex.flex-col.overflow-hidden.relative")

    if (terminalContainer instanceof HTMLElement) {
      return Math.max(
        DEFAULT_MESSAGE_HEIGHT,
        terminalContainer.clientHeight * MAX_HEIGHT_RATIO
      )
    }

    return DEFAULT_MESSAGE_HEIGHT * 2
  }, [])

  const expandPanel = useCallback(() => {
    const maxHeight = getPanelMaxHeight()
    const baseHeight =
      messageHeight > AUTO_COLLAPSE_HEIGHT ? messageHeight : DEFAULT_MESSAGE_HEIGHT
    const nextHeight = Math.max(
      AUTO_COLLAPSE_HEIGHT + MIN_DRAG_DISTANCE,
      Math.min(maxHeight, baseHeight)
    )

    setIsExpanded(true)
    setMessageHeight(nextHeight)
  }, [getPanelMaxHeight, messageHeight])

  // ========== Effects ==========
  // 自动滚动到底部（平滑滚动）
  useEffect(() => {
    if (isExpanded) {
      scrollToBottom(isChatLoading ? "auto" : "smooth")
    }
  }, [messages, isExpanded, isChatLoading, scrollToBottom])

  useEffect(() => {
    if (models.length === 0) {
      return
    }

    const nextModel =
      defaultModel && models.includes(defaultModel) ? defaultModel : models[0]
    if (!model || !models.includes(model)) {
      setModel(nextModel)
    }
  }, [models, defaultModel, model])

  // 延迟启用过渡动画，避免初始渲染时的动画冲突
  useEffect(() => {
    // 组件挂载后立即启用动画（父组件已确保不在加载期间渲染）
    // 使用 requestAnimationFrame 确保在下一帧启用，避免初始渲染闪烁
    requestAnimationFrame(() => {
      setShouldAnimate(true)
    })
  }, [])

  // 打开时聚焦输入框并清除错误
  useEffect(() => {
    if (isOpen) {
      setError(null)
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, ANIMATION_DELAY)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleEscClose = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (isChatLoading) {
        stop()
      }
      onClose()
    }

    window.addEventListener("keydown", handleEscClose)
    return () => {
      window.removeEventListener("keydown", handleEscClose)
    }
  }, [isOpen, onClose, isChatLoading, stop])

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false
      return
    }

    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true
    if (!justOpened) return
    if (messages.length === 0 && !isChatLoading) return
    if (isExpanded && messageHeight > AUTO_COLLAPSE_HEIGHT) return

    expandPanel()
  }, [isOpen, messages.length, isChatLoading, isExpanded, messageHeight, expandPanel])

  // ========== 事件处理器 ==========
  // 使用 useCallback 缓存，避免子组件不必要的重渲染
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isChatLoading || !isConfigured || isConfigLoading) return

    const userInput = input.trim()
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userInput,
      timestamp: new Date(),
    }

    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    expandPanel()
    setInput("")
    setError(null)
    clearError()

    const nextMessages = [...messages, userMessage]
    setMessages((prev) => [...prev, userMessage, assistantMessage])

    try {
      await sendMessage(
        toChatMessages(nextMessages),
        (delta) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: `${message.content}${delta}` }
                : message
            )
          )
        },
        model === "auto" ? undefined : model
      )
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : tAI("panelErrorSendFailed")
      setError(errorMessage)

      // 若 assistant 还未收到任何内容，则移除空消息
      setMessages((prev) => {
        const target = prev.find((message) => message.id === assistantMessageId)
        if (!target || target.content.trim()) {
          return prev
        }
        return prev.filter((message) => message.id !== assistantMessageId)
      })
    }
  }, [
    input,
    isChatLoading,
    isConfigured,
    isConfigLoading,
    clearError,
    messages,
    sendMessage,
    toChatMessages,
    model,
    tAI,
    expandPanel,
  ])

  const handleClearConversation = useCallback(() => {
    if (isChatLoading) {
      stop()
    }
    setMessages([])
    setError(null)
    clearError()
  }, [isChatLoading, stop, clearError])

  const handleClosePanel = useCallback(() => {
    if (isChatLoading) {
      stop()
    }
    onClose()
  }, [isChatLoading, stop, onClose])

  const modelOptions = models.length > 0 ? models : ["auto"]
  const resolvedModel = modelOptions.includes(model) ? model : modelOptions[0]
  const configStatusText = isConfigLoading
    ? tAI("checkingConfig")
    : isConfigured
      ? `${tAI("statusOnline")} · ${resolvedModel}`
      : tAI("aiNotConfigured")
  const canSend =
    !!input.trim() && isConfigured && !isConfigLoading && !isChatLoading
  const latestAssistantMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") {
        return messages[index]
      }
    }
    return null
  }, [messages])
  const latestAssistantParsed = useMemo(
    () =>
      latestAssistantMessage
        ? parseAssistantMessageContent(latestAssistantMessage.content)
        : null,
    [latestAssistantMessage]
  )
  const shouldShowLoadingIndicator =
    isChatLoading &&
    !latestAssistantParsed?.toolStatus &&
    !latestAssistantParsed?.thinking &&
    !latestAssistantParsed?.content

  // 拖拽开始处理
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault() // 防止选中文本
    e.stopPropagation() // 阻止事件冒泡

    // 收起状态下，只允许拖拽不允许单击展开
    if (!isExpanded || messageHeight === 0) {
      setDragStartHeight(0)
    } else {
      setDragStartHeight(messageHeight)
    }

    setIsDragging(true)
    setDragStartY(e.clientY)
    setHasMoved(false) // 重置移动状态
  }, [isExpanded, messageHeight])

  // 双击展开/收起
  const handleDoubleClick = useCallback(() => {
    const maxHeight = getPanelMaxHeight()

    if (isExpanded) {
      setIsExpanded(false)
      setMessageHeight(0)
    } else {
      setIsExpanded(true)
      setMessageHeight(maxHeight)
    }
  }, [isExpanded, getPanelMaxHeight])

  // 拖拽效果处理
  useEffect(() => {
    if (!isDragging) return

    // 禁用文本选择
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ns-resize'

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault() // 防止选中文本

      // 检测是否真的移动了（使用常量阈值）
      const deltaY = dragStartY - e.clientY
      if (Math.abs(deltaY) > MIN_DRAG_DISTANCE && !hasMoved) {
        setHasMoved(true)
      }

      // 只有真正移动时才调整高度
      if (Math.abs(deltaY) > MIN_DRAG_DISTANCE) {
        const maxHeight = getPanelMaxHeight()

        // 计算新高度
        const newHeight = Math.max(0, Math.min(maxHeight, dragStartHeight + deltaY))
        setMessageHeight(newHeight)

        // 自动展开/收起
        if (newHeight > 10 && !isExpanded) {
          setIsExpanded(true)
        } else if (newHeight <= 10 && isExpanded) {
          setIsExpanded(false)
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)

      // 恢复文本选择
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      // 如果没有真正移动（点击），不做任何处理
      if (!hasMoved) {
        return
      }

      // 如果高度很小，自动收起
      if (messageHeight <= AUTO_COLLAPSE_HEIGHT) {
        setMessageHeight(0)
        setIsExpanded(false)
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      // 清理样式
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, dragStartY, dragStartHeight, isExpanded, messageHeight, hasMoved, getPanelMaxHeight])

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={tAI("panelAriaPanelLabel")}
      aria-modal={isOpen}
      className={cn(
        "absolute bottom-0 left-0 right-0 z-50",
        shouldAnimate && "transition-all duration-500 ease-out",
        isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      )}
      style={{
        pointerEvents: isOpen ? "auto" : "none",
        willChange: isOpen ? "transform, opacity" : "auto",
        visibility: isOpen ? 'visible' : 'hidden',
      }}
    >
      <div className="w-full max-w-3xl mx-auto px-4 pointer-events-auto">
        {/* 顶部边框 - 收起时显示在输入框上方 */}
        {!isExpanded && (
          <div
            className="mx-3 mb-0 pointer-events-auto relative z-10 animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div
              className={cn(
                "h-2 w-full cursor-ns-resize select-none rounded-t-xl",
                "bg-gradient-to-b from-primary/20 via-primary/10 to-transparent",
                "transition-all duration-300 ease-out",
                "shadow-[0_-2px_10px_rgba(var(--primary),0.15)]",
                "border-t border-primary/25",
                // Hover 状态
                "hover:from-primary/30 hover:via-primary/15",
                "hover:shadow-[0_-3px_15px_rgba(var(--primary),0.25)]",
                "hover:scale-[1.01]",
                // 拖拽状态
                isDragging && [
                  "from-primary/35 via-primary/18 border-primary/35",
                  "shadow-[0_-4px_20px_rgba(var(--primary),0.35)]",
                  "scale-[1.02]"
                ]
              )}
              onMouseDown={handleDragStart}
              onDoubleClick={handleDoubleClick}
              title={tAI("panelDragExpandTitle")}
            />
          </div>
        )}

        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          {/* 可折叠的消息内容区域 */}
          <CollapsibleContent>
            <div className="mx-3 mb-[2px] bg-background/95 backdrop-blur-xl shadow-2xl border border-primary/20 ring-1 ring-primary/10 rounded-t-xl rounded-b-md overflow-hidden animate-in fade-in slide-in-from-top-4 duration-400">
              {/* 顶部边框拖拽区域 */}
              <div
                className={cn(
                  "h-1.5 w-full cursor-ns-resize select-none",
                  "bg-gradient-to-b from-primary/20 to-transparent",
                  "transition-all duration-300 ease-out",
                  // Hover 状态
                  "hover:from-primary/30 hover:to-transparent",
                  "hover:shadow-[0_2px_8px_rgba(var(--primary),0.2)]",
                  "hover:h-2",
                  // 拖拽状态
                  isDragging && [
                    "from-primary/40 to-primary/10",
                    "shadow-[0_2px_12px_rgba(var(--primary),0.3)]",
                    "h-2"
                  ]
                )}
                onMouseDown={handleDragStart}
                onDoubleClick={handleDoubleClick}
                title={tAI("panelDragResizeTitle")}
              />

              <div className="px-4 py-2 border-b border-border/40 flex items-center justify-between text-xs">
                <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isConfigLoading
                        ? "bg-amber-500 animate-pulse"
                        : isConfigured
                          ? "bg-emerald-500"
                          : "bg-zinc-500"
                    )}
                  />
                  <span>{configStatusText}</span>
                </div>
                <div className="flex items-center gap-1">
                  {!isConfigured && !isConfigLoading && (
                    <Button
                      asChild
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Link href="/dashboard/settings?tab=ai">
                        <Settings2 className="h-3.5 w-3.5 mr-1" />
                        {tAI("configureAI")}
                      </Link>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    disabled={messages.length === 0 && !isChatLoading}
                    onClick={handleClearConversation}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {tAI("newConversation")}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={handleClosePanel}
                    aria-label={tAI("panelHintClose")}
                    title={tAI("panelHintClose")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <ScrollArea ref={scrollAreaRef} style={{ height: `${messageHeight}px` }}>
                <div
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                  aria-label={tAI("panelAriaHistoryLabel")}
                  className="px-4 pt-2 pb-4 flex flex-col gap-3"
                >
                  {messages.length === 0 && !isChatLoading && (
                    <div className="text-xs text-muted-foreground px-1 py-2">
                      {tAI("emptyDescriptionIntro")}
                    </div>
                  )}
                  {messages.map((message) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      thinkingLabel={tAI("thinkingLabel")}
                      thinkingProcessLabel={tAI("thinkingProcess")}
                      isStreaming={
                        isChatLoading &&
                        message.role === "assistant" &&
                        message.id === latestAssistantMessage?.id
                      }
                    />
                  ))}
                  {shouldShowLoadingIndicator && (
                    <div className="flex gap-3 items-start">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="px-3 py-2 rounded-lg text-sm bg-muted text-foreground flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{tAI("panelThinking")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </CollapsibleContent>

          {/* 输入框区域 */}
          <div className="pb-6 relative">
            <div className="relative">
              {/* 背景光晕效果 */}
              <div className="absolute -inset-4 bg-gradient-to-t from-primary/20 via-primary/10 to-transparent blur-xl rounded-3xl opacity-100 animate-pulse" />

              {/* 主输入框 */}
              <div className="relative">
                <PromptInput
                  onSubmit={handleSubmit}
                  className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-xl ring-1 ring-primary/10"
                >
                  <PromptInputTextarea
                    ref={inputRef as any}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isConfigLoading
                        ? tAI("checkingConfig")
                        : !isConfigured
                          ? tAI("aiNotConfiguredPlaceholder")
                          : tAI("panelInputPlaceholder")
                    }
                    className="min-h-[60px] text-base"
                    disabled={isConfigLoading || !isConfigured || isChatLoading}
                  />

                  <PromptInputToolbar>
                    <PromptInputTools>
                      {/* 模型选择器 */}
                      {isConfigured ? (
                        <PromptInputModelSelect
                          value={resolvedModel}
                          onValueChange={setModel}
                        >
                          <PromptInputModelSelectTrigger className="gap-1.5 pl-2.5 pr-3 h-8 text-xs">
                            <Sparkles className="h-3.5 w-3.5" />
                            <PromptInputModelSelectValue />
                          </PromptInputModelSelectTrigger>
                          <PromptInputModelSelectContent>
                            {modelOptions.map((option) => (
                              <PromptInputModelSelectItem key={option} value={option}>
                                {option}
                              </PromptInputModelSelectItem>
                            ))}
                          </PromptInputModelSelectContent>
                        </PromptInputModelSelect>
                      ) : isConfigLoading ? (
                        <div className="flex items-center gap-1.5 px-2.5 h-8 text-xs text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{tAI("checkingConfig")}</span>
                        </div>
                      ) : (
                        <Link href="/dashboard/settings?tab=ai">
                          <div className="flex items-center gap-1.5 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                            <Settings2 className="h-3.5 w-3.5" />
                            <span>{tAI("configureAI")}</span>
                          </div>
                        </Link>
                      )}
                    </PromptInputTools>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {tAI("sidebarMessageCount", { count: messages.length })}
                      </span>

                      {isChatLoading ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={stop}
                          aria-label={tAI("stopGenerating")}
                          title={tAI("stopGenerating")}
                        >
                          <Square className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <PromptInputSubmit
                          disabled={!canSend}
                          className="h-8 w-8"
                          aria-label={tAI("send")}
                        />
                      )}
                    </div>
                  </PromptInputToolbar>
                </PromptInput>
              </div>

              {/* 错误提示 */}
              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mt-2 text-center text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  {error}
                </div>
              )}

              {/* 提示文本 */}
              <div className="mt-2 text-center text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  Enter
                </kbd>{" "}
                {tAI("panelHintSend")} •{" "}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  Shift+Enter
                </kbd>{" "}
                {tAI("panelHintNewline")} •{" "}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  Esc
                </kbd>{" "}
                {tAI("panelHintClose")}
              </div>
            </div>
          </div>
        </Collapsible>
      </div>
    </div>
  )
}
