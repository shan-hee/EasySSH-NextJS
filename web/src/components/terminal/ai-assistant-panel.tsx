"use client"

import { useState, useRef, useEffect, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, User, Sparkles, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
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
// 注意：暂时使用简化的代码块样式，避免 react-syntax-highlighter 的兼容性问题
// 如果需要完整语法高亮，可以后续使用 shiki（你已安装）

// ========== 常量定义 ==========
const ANIMATION_DELAY = 300
const DEFAULT_MESSAGE_HEIGHT = 300
const MAX_HEIGHT_RATIO = 0.5
const MIN_DRAG_DISTANCE = 5
const AUTO_COLLAPSE_HEIGHT = 50
const AI_RESPONSE_DELAY = 1000

// ========== 类型定义 ==========
type MessageRole = "user" | "assistant"

interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
}

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
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
const MessageItem = memo(({ message }: { message: Message }) => (
  <div
    className={cn(
      "flex gap-3 items-start",
      message.role === "user" ? "flex-row-reverse" : "flex-row"
    )}
  >
    {/* 头像 */}
    <div
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
        message.role === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
      aria-hidden="true"
    >
      {message.role === "user" ? (
        <User className="h-3.5 w-3.5" />
      ) : (
        <Bot className="h-3.5 w-3.5" />
      )}
    </div>

    {/* 消息内容 */}
    <div
      className={cn(
        "flex flex-col gap-1 max-w-[85%]",
        message.role === "user" ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "px-3 py-2 rounded-lg text-sm",
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <MessageContent content={message.content} />
      </div>
      <span className="text-xs text-muted-foreground px-1">
        {message.timestamp.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  </div>
))

MessageItem.displayName = 'MessageItem'

export function AiAssistantPanel({ isOpen }: AiAssistantPanelProps) {
  // ========== 状态管理 ==========
  const tAI = useTranslations("aiAssistant")

  const [input, setInput] = useState("")
  const [model, setModel] = useState("auto")
  const [isExpanded, setIsExpanded] = useState(false)
  const [messageHeight, setMessageHeight] = useState(DEFAULT_MESSAGE_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartHeight, setDragStartHeight] = useState(DEFAULT_MESSAGE_HEIGHT)
  const [hasMoved, setHasMoved] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [isLoading, setIsLoading] = useState(false) // 加载状态
  const [error, setError] = useState<string | null>(null) // 错误状态

  // ========== Refs ==========
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ========== 消息数据 ==========
  const [messages, setMessages] = useState<Message[]>([])

  // ========== Effects ==========
  // 自动滚动到底部（平滑滚动）
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages, isExpanded])

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

  // ========== 事件处理器 ==========
  // 使用 useCallback 缓存，避免子组件不必要的重渲染
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userInput = input.trim()

    // 清空输入和错误
    setInput("")
    setError(null)

    // 添加用户消息 - 使用 crypto.randomUUID() 生成唯一 ID
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userInput,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    // 开始加载
    setIsLoading(true)

    // TODO: 调用 AI API
    // 模拟 AI 回复
    setTimeout(() => {
      try {
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: tAI("panelMockReply", { content: userInput }),
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiMessage])
        setIsLoading(false)
      } catch (err) {
        setError(tAI("panelErrorSendFailed"))
        setIsLoading(false)
        console.error('AI response error:', err)
      }
    }, AI_RESPONSE_DELAY)
  }, [input, isLoading, tAI])

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
    // 获取终端容器高度
    const terminalContainer = containerRef.current?.closest('.flex.flex-col.overflow-hidden.relative')
    const maxHeight = terminalContainer
      ? (terminalContainer as HTMLElement).clientHeight * MAX_HEIGHT_RATIO
      : DEFAULT_MESSAGE_HEIGHT

    if (isExpanded) {
      setIsExpanded(false)
      setMessageHeight(0)
    } else {
      setIsExpanded(true)
      setMessageHeight(maxHeight) // 展开到终端高度的50%
    }
  }, [isExpanded])

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
        // 获取终端容器高度
        const terminalContainer = containerRef.current?.closest('.flex.flex-col.overflow-hidden.relative')
        const maxHeight = terminalContainer
          ? (terminalContainer as HTMLElement).clientHeight * MAX_HEIGHT_RATIO
          : DEFAULT_MESSAGE_HEIGHT * 2

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
  }, [isDragging, dragStartY, dragStartHeight, isExpanded, messageHeight, hasMoved])

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

              <ScrollArea style={{ height: `${messageHeight}px` }}>
                <div
                  ref={scrollRef}
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                  aria-label={tAI("panelAriaHistoryLabel")}
                  className="px-4 pt-2 pb-4 flex flex-col gap-3"
                >
                  {messages.map((message) => (
                    <MessageItem key={message.id} message={message} />
                  ))}
                  {/* 加载指示器 */}
                  {isLoading && (
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
                  placeholder={tAI("panelInputPlaceholder")}
                  className="min-h-[60px] text-base"
                />

                <PromptInputToolbar>
                  <PromptInputTools>
                    {/* 模型选择器 */}
                    <PromptInputModelSelect value={model} onValueChange={setModel}>
                      <PromptInputModelSelectTrigger className="gap-1.5 pl-2.5 pr-3 h-8 text-xs">
                        <Sparkles className="h-3.5 w-3.5" />
                        <PromptInputModelSelectValue />
                      </PromptInputModelSelectTrigger>
                      <PromptInputModelSelectContent>
                        <PromptInputModelSelectItem value="auto">
                          Auto
                        </PromptInputModelSelectItem>
                        <PromptInputModelSelectItem value="gpt-4">
                          GPT-4
                        </PromptInputModelSelectItem>
                        <PromptInputModelSelectItem value="claude">
                          Claude
                        </PromptInputModelSelectItem>
                      </PromptInputModelSelectContent>
                    </PromptInputModelSelect>
                  </PromptInputTools>

                  <div className="flex items-center gap-2">
                    {/* 使用率显示 */}
                    <span className="text-xs text-muted-foreground">52% used</span>

                    {/* 提交按钮 */}
                    <PromptInputSubmit
                      disabled={!input.trim() || isLoading}
                      className="h-8 w-8"
                      aria-label="Send message"
                    />
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
