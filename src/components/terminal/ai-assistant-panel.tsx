"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, User, Sparkles } from "lucide-react"
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

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
}

// 消息内容渲染组件 - 支持代码块和换行
function MessageContent({ content }: { content: string }) {
  // 简单处理代码块和换行
  const parts = content.split(/```(\w+)?\n?([\s\S]*?)```/g)

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        // 奇数索引是代码块
        if (index % 3 === 2) {
          return (
            <pre key={index} className="bg-black/20 dark:bg-white/10 rounded p-2 text-xs overflow-x-auto">
              <code>{part.trim()}</code>
            </pre>
          )
        } else if (index % 3 === 0 && part) {
          // 偶数索引是普通文本
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
}

export function AiAssistantPanel({ isOpen, onClose }: AiAssistantPanelProps) {
  const [input, setInput] = useState("")
  const [model, setModel] = useState("auto")
  const [isExpanded, setIsExpanded] = useState(false) // 消息列表展开状态
  const [messageHeight, setMessageHeight] = useState(300) // 消息列表高度
  const [isDragging, setIsDragging] = useState(false) // 拖拽状态
  const [dragStartY, setDragStartY] = useState(0) // 拖拽起始Y坐标
  const [dragStartHeight, setDragStartHeight] = useState(300) // 拖拽起始高度
  const [hasMoved, setHasMoved] = useState(false) // 是否真正拖拽过
  const containerRef = useRef<HTMLDivElement>(null) // 容器引用，用于获取终端高度
  const [shouldAnimate, setShouldAnimate] = useState(false) // 控制是否启用过渡动画
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "你好！我是 AI 助手，可以帮你执行终端命令、解释输出、提供建议等。有什么我可以帮你的吗？",
      timestamp: new Date(Date.now() - 600000),
    },
    {
      id: "2",
      role: "user",
      content: "帮我查看一下当前目录下的文件",
      timestamp: new Date(Date.now() - 540000),
    },
    {
      id: "3",
      role: "assistant",
      content: "好的，我建议使用以下命令：\n\n```bash\nls -lah\n```\n\n这个命令会显示：\n- `-l`: 详细列表格式\n- `-a`: 包含隐藏文件\n- `-h`: 人类可读的文件大小",
      timestamp: new Date(Date.now() - 520000),
    },
    {
      id: "4",
      role: "user",
      content: "如何查看系统内存使用情况？",
      timestamp: new Date(Date.now() - 400000),
    },
    {
      id: "5",
      role: "assistant",
      content: "有几种方法可以查看内存使用情况：\n\n1. **free 命令**（推荐）：\n```bash\nfree -h\n```\n\n2. **查看详细信息**：\n```bash\ncat /proc/meminfo\n```\n\n3. **实时监控**：\n```bash\ntop\n```\n然后按 M 键按内存排序。",
      timestamp: new Date(Date.now() - 380000),
    },
    {
      id: "6",
      role: "user",
      content: "谢谢！很有帮助",
      timestamp: new Date(Date.now() - 300000),
    },
    {
      id: "7",
      role: "assistant",
      content: "不客气！随时为您服务。如果还有其他问题，欢迎继续提问。😊",
      timestamp: new Date(Date.now() - 280000),
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    // TODO: 调用 AI API
    // 模拟 AI 回复
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `收到您的消息："${input.trim()}"。这是一个模拟回复，实际的 AI 功能需要接入后端 API。`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
    }, 1000)

    // 清空输入
    setInput("")
  }

  // 拖拽处理
  const handleDragStart = (e: React.MouseEvent) => {
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
  }

  // 双击展开/收起
  const handleDoubleClick = () => {
    // 获取终端容器高度
    const terminalContainer = containerRef.current?.closest('.flex.flex-col.overflow-hidden.relative')
    const maxHeight = terminalContainer
      ? (terminalContainer as HTMLElement).clientHeight * 0.5
      : 300

    if (isExpanded) {
      setIsExpanded(false)
      setMessageHeight(0)
    } else {
      setIsExpanded(true)
      setMessageHeight(maxHeight) // 展开到终端高度的50%
    }
  }

  useEffect(() => {
    if (!isDragging) return

    // 禁用文本选择
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ns-resize'

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault() // 防止选中文本

      // 检测是否真的移动了（超过5px才算拖拽）
      const deltaY = dragStartY - e.clientY
      if (Math.abs(deltaY) > 5 && !hasMoved) {
        setHasMoved(true)
      }

      // 只有真正移动时才调整高度
      if (Math.abs(deltaY) > 5) {
        // 获取终端容器高度
        const terminalContainer = containerRef.current?.closest('.flex.flex-col.overflow-hidden.relative')
        const maxHeight = terminalContainer
          ? (terminalContainer as HTMLElement).clientHeight * 0.5
          : 600

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
      if (messageHeight <= 50) {
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
      className={cn(
        "absolute bottom-0 left-0 right-0 z-50",
        shouldAnimate && "transition-all duration-500 ease-out",
        isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      )}
      style={{
        pointerEvents: "auto",
        willChange: isOpen ? "transform, opacity" : "auto"
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
              title="拖拽展开 • 双击展开"
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
                title="拖拽调整高度 • 双击展开/收起"
              />

              <ScrollArea style={{ height: `${messageHeight}px` }}>
                <div ref={scrollRef} className="px-4 pt-2 pb-4 flex flex-col gap-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
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
                  ))}
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
                  placeholder="向 AI 助手提问..."
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
                      disabled={!input.trim()}
                      className="h-8 w-8"
                    />
                  </div>
                </PromptInputToolbar>
              </PromptInput>
            </div>

            {/* 提示文本 */}
            <div className="mt-2 text-center text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                Enter
              </kbd>{" "}
              发送 •{" "}
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                Shift+Enter
              </kbd>{" "}
              换行 •{" "}
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                Esc
              </kbd>{" "}
              关闭
            </div>
          </div>
        </div>
        </Collapsible>
      </div>
    </div>
  )
}
