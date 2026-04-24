"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { TerminalAgentTimeline } from "@/components/ai-agent/terminal-agent-timeline"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, Square, Trash2, Settings2, X } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import {
  Collapsible,
  CollapsibleContent,
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
import { useAgentSession } from "@/hooks/use-agent-session"
import { useAIConfig } from "@/hooks/use-ai-config"
// 注意：使用简化的代码块样式，避免引入额外依赖
// 如果需要完整语法高亮，可以后续使用 shiki（你已安装）

// ========== 常量定义 ==========
const ANIMATION_DELAY = 300
const DEFAULT_MESSAGE_HEIGHT = 300
const MAX_HEIGHT_RATIO = 0.5
const MIN_DRAG_DISTANCE = 5
const AUTO_COLLAPSE_HEIGHT = 50

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AiAssistantPanel({ isOpen, onClose }: AiAssistantPanelProps) {
  // ========== 状态管理 ==========
  const tAI = useTranslations("aiAssistant")
  const { isConfigured, isLoading: isConfigLoading, models, model: defaultModel } = useAIConfig()
  const {
    session,
    transport,
    timeline,
    tasks,
    error,
    canSend: canSendToSession,
    restoreLatestSession,
    startNewSession,
    sendMessage,
    confirmTask,
    cancelSession,
  } = useAgentSession()

  const [input, setInput] = useState("")
  const [model, setModel] = useState("auto")
  const [isExpanded, setIsExpanded] = useState(false)
  const [messageHeight, setMessageHeight] = useState(DEFAULT_MESSAGE_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartHeight, setDragStartHeight] = useState(DEFAULT_MESSAGE_HEIGHT)
  const [hasMoved, setHasMoved] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  // ========== Refs ==========
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wasOpenRef = useRef(false)

  const modelOptions = models.length > 0 ? models : ["auto"]
  const resolvedModel =
    model && modelOptions.includes(model)
      ? model
      : (
          defaultModel && modelOptions.includes(defaultModel)
            ? defaultModel
            : modelOptions[0]
        )
  const activeModel = resolvedModel === "auto" ? undefined : resolvedModel
  const messageCount = timeline.filter((entry) => entry.kind === "message" && entry.data).length
  const runningTasks = tasks.filter((task) => task.status === "running" || task.status === "queued")
  const pendingConfirmationTasks = tasks.filter((task) => task.status === "waiting_confirm")
  const hasPendingAssistantMessage = timeline.some(
    (entry) => entry.kind === "message" && entry.data?.role === "assistant" && Boolean(entry.data.pending)
  )
  const isSessionRunning = session?.status === "running"
  const shouldShowLoadingIndicator =
    isSessionRunning &&
    !hasPendingAssistantMessage &&
    runningTasks.length === 0 &&
    pendingConfirmationTasks.length === 0
  const canSend =
    !!input.trim() &&
    isConfigured &&
    !isConfigLoading &&
    canSendToSession
  const configStatusText = isConfigLoading
    ? tAI("checkingConfig")
    : !isConfigured
      ? tAI("aiNotConfigured")
      : `${tAI("statusOnline")} · ${resolvedModel} · ${transport === "ws" ? tAI("transportWs") : transport === "sse" ? tAI("transportSse") : transport === "connecting_ws" ? tAI("transportConnecting") : tAI("transportIdle")}`

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
  useEffect(() => {
    if (isExpanded) {
      scrollToBottom(isSessionRunning ? "auto" : "smooth")
    }
  }, [timeline, isExpanded, isSessionRunning, shouldShowLoadingIndicator, scrollToBottom])

  useEffect(() => {
    requestAnimationFrame(() => {
      setShouldAnimate(true)
    })
  }, [])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, ANIMATION_DELAY)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !isConfigured || isConfigLoading || session || transport !== "idle" || error) {
      return
    }

    void restoreLatestSession().then((restored) => {
      if (restored) {
        return
      }
      void startNewSession({
        model: activeModel,
        permissionMode: "balanced",
      })
    })
  }, [
    isOpen,
    isConfigured,
    isConfigLoading,
    session,
    transport,
    error,
    restoreLatestSession,
    startNewSession,
    activeModel,
  ])

  useEffect(() => {
    if (!isOpen) return

    const handleEscClose = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      onClose()
    }

    window.addEventListener("keydown", handleEscClose)
    return () => {
      window.removeEventListener("keydown", handleEscClose)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false
      return
    }

    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true
    if (!justOpened) return
    if (timeline.length === 0 && !isSessionRunning && pendingConfirmationTasks.length === 0) return
    if (isExpanded && messageHeight > AUTO_COLLAPSE_HEIGHT) return

    const timer = setTimeout(() => {
      expandPanel()
    }, 0)

    return () => clearTimeout(timer)
  }, [
    isOpen,
    timeline.length,
    isSessionRunning,
    pendingConfirmationTasks.length,
    isExpanded,
    messageHeight,
    expandPanel,
  ])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !isConfigured || isConfigLoading) return

    const userInput = input.trim()
    expandPanel()

    if (!session && transport === "idle") {
      await startNewSession({
        model: activeModel,
        permissionMode: "balanced",
      })
    }

    const sent = await sendMessage(userInput)
    if (sent) {
      setInput("")
    }
  }, [
    input,
    isConfigured,
    isConfigLoading,
    sendMessage,
    expandPanel,
    session,
    transport,
    startNewSession,
    activeModel,
  ])

  const handleClearConversation = useCallback(() => {
    void startNewSession({
      model: activeModel,
      permissionMode: "balanced",
    })
  }, [startNewSession, activeModel])

  const handleClosePanel = useCallback(() => {
    onClose()
  }, [onClose])

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
                    disabled={timeline.length === 0 && !session}
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
                  <TerminalAgentTimeline
                    entries={timeline}
                    tText={tAI}
                    onConfirmTask={confirmTask}
                    shouldShowLoadingIndicator={shouldShowLoadingIndicator}
                  />
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
                    ref={inputRef}
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
                    disabled={
                      isConfigLoading ||
                      !isConfigured ||
                      transport === "connecting_ws" ||
                      (Boolean(session) && !canSendToSession)
                    }
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
                        {tAI("sidebarMessageCount", { count: messageCount })}
                      </span>

                      {isSessionRunning ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => void cancelSession()}
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
