/**
 * 补全弹窗组件
 */

"use client"

import { useEffect, useRef, useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { CompletionItemComponent } from "./completion-item"
import type { CompletionItem } from "@/lib/completion/types"
import { useTerminalTheme } from "@/contexts/terminal-theme-context"
import { computeFloatingPosition, type FloatingPlacement } from "@/lib/overlay-position"
import { cn } from "@/lib/utils"

interface CompletionPopupProps {
  items: CompletionItem[]
  selectedIndex: number
  position: { x: number; y: number; lineTop?: number; lineBottom?: number }
  matchedPrefix: string
  showIcon?: boolean
  showDescription?: boolean
  onSelect: (item: CompletionItem, index: number) => void
  onClose: () => void
  onPlacementChange?: (placement: FloatingPlacement) => void
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
  onPlacementChange,
}: CompletionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  const theme = useTerminalTheme()
  const [placement, setPlacement] = useState<FloatingPlacement>("bottom")

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
  // 使用 useLayoutEffect，确保在浏览器首帧渲染前就确定最终位置，避免出现「先出现再跳动」的过程
  useLayoutEffect(() => {
    if (!popupRef.current) return
    if (items.length === 0) return

    const popup = popupRef.current
    const rect = popup.getBoundingClientRect()

    const result = computeFloatingPosition({
      anchor: position,
      rect,
      // 优先顺序：下 -> 上 -> 右 -> 左
      preferredPlacements: ["bottom", "top", "right", "left"],
      margin: 8,
      avoidArea:
        position.lineTop !== undefined && position.lineBottom !== undefined
          ? { top: position.lineTop, bottom: position.lineBottom }
          : undefined,
    })

    if (!result) {
      // 极端情况下没有任何方向能完全放下，直接关闭
      onClose()
      return
    }

    setPlacement(result.placement)
    if (onPlacementChange) {
      onPlacementChange(result.placement)
    }
    popup.style.left = `${result.left}px`
    popup.style.top = `${result.top}px`
  }, [position, items.length, onClose])

  if (items.length === 0) {
    return null
  }

  const popup = (
    <div
      ref={popupRef}
      className={cn(
        "fixed z-[9999] rounded-md shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex",
        placement === "top" ? "flex-col-reverse" : "flex-col",
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxHeight: "280px",
        minWidth: "320px",
        maxWidth: "550px",
        backgroundColor: theme.background,
      }}
    >
      <div
        className={cn(
          "overflow-y-auto max-h-[240px] scrollbar-custom flex-1 flex",
          placement === "top" ? "flex-col-reverse" : "flex-col",
        )}
      >
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
