/**
 * 补全弹窗组件 - 基于 Radix Popover + cmdk
 */

"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import {
  Command as CommandIcon,
  Clock3,
  Cloud,
  FileText,
  Sparkles,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import type { CompletionItem } from "@/lib/completion/types"
import { useTerminalTheme } from "@/contexts/terminal-theme-context"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

type Placement = "top" | "bottom"

interface CompletionPopupProps {
  items: CompletionItem[]
  selectedIndex: number
  position: { x: number; y: number }
  matchedPrefix: string
  showIcon?: boolean
  onSelect: (item: CompletionItem, index: number) => void
  onClose: () => void
  onSelectedIndexChange?: (index: number) => void
  onPlacementChange?: (placement: Placement) => void
}

const sourceLabelKey: Record<CompletionItem["source"], string> = {
  local: "completionSourceLocal",
  remote: "completionSourceRemote",
  history: "completionSourceHistory",
  script: "completionSourceScript",
  ai: "completionSourceAi",
}

/**
 * 高亮匹配的前缀
 */
function HighlightedText({
  text,
  prefix,
  highlightColor,
}: {
  text: string
  prefix: string
  highlightColor: string
}) {
  if (!prefix || !text.toLowerCase().startsWith(prefix.toLowerCase())) {
    return <span>{text}</span>
  }

  const matched = text.slice(0, prefix.length)
  const remaining = text.slice(prefix.length)

  return (
    <>
      <span className="font-semibold" style={{ color: highlightColor }}>
        {matched}
      </span>
      <span>{remaining}</span>
    </>
  )
}

function getCompletionIcon(item: CompletionItem) {
  if (item.providerName === "session") {
    return Clock3
  }
  if (item.source === "ai") {
    return Sparkles
  }
  if (item.source === "remote") {
    return Cloud
  }
  if (item.source === "history") {
    return Clock3
  }
  if (item.source === "script") {
    return FileText
  }
  return CommandIcon
}

export function CompletionPopup({
  items,
  selectedIndex,
  position,
  matchedPrefix,
  showIcon = true,
  onSelect,
  onClose,
  onSelectedIndexChange,
  onPlacementChange,
}: CompletionPopupProps) {
  const theme = useTerminalTheme()
  const t = useTranslations("terminal")
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [placement, setPlacement] = useState<Placement>("bottom")

  // 自动滚动到选中项
  useEffect(() => {
    const selectedElement = itemRefs.current.get(selectedIndex)
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [selectedIndex])

  // 处理鼠标悬停
  const handleMouseEnter = useCallback(
    (index: number) => {
      if (onSelectedIndexChange) {
        onSelectedIndexChange(index)
      }
    },
    [onSelectedIndexChange]
  )

  // 处理位置变化
  const handlePlacementChange = useCallback(
    (newPlacement: Placement) => {
      setPlacement(newPlacement)
      if (onPlacementChange) {
        onPlacementChange(newPlacement)
      }
    },
    [onPlacementChange]
  )

  if (items.length === 0) {
    return null
  }

  // 当弹窗在上方时，反转列表顺序
  const displayItems = placement === "top" ? [...items].reverse() : items
  // 计算反转后的选中索引
  const displaySelectedIndex =
    placement === "top" ? items.length - 1 - selectedIndex : selectedIndex

  return (
    <Popover open={true} onOpenChange={(open) => !open && onClose()}>
      {/* 虚拟锚点：定位到光标位置 */}
      <PopoverAnchor asChild>
        <div
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </PopoverAnchor>

      <PopoverContent
        side="bottom"
        sideOffset={4}
        align="start"
        alignOffset={0}
        collisionPadding={8}
        avoidCollisions={true}
        // 阻止自动聚焦，避免抢走终端焦点
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // 阻止按键事件冒泡到 Popover（由终端组件处理）
        onKeyDown={(e) => e.stopPropagation()}
        // 监听位置变化
        onPointerDownOutside={(e) => e.preventDefault()}
        className={cn(
          "w-auto min-w-[320px] max-w-[550px] p-0 overflow-hidden flex",
          placement === "top" ? "flex-col-reverse" : "flex-col"
        )}
        style={{
          backgroundColor: theme.background,
          // 当弹窗在上方时，增加底部间距避免遮挡光标
          marginBottom: placement === "top" ? 16 : 0,
        }}
        // Radix 会通过 data-side 属性告知当前位置
        ref={(el) => {
          if (el) {
            const side = el.getAttribute("data-side") as Placement | null
            if (side && side !== placement) {
              handlePlacementChange(side)
            }
          }
        }}
      >
        <Command
          className="bg-transparent"
          // 禁用 cmdk 内置的键盘导航，由终端组件处理
          disablePointerSelection={false}
          loop={false}
        >
          <CommandList
            ref={listRef}
            className="max-h-[240px] overflow-y-auto scrollbar-custom"
          >
            <CommandGroup className="p-0">
              {displayItems.map((item, displayIndex) => {
                // 计算原始索引
                const originalIndex =
                  placement === "top"
                    ? items.length - 1 - displayIndex
                    : displayIndex
                const isSelected = originalIndex === selectedIndex

                return (
                  <CommandItem
                    key={`${item.text}-${originalIndex}`}
                    value={`${item.text}-${originalIndex}`}
                    data-selected={isSelected}
                    ref={(el) => {
                      if (el) {
                        itemRefs.current.set(originalIndex, el)
                      } else {
                        itemRefs.current.delete(originalIndex)
                      }
                    }}
                    onSelect={() => onSelect(item, originalIndex)}
                    onMouseEnter={() => handleMouseEnter(originalIndex)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-1.5 cursor-pointer rounded-none",
                      "aria-selected:bg-transparent", // 禁用 cmdk 默认选中样式
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "bg-transparent"
                    )}
                  >
                    {/* 图标 */}
                    {showIcon && (
                      <div
                        className="flex-shrink-0 text-zinc-500 dark:text-zinc-400"
                        title={t(sourceLabelKey[item.source])}
                        aria-label={t(sourceLabelKey[item.source])}
                      >
                        {(() => {
                          const Icon = getCompletionIcon(item)
                          return <Icon className="h-3.5 w-3.5" />
                        })()}
                      </div>
                    )}

                    {/* 主文本 */}
                    <div className="flex-1 min-w-0 font-mono text-sm text-zinc-800 dark:text-zinc-200">
                      <HighlightedText
                        text={item.displayText || item.text}
                        prefix={matchedPrefix}
                        highlightColor={theme.green || "#22c55e"}
                      />
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
