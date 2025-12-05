"use client"

import { useEffect, useRef, useCallback, useLayoutEffect, useState } from "react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import { ConnectionLoader } from "./connection-loader"
import { getTerminalTheme } from "./terminal-themes"
import { CompletionPopup } from "./completion-popup"
import type { Terminal } from "@xterm/xterm"
import { useTerminalInstance } from "@/hooks/useTerminalInstance"
import { useWebSocketConnection } from "@/hooks/useWebSocketConnection"
import { CompletionEngine } from "@/lib/completion/completion-engine"
import { LocalCommandProvider } from "@/lib/completion/providers/local-command-provider"
import { RemoteHistoryProvider } from "@/lib/completion/providers/remote-history-provider"
import { ScriptProvider } from "@/lib/completion/providers/script-provider"
import { SessionProvider } from "@/lib/completion/providers/session-provider"
import type { ScriptItem } from "@/lib/completion/providers/script-provider"
import {
  parseCompletionContext,
  getCursorScreenPosition,
  applyCompletion,
  isTabKey,
  isEscapeKey,
  isUpArrow,
  isDownArrow,
  isEnterKey,
  isBackspaceKey,
} from "@/lib/completion/utils"
import type { CompletionItem, CompletionResult } from "@/lib/completion/types"
import { TerminalThemeProvider } from "@/contexts/terminal-theme-context"
import { useCompletionConfig } from "@/contexts/completion-config-context"

type CompletionPlacement = "top" | "bottom"

interface WebTerminalProps {
  sessionId: string
  serverId?: string  // 服务器 ID 用于 WebSocket 连接
  serverName: string
  host: string
  username: string
  isConnected: boolean
  onCommand: (command: string) => void
  onResize?: (cols: number, rows: number) => void
  onLoadingChange?: (isLoading: boolean) => void
  theme?: 'default' | 'dark' | 'light' | 'solarized' | 'dracula'
  fontSize?: number
  fontFamily?: string
  cursorStyle?: 'block' | 'underline' | 'bar'
  cursorBlink?: boolean
  scrollback?: number
  rightClickPaste?: boolean
  copyOnSelect?: boolean
  opacity?: number
  backgroundImage?: string
  backgroundImageOpacity?: number
  copyShortcut?: string
  pasteShortcut?: string
  clearShortcut?: string
  // 补全设置
  completionEnabled?: boolean
  completionTrigger?: 'tab' | 'auto'
  completionAutoDelay?: number
  completionMaxItems?: number
  completionShowIcon?: boolean
  completionShowDescription?: boolean
}

