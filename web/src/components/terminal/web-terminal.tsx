"use client"

import { useEffect, useRef, useCallback, useLayoutEffect } from "react"
import { useTheme } from "next-themes"
import { ConnectionLoader } from "./connection-loader"
import { getTerminalTheme } from "./terminal-themes"
import type { Terminal } from "@xterm/xterm"
import { useTerminalInstance } from "@/hooks/useTerminalInstance"
import { useWebSocketConnection } from "@/hooks/useWebSocketConnection"

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
}: WebTerminalProps) {
  // 使用 next-themes 获取应用主题
  const { theme: appTheme, resolvedTheme } = useTheme()

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
  // 调试日志：查看传递给 useWebSocketConnection 的参数
  console.log('[WebTerminal] useWebSocketConnection 参数:', {
    sessionId,
    serverId,
    serverName,
    host,
    username,
    isConnected,
    hasTerminal: !!terminal,
    terminalCols: terminal?.cols,
    terminalRows: terminal?.rows,
  })

  const { sendInput, resize } = useWebSocketConnection({
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
  })

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

      // 发送用户输入到 WebSocket
      sendInput(data)

      // 通知父组件（用于日志记录等）
      onCommand(data)
    })

    return () => {
      disposable.dispose()
    }
  }, [terminal, terminalReady, isConnected, sendInput, onCommand])

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

    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault()
      if (!navigator.clipboard?.readText) return
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          sendInput(text)
        }
      } catch (err) {
        console.error('Failed to read from clipboard:', err)
      }
    }

    const terminalEl = containerRef.current
    terminalEl.addEventListener('contextmenu', handleContextMenu)
    return () => {
      terminalEl.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [rightClickPaste, terminalReady, containerRef, sendInput])

  // ==================== 动态处理快捷键功能 ====================
  type ParsedShortcut = {
    ctrl: boolean
    shift: boolean
    alt: boolean
    meta: boolean
    key: string
  }

  const shortcutsRef = useRef<{ copy: ParsedShortcut; paste: ParsedShortcut; clear: ParsedShortcut }>()

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
      if (navigator.clipboard?.readText) {
        navigator.clipboard.readText().then((text) => {
          if (text) {
            sendInput(text)
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
        <ConnectionLoader serverName={serverName} message="正在初始化" />
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
