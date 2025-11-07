"use client"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface KeyboardShortcutInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

export function KeyboardShortcutInput({
  value,
  onChange,
  placeholder = "按下快捷键...",
  id,
}: KeyboardShortcutInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [recordedKeys, setRecordedKeys] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isFocused) return

    e.preventDefault()
    e.stopPropagation()

    const keys: string[] = []

    // 修饰键
    if (e.ctrlKey) keys.push("Ctrl")
    if (e.shiftKey) keys.push("Shift")
    if (e.altKey) keys.push("Alt")
    if (e.metaKey) keys.push("Meta")

    // 主键 - 过滤掉修饰键本身
    const mainKey = e.key
    const isModifierKey = ["Control", "Shift", "Alt", "Meta"].includes(mainKey)

    if (!isModifierKey && mainKey) {
      // 处理特殊键名
      let displayKey = mainKey
      if (mainKey === " ") displayKey = "Space"
      else if (mainKey.length === 1) displayKey = mainKey.toUpperCase()
      else if (mainKey === "ArrowUp") displayKey = "↑"
      else if (mainKey === "ArrowDown") displayKey = "↓"
      else if (mainKey === "ArrowLeft") displayKey = "←"
      else if (mainKey === "ArrowRight") displayKey = "→"

      keys.push(displayKey)
    }

    // 如果有有效的按键组合（至少有一个修饰键或一个主键）
    if (keys.length > 0) {
      setRecordedKeys(keys)
      const shortcut = keys.join("+")
      onChange(shortcut)
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    setRecordedKeys([])
  }

  const handleBlur = () => {
    setIsFocused(false)
    setRecordedKeys([])
  }

  const handleClear = () => {
    onChange("")
    setRecordedKeys([])
    inputRef.current?.focus()
  }

  const displayValue = isFocused && recordedKeys.length > 0
    ? recordedKeys.join("+")
    : value

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={displayValue}
        readOnly
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={isFocused ? "按下任意键组合..." : placeholder}
        className="pr-8 cursor-text"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 hover:bg-muted"
          onClick={handleClear}
          tabIndex={-1}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