export function WebTerminal({
  sessionId,
  serverId,
  serverName,
  host,
  username,
  isConnected,
  onCommand,
  onResize,
  onLoadingChange,
  theme = 'default',
  fontSize = 14,
  fontFamily = 'JetBrains Mono',
  cursorStyle = 'bar',
  cursorBlink = true,
  scrollback = 1000,
  rightClickPaste = true,
  copyOnSelect = true,
  opacity = 95,
  backgroundImage = '',
  backgroundImageOpacity = 20,
  copyShortcut = 'Ctrl+Shift+C',
  pasteShortcut = 'Ctrl+Shift+V',
  clearShortcut = 'Ctrl+L',
  completionEnabled = true,
  completionTrigger = 'auto',
  completionAutoDelay = 200,
  completionMaxItems = 10,
  completionShowIcon = true,
  completionShowDescription = true,
}: WebTerminalProps) {
  const tTerminal = useTranslations("terminal")

  // 使用 next-themes 获取应用主题
  const { theme: appTheme, resolvedTheme } = useTheme()

  // 使用补全配置 Context
  const { completionConfig } = useCompletionConfig()

  // 获取实际的主题（light 或 dark）
  const currentAppTheme = (resolvedTheme || appTheme) as 'light' | 'dark' | 'system'
  const initialIsDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const effectiveAppTheme: 'light' | 'dark' =
    currentAppTheme === 'system' || !currentAppTheme
      ? (initialIsDark ? 'dark' : 'light')
      : currentAppTheme

  // 获取终端主题
  const terminalTheme = getTerminalTheme(theme, effectiveAppTheme)

  // ==================== 核心改动：从 Store 获取终端实例 ====================
  const { terminal, fitAddon, terminalReady, containerRef, isClient } = useTerminalInstance(
    sessionId,
    {
      theme: terminalTheme,
      fontSize,
      fontFamily: `'${fontFamily}', 'Fira Code', Monaco, Menlo, 'Ubuntu Mono', monospace`,
      cursorStyle,
      cursorBlink,
      scrollback,
    },
    true // enabled
  )

  // ==================== WebSocket 连接管理 ====================
  const { sendInput, resize, ws } = useWebSocketConnection({
    sessionId,
    serverId,
    serverName,
    host,
    username,
    isConnected,
    terminal,
    cols: terminal?.cols || 80,
    rows: terminal?.rows || 24,
    onLoadingChange,
    onCompletionData: (data) => {
      // 加载远端历史到 RemoteHistoryProvider
      remoteHistoryProviderRef.current?.loadHistory(data.history, data.timestamp)

      // 加载脚本库到 ScriptProvider
      scriptProviderRef.current?.loadScripts(data.scripts)

      // 补全数据发生变化时，清空引擎缓存，确保新数据参与排序
      completionEngineRef.current?.clearCache()
    }
  })

  // ==================== 补全数据同步生命周期管理 ====================
  useEffect(() => {
    // 连接断开时清空所有provider缓存
    if (!ws || !isConnected || !serverId) {
      remoteHistoryProviderRef.current?.clear()
      scriptProviderRef.current?.clear()
      sessionProviderRef.current?.clear()

      // 同步清空补全引擎缓存
      completionEngineRef.current?.clearCache()
    }
  }, [ws, isConnected, serverId])

  // ==================== 监听应用主题/终端主题变化 ====================
  useLayoutEffect(() => {
    if (!terminal) return

    const newTerminalTheme = getTerminalTheme(theme, effectiveAppTheme)
    terminal.options.theme = newTerminalTheme
  }, [theme, effectiveAppTheme, terminal])

  // ==================== 监听字体设置变化 ====================
  useEffect(() => {
    if (!terminal || !terminalReady) return
    if (terminal.options.fontSize !== fontSize) {
      terminal.options.fontSize = fontSize
    }
  }, [fontSize, terminalReady, terminal])

  useEffect(() => {
    if (!terminal || !terminalReady) return
    const newFontFamily = `'${fontFamily}', 'Fira Code', Monaco, Menlo, 'Ubuntu Mono', monospace`
    if (terminal.options.fontFamily !== newFontFamily) {
      terminal.options.fontFamily = newFontFamily
    }
  }, [fontFamily, terminalReady, terminal])

  // ==================== 监听光标设置变化 ====================
  useEffect(() => {
    if (!terminal || !terminalReady) return
    if (terminal.options.cursorStyle !== cursorStyle) {
      terminal.options.cursorStyle = cursorStyle
      terminal.options.cursorWidth = cursorStyle === 'bar' ? 2 : 1
    }
  }, [cursorStyle, terminalReady, terminal])

  useEffect(() => {
    if (!terminal || !terminalReady) return
    if (terminal.options.cursorBlink !== cursorBlink) {
      terminal.options.cursorBlink = cursorBlink
    }
  }, [cursorBlink, terminalReady, terminal])

  // ==================== 监听回滚缓冲行数变化 ====================
  useEffect(() => {
    if (!terminal || !terminalReady) return
    if (terminal.options.scrollback !== scrollback) {
      terminal.options.scrollback = scrollback
    }
  }, [scrollback, terminalReady, terminal])

  // ==================== 补全功能状态 ====================
  const [completionState, setCompletionState] = useState<{
    visible: boolean
    items: CompletionItem[]
    selectedIndex: number
    position: { x: number; y: number }
    matchedPrefix: string
  }>({
    visible: false,
    items: [],
    selectedIndex: 0,
    position: { x: 0, y: 0 },
    matchedPrefix: "",
  })

  // 记录补全弹窗的摆放方向（用于决定键盘上下键的行为）
  const [completionPlacement, setCompletionPlacement] = useState<CompletionPlacement>("bottom")
  const completionPlacementRef = useRef<CompletionPlacement>("bottom")
  useEffect(() => {
    completionPlacementRef.current = completionPlacement
  }, [completionPlacement])

  // 使用 ref 跟踪最新的 completionState
  const completionStateRef = useRef(completionState)
  useEffect(() => {
    completionStateRef.current = completionState
  }, [completionState])

  // 补全引擎实例
  const completionEngineRef = useRef<CompletionEngine | null>(null)
  const remoteHistoryProviderRef = useRef<RemoteHistoryProvider | null>(null)
  const scriptProviderRef = useRef<ScriptProvider | null>(null)
  const sessionProviderRef = useRef<SessionProvider | null>(null)

  // 自动补全定时器（防抖）
  const autoCompleteTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 补全请求进行中标记,用于简单节流: 上一次请求未完成时,忽略新的自动触发
  const completionInProgressRef = useRef(false)

  // 使用 ref 保存最新的 handleCompletionRequest 函数
  const handleCompletionRequestRef = useRef<(() => Promise<void>) | undefined>(undefined)

  // 初始化补全引擎
  useEffect(() => {
    if (!completionEngineRef.current) {
      // 合并全局配置和终端级配置
      const mergedConfig = {
        ...completionConfig,
        trigger: completionTrigger,
        autoTriggerDelay: completionAutoDelay,
        maxItems: completionMaxItems,
        showIcon: completionShowIcon,
        showDescription: completionShowDescription,
      }

      // 传递 sessionId 以区分不同服务器的补全缓存
      const engine = new CompletionEngine(sessionId, mergedConfig)

      // 本地命令提供者 (priority: 20)
      engine.registerProvider(new LocalCommandProvider())

      // 会话提供者 (priority: 25)
      const sessionProvider = new SessionProvider()
      sessionProviderRef.current = sessionProvider
      engine.registerProvider(sessionProvider)

      // 脚本库提供者 (priority: 35-40)
      const scriptProvider = new ScriptProvider()
      scriptProviderRef.current = scriptProvider
      engine.registerProvider(scriptProvider)

      // 远端历史提供者 (priority: 35-45)
      const remoteHistoryProvider = new RemoteHistoryProvider()
      remoteHistoryProviderRef.current = remoteHistoryProvider
      engine.registerProvider(remoteHistoryProvider)

      completionEngineRef.current = engine
    }
  }, [sessionId, completionConfig, completionTrigger, completionAutoDelay, completionMaxItems, completionShowIcon, completionShowDescription])

  // 动态更新补全配置
  useEffect(() => {
    if (completionEngineRef.current) {
      const mergedConfig = {
        ...completionConfig,
        trigger: completionTrigger,
        autoTriggerDelay: completionAutoDelay,
        maxItems: completionMaxItems,
        showIcon: completionShowIcon,
        showDescription: completionShowDescription,
      }
      completionEngineRef.current.updateConfig(mergedConfig)
    }
  }, [completionConfig, completionTrigger, completionAutoDelay, completionMaxItems, completionShowIcon, completionShowDescription])

  // 关闭补全弹窗
  const closeCompletion = useCallback(() => {
    setCompletionState({
      visible: false,
      items: [],
      selectedIndex: 0,
      position: { x: 0, y: 0 },
      matchedPrefix: "",
    })
  }, [])

  // 应用补全
  const applyCompletionItem = useCallback(
    (item: CompletionItem) => {
      if (!terminal) return

      const context = parseCompletionContext(terminal)
      applyCompletion(terminal, item.text, context.currentWord, sendInput)
      closeCompletion()
    },
    [terminal, closeCompletion, sendInput]
  )

  // 处理补全请求
  const handleCompletionRequest = useCallback(async () => {
    // 如果补全功能被禁用，直接返回
    if (!completionEnabled || !terminal || !completionEngineRef.current) {
      return
    }

    // 如果上一轮请求还在进行中,直接跳过本次,避免频繁并发请求
    if (completionInProgressRef.current) {
      return
    }
    completionInProgressRef.current = true

    const context = parseCompletionContext(terminal)

    try {
      // 获取补全结果
      const result = await completionEngineRef.current.getCompletions(context)

      if (!result || result.items.length === 0) {
        closeCompletion()
        return
      }

      // 计算弹窗位置（基于终端内部坐标）
      const cursorPosition = getCursorScreenPosition(terminal)

      // 将终端内部坐标转换为页面坐标
      let position = {
        x: cursorPosition.x,
        y: cursorPosition.y,
      }

      // 获取终端容器的位置偏移
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        position = {
          x: position.x + rect.left,
          y: position.y + rect.top,
        }
      }

      // 计算用于高亮的前缀：优先整行前缀，其次当前词
      const rawPrefix = context.fullLine.slice(
        0,
        Math.min(context.cursorPosition, context.fullLine.length)
      )
      const linePrefix = rawPrefix.trim()
      const matchedPrefix = linePrefix || context.currentWord

      setCompletionState({
        visible: true,
        items: result.items,
        selectedIndex: 0,
        position,
        matchedPrefix,
      })
    } finally {
      completionInProgressRef.current = false
    }
  }, [completionEnabled, terminal, closeCompletion, containerRef])

  // 更新 ref 以保持最新的函数引用
  useEffect(() => {
    handleCompletionRequestRef.current = handleCompletionRequest
  }, [handleCompletionRequest])

  // ==================== Write prompt function ====================
  const writePrompt = useCallback((term: Terminal) => {
    const hostShort = host.split('.')[0] || host
    term.write(`\x1b[1;32m${username}\x1b[0m\x1b[2m@\x1b[0m\x1b[1;36m${hostShort}\x1b[0m \x1b[1;34m~\x1b[0m\x1b[1;35m $\x1b[0m `)
  }, [host, username])

  // ==================== 处理用户输入 ====================
  useEffect(() => {
    if (!terminal || !terminalReady) return

    const disposable = terminal.onData((data: string) => {
      if (!isConnected) return

      // 检测 Tab 键 - 手动触发补全
      if (isTabKey(data)) {
        handleCompletionRequestRef.current?.()
        return
      }

      // 全局 ESC 处理: 仅在补全弹窗可见时,用 ESC 关闭弹窗,
      // 并且不会触发新的自动补全
      if (completionStateRef.current.visible && isEscapeKey(data)) {
        closeCompletion()
        if (autoCompleteTimerRef.current) {
          clearTimeout(autoCompleteTimerRef.current)
          autoCompleteTimerRef.current = null
        }
        return
      }

      // 如果补全弹窗可见,处理导航键
      if (completionStateRef.current.visible) {
        // 上箭头 - 向上导航（在弹窗位于上方时反转方向）
        if (isUpArrow(data)) {
          const isTopPlacement = completionPlacementRef.current === "top"
          setCompletionState((prev) => {
            const delta = isTopPlacement ? 1 : -1
            const nextIndex = Math.max(0, Math.min(prev.items.length - 1, prev.selectedIndex + delta))
            if (nextIndex === prev.selectedIndex) return prev
            return {
              ...prev,
              selectedIndex: nextIndex,
            }
          })
          return
        }

        // 下箭头 - 向下导航（在弹窗位于上方时反转方向）
        if (isDownArrow(data)) {
          const isTopPlacement = completionPlacementRef.current === "top"
          setCompletionState((prev) => {
            const delta = isTopPlacement ? -1 : 1
            const nextIndex = Math.max(0, Math.min(prev.items.length - 1, prev.selectedIndex + delta))
            if (nextIndex === prev.selectedIndex) return prev
            return {
              ...prev,
              selectedIndex: nextIndex,
            }
          })
          return
        }

        // 回车键 - 应用选中的补全
        if (isEnterKey(data)) {
          const selectedItem = completionStateRef.current.items[completionStateRef.current.selectedIndex]
          if (selectedItem) {
            applyCompletionItem(selectedItem)
          }
          return
        }

        // 其他输入（非导航键）- 关闭补全但继续处理输入和自动触发
        closeCompletion()
      }

      // 发送用户输入到 WebSocket
      sendInput(data)

      // 通知父组件（用于日志记录等）
      onCommand(data)

      // 检测回车键 - 追踪执行的命令（在自动触发之前）
      if (isEnterKey(data)) {
        const context = parseCompletionContext(terminal)
        const command = context.fullLine.trim()

        // 添加到会话历史
        if (command && sessionProviderRef.current) {
          sessionProviderRef.current.addCommand(command)
        }

        // 回车键不触发自动补全
        return
      }

      // 自动触发补全（防抖）：键盘连续输入时合并为一次补全请求
      // 清除旧定时器
      if (autoCompleteTimerRef.current) {
        clearTimeout(autoCompleteTimerRef.current)
        autoCompleteTimerRef.current = null
      }

      // 对于控制字符(ESC/Backspace/方向键等),不触发自动补全
      // 仅对可打印字符(含空格)进行自动补全
      if (!data || data.length === 0) {
        return
      }
      const firstCharCode = data.charCodeAt(0)
      if (firstCharCode < 32 || firstCharCode === 127) {
        return
      }

      autoCompleteTimerRef.current = setTimeout(() => {
        const context = parseCompletionContext(terminal)

        // 基于“整行前缀”判断是否触发自动补全:
        // 例如: "docker s" 也应该触发，而不仅仅看最后一个单词 "s"
        const rawPrefix = context.fullLine.slice(
          0,
          Math.min(context.cursorPosition, context.fullLine.length)
        )
        const linePrefix = rawPrefix.trim()
        const effectivePrefix = linePrefix || context.currentWord

        // 只在有一定长度的有效前缀时触发（至少2个字符）
        if (effectivePrefix && effectivePrefix.length >= 2) {
          // 使用 ref 保证调用最新的函数
          handleCompletionRequestRef.current?.()
        }

        autoCompleteTimerRef.current = null
      }, completionEngineRef.current?.getConfig().autoTriggerDelay ?? completionAutoDelay ?? 200)
    })

    return () => {
      disposable.dispose()
      if (autoCompleteTimerRef.current) {
        clearTimeout(autoCompleteTimerRef.current)
        autoCompleteTimerRef.current = null
      }
    }
  }, [
    terminal,
    terminalReady,
    isConnected,
    sendInput,
    onCommand,
    closeCompletion,
    applyCompletionItem,
    // 移除 completionState 的单个字段依赖,使用 state setter 函数形式
    // 移除 handleCompletionRequest,使用 ref 替代
  ])

  // ==================== 容器尺寸变化时重新适配 ====================
  useEffect(() => {
    if (!terminal || !fitAddon || !containerRef.current || !terminalReady) return

    let resizeTimeout: NodeJS.Timeout | null = null
    let resizeObserver: ResizeObserver | null = null
    let removeWindowResize: (() => void) | null = null

    const applyFit = () => {
      if (!fitAddon || !terminal) return

      fitAddon.fit()
      const newCols = terminal.cols
      const newRows = terminal.rows

      // 通知 WebSocket 调整大小
      resize(newCols, newRows)

      if (onResize) {
        onResize(newCols, newRows)
      }
    }

    const scheduleFit = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = setTimeout(applyFit, 80)
    }

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleFit()
      })
      const containerElement = containerRef.current
      if (containerElement) {
        resizeObserver.observe(containerElement)
      }
    } else {
      const handleResize = () => scheduleFit()
      window.addEventListener("resize", handleResize)
      removeWindowResize = () => window.removeEventListener("resize", handleResize)
    }

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      removeWindowResize?.()
      removeWindowResize = null
    }
  }, [terminal, fitAddon, containerRef, terminalReady, resize, onResize])

  // ==================== 公开方法供父组件调用 ====================
  const writeToTerminal = useCallback((text: string) => {
    if (terminal) {
      terminal.writeln(text)
    }
  }, [terminal])

  const clearTerminal = useCallback(() => {
    if (terminal) {
      terminal.clear()
      writePrompt(terminal)
    }
  }, [terminal, writePrompt])

  const fitTerminal = useCallback(() => {
    if (fitAddon) {
      fitAddon.fit()
    }
  }, [fitAddon])

  // 暴露方法给父组件
  useEffect(() => {
    if (containerRef.current) {
      // @ts-expect-error - Extending DOM element with custom methods
      containerRef.current.writeToTerminal = writeToTerminal
      // @ts-expect-error - Extending DOM element with custom methods
      containerRef.current.clearTerminal = clearTerminal
      // @ts-expect-error - Extending DOM element with custom methods
      containerRef.current.fitTerminal = fitTerminal
    }
  }, [containerRef, writeToTerminal, clearTerminal, fitTerminal])

  // ==================== 动态处理选中复制功能 ====================
  const selectionFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!terminal || !terminalReady || !copyOnSelect) return

    const handleSelection = () => {
      if (selectionFrameRef.current !== null) return

      selectionFrameRef.current = requestAnimationFrame(() => {
        selectionFrameRef.current = null
        const selection = terminal.getSelection()
        if (selection && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(selection).catch(() => {
            // 静默处理剪贴板错误
          })
        }
      })
    }

    const disposable = terminal.onSelectionChange(handleSelection)
    return () => {
      disposable.dispose()
      if (selectionFrameRef.current !== null) {
        cancelAnimationFrame(selectionFrameRef.current)
        selectionFrameRef.current = null
      }
    }
  }, [copyOnSelect, terminalReady, terminal])

  // ==================== 动态处理右键粘贴功能 ====================
  useEffect(() => {
    if (!containerRef.current || !terminalReady || !rightClickPaste) return

    // 仅在 .xterm 节点绑定监听，避免影响右侧文件面板等悬浮内容
    const xtermRoot = containerRef.current.querySelector('.xterm') as HTMLElement | null
    if (!xtermRoot) return

    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault()
      if (!navigator.clipboard?.readText || !terminal) return
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          // 使用 xterm.js 的 paste() 方法，自动处理 bracketed paste mode
          terminal.paste(text)
        }
      } catch (err) {
        console.error('Failed to read from clipboard:', err)
      }
    }

    xtermRoot.addEventListener('contextmenu', handleContextMenu)
    return () => {
      xtermRoot.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [rightClickPaste, terminalReady, containerRef, terminal])

  // ==================== 动态处理快捷键功能 ====================
  type ParsedShortcut = {
    ctrl: boolean
    shift: boolean
    alt: boolean
    meta: boolean
    key: string
  }

  const shortcutsRef = useRef<{ copy: ParsedShortcut; paste: ParsedShortcut; clear: ParsedShortcut } | null>(null)

  const parseShortcut = useCallback((shortcut: string): ParsedShortcut => {
    const parts = shortcut.split('+').map((s) => s.trim().toLowerCase())
    return {
      ctrl: parts.includes('ctrl'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt'),
      meta: parts.includes('meta'),
      key: parts[parts.length - 1] || '',
    }
  }, [])

  useEffect(() => {
    shortcutsRef.current = {
      copy: parseShortcut(copyShortcut),
      paste: parseShortcut(pasteShortcut),
      clear: parseShortcut(clearShortcut),
    }
  }, [clearShortcut, copyShortcut, parseShortcut, pasteShortcut])

  const matchesShortcut = useCallback((e: KeyboardEvent, shortcut: ParsedShortcut) => {
    if (!shortcut.key) return false
    return (
      e.ctrlKey === shortcut.ctrl &&
      e.shiftKey === shortcut.shift &&
      e.altKey === shortcut.alt &&
      e.metaKey === shortcut.meta &&
      e.key.toLowerCase() === shortcut.key.toLowerCase()
    )
  }, [])

  const handleKeyEvent = useCallback((event: KeyboardEvent) => {
    const shortcuts = shortcutsRef.current
    const term = terminal

    if (!shortcuts || !term) {
      return true
    }

    // 快速路径: 如果没有修饰键,直接返回
    if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      return true
    }

    // 复制
    if (matchesShortcut(event, shortcuts.copy)) {
      event.preventDefault()
      const selection = term.getSelection()
      if (selection && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(selection).catch(() => {})
      }
      return false
    }

    // 粘贴
    if (matchesShortcut(event, shortcuts.paste)) {
      event.preventDefault()
      if (navigator.clipboard?.readText && terminal) {
        navigator.clipboard.readText().then((text) => {
          if (text) {
            // 使用 xterm.js 的 paste() 方法，自动处理 bracketed paste mode
            terminal.paste(text)
          }
        }).catch(() => {})
      }
      return false
    }

    // 清屏
    if (matchesShortcut(event, shortcuts.clear)) {
      event.preventDefault()
      term.clear()
      return false
    }

    return true
  }, [matchesShortcut, terminal, sendInput])

  useEffect(() => {
    if (!terminal || !terminalReady) return

    terminal.attachCustomKeyEventHandler(handleKeyEvent)

    return () => {
      terminal.attachCustomKeyEventHandler(() => true)
    }
  }, [handleKeyEvent, terminalReady, terminal])

  // ==================== 渲染 ====================
  // 如果不是客户端，显示加载状态
  if (!isClient) {
    return (
      <div className="h-full w-full bg-background flex items-center justify-center">
        <ConnectionLoader
          serverName={serverName}
          message={tTerminal("connectionLoaderInitializing")}
        />
      </div>
    )
  }

  // 获取当前终端主题用于背景色
  const currentTheme = getTerminalTheme(theme, effectiveAppTheme)

  // 计算背景样式
  const backgroundStyle: React.CSSProperties = {
    backgroundColor: currentTheme.background,
  }

  // 应用透明度
  if (opacity < 100) {
    const rgb = currentTheme.background || '#000000'
    const r = parseInt(rgb.slice(1, 3), 16)
    const g = parseInt(rgb.slice(3, 5), 16)
    const b = parseInt(rgb.slice(5, 7), 16)
    backgroundStyle.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
  }

  // 应用背景图片
  if (backgroundImage) {
    backgroundStyle.backgroundImage = `url(${backgroundImage})`
    backgroundStyle.backgroundSize = 'cover'
    backgroundStyle.backgroundPosition = 'center'
    backgroundStyle.backgroundRepeat = 'no-repeat'
    backgroundStyle.backgroundBlendMode = 'overlay'
    if (backgroundImageOpacity < 100) {
      backgroundStyle.opacity = backgroundImageOpacity / 100
    }
  }

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* 终端容器 */}
      <div
        ref={containerRef}
        className="h-full w-full terminal-container"
        style={backgroundStyle}
      />

      {/* 补全弹窗 */}
      {completionState.visible && terminal && terminal.options.theme && (
        <TerminalThemeProvider theme={terminal.options.theme}>
          <CompletionPopup
            items={completionState.items}
            selectedIndex={completionState.selectedIndex}
            position={completionState.position}
            matchedPrefix={completionState.matchedPrefix}
            onSelect={applyCompletionItem}
            onClose={closeCompletion}
            onPlacementChange={setCompletionPlacement}
          />
        </TerminalThemeProvider>
      )}

      <style jsx global>{`
        .terminal-container .xterm {
          padding: 16px;
        }
        .terminal-container .xterm-screen {
          border-radius: 0;
        }
        .terminal-container .xterm-viewport {
          scrollbar-width: thin;
          scrollbar-color: #3f3f46 transparent;
        }
        .terminal-container .xterm-viewport::-webkit-scrollbar {
          width: 10px;
        }
        .terminal-container .xterm-viewport::-webkit-scrollbar-track {
          background: transparent;
        }
        .terminal-container .xterm-viewport::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
          border-radius: 5px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .terminal-container .xterm-viewport::-webkit-scrollbar-thumb:hover {
          background-color: #52525b;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        /* 光标增强效果 */
        .terminal-container .xterm-cursor-layer .xterm-cursor {
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
        }
      `}</style>
    </div>
  )
}
