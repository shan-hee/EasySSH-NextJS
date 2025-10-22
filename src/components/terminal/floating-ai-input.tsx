"use client"

import { useState, useEffect, useRef } from "react"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputModelSelect,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectValue,
} from "@/components/ui/shadcn-io/ai/prompt-input"
import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

interface FloatingAiInputProps {
  isOpen: boolean
  onClose?: () => void
}

export function FloatingAiInput({ isOpen, onClose }: FloatingAiInputProps) {
  const [input, setInput] = useState("")
  const [model, setModel] = useState("auto")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 当打开时自动聚焦输入框
  useEffect(() => {
    if (isOpen) {
      // 延迟聚焦，等待动画完成
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // TODO: 实现 AI 请求逻辑
    console.log("AI 请求:", { input, model })

    // 清空输入
    setInput("")
  }

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none",
        "transition-all duration-500 ease-out",
        isOpen
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      )}
    >
      <div className="w-full max-w-3xl mx-auto px-4 pb-6 pointer-events-auto">
        <div className="relative">
          {/* 背景光晕效果 - 动态脉动 */}
          <div
            className={cn(
              "absolute -inset-4 bg-gradient-to-t from-primary/20 via-primary/10 to-transparent blur-xl rounded-3xl",
              "transition-opacity duration-1000",
              isOpen ? "opacity-100 animate-pulse" : "opacity-0"
            )}
          />

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
                  <span className="text-xs text-muted-foreground">
                    52% used
                  </span>

                  {/* 提交按钮 */}
                  <PromptInputSubmit
                    disabled={!input.trim()}
                    className="h-8 w-8"
                  />
                </div>
              </PromptInputToolbar>
            </PromptInput>
          </div>

          {/* 提示文本 - 淡入淡出 */}
          <div
            className={cn(
              "mt-2 text-center text-xs text-muted-foreground",
              "transition-opacity duration-300 delay-200",
              isOpen ? "opacity-100" : "opacity-0"
            )}
          >
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
    </div>
  )
}
