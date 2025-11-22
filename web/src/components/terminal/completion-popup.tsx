/**
 * 补全弹窗组件
 */

"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { CompletionItemComponent } from "./completion-item"
import type { CompletionItem } from "@/lib/completion/types"
import { useTerminalTheme } from "@/contexts/terminal-theme-context"

interface CompletionPopupProps {
  items: CompletionItem[]
  selectedIndex: number
  position: { x: number; y: number }
  matchedPrefix: string
  showIcon?: boolean
  showDescription?: boolean
  onSelect: (item: CompletionItem, index: number) => void
  onClose: () => void
}

export function CompletionPopup({
  items,
  selectedIndex,
  position,
  matchedPrefix,
  showIcon = true,
  showDescription = true,
  onSelect,
  onClose,
}: CompletionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  const theme = useTerminalTheme()

  // 自动滚动到选中项
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [selectedIndex])

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onClose])

  // 调整弹窗位置,避免超出屏幕
  useEffect(() => {
    if (!popupRef.current) return

    const popup = popupRef.current
    const rect = popup.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let adjustedX = position.x
    let adjustedY = position.y

    // 如果超出右边界,向左调整
    if (rect.right > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 10
    }

    // 如果超出底部,向上显示
    if (rect.bottom > viewportHeight) {
      adjustedY = position.y - rect.height - 20 // 显示在光标上方
    }

    popup.style.left = `${adjustedX}px`
    popup.style.top = `${adjustedY}px`
  }, [position])

  if (items.length === 0) {
    return null
  }

  const popup = (
    <div
      ref={popupRef}
      className="fixed z-[9999] rounded-md shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxHeight: "280px",
        minWidth: "320px",
        maxWidth: "550px",
        backgroundColor: theme.background,
      }}
    >
      <div className="overflow-y-auto max-h-[240px] scrollbar-custom">
        {items.map((item, index) => (
          <div
            key={`${item.text}-${index}`}
            ref={index === selectedIndex ? selectedItemRef : null}
          >
            <CompletionItemComponent
              item={item}
              isSelected={index === selectedIndex}
              matchedPrefix={matchedPrefix}
              showIcon={false}
              showDescription={showDescription}
              onClick={() => onSelect(item, index)}
              onMouseEnter={() => {
                // 鼠标悬停时更新选中索引
                // 这里不直接调用 onSelect,而是通过父组件的状态管理
              }}
            />
          </div>
        ))}
      </div>

      {/* 底部提示 */}
      <div
        className="px-3 py-1 text-xs flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400"
      >
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
            ↑↓
          </kbd>
          <span>导航</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
            Enter
          </kbd>
          <span>选择</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
            Esc
          </kbd>
          <span>关闭</span>
        </span>
      </div>
    </div>
  )

  // 使用 Portal 渲染到 body,避免被终端容器裁剪
  return createPortal(popup, document.body)
}
