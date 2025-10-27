"use client"

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react"
import { useTheme } from "next-themes"
import { ConnectionLoader } from "./connection-loader"
import { getTerminalTheme } from "./terminal-themes"
import { TerminalWebSocket } from "@/lib/websocket-terminal"
import type { Terminal } from "@xterm/xterm"
import type { FitAddon } from "@xterm/addon-fit"

interface WebTerminalProps {
  sessionId: string
  serverId?: string  // 添加服务器 ID 用于 WebSocket 连接
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
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<TerminalWebSocket | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [terminalReady, setTerminalReady] = useState(false)

  // 使用 next-themes 获取应用主题
  const { theme: appTheme, resolvedTheme } = useTheme()

  // 获取实际的主题（light 或 dark），未解析时优先读取 html 上的类，避免黑屏闪烁
  const currentAppTheme = (resolvedTheme || appTheme) as 'light' | 'dark' | 'system'
  const initialIsDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const effectiveAppTheme: 'light' | 'dark' =
    currentAppTheme === 'system' || !currentAppTheme
      ? (initialIsDark ? 'dark' : 'light')
      : currentAppTheme

  // 确保只在客户端执行
  useEffect(() => {
    setIsClient(true)
  }, [])

  // 监听应用主题/终端主题变化；使用 layoutEffect 减少可见延迟
  useLayoutEffect(() => {
    if (!terminalInstanceRef.current) return

    // 根据当前终端主题选择（default/其他主题）与应用明暗态，动态更新 xterm 主题
    const terminalTheme = getTerminalTheme(theme, effectiveAppTheme)
    terminalInstanceRef.current.options.theme = terminalTheme
    // xterm 在更新 options.theme 时会自动重绘
  }, [theme, effectiveAppTheme])

  // 监听字体设置变化并实时更新
  useEffect(() => {
    if (!terminalInstanceRef.current || !terminalReady) return
    const terminal = terminalInstanceRef.current
    if (terminal.options.fontSize !== fontSize) {
      terminal.options.fontSize = fontSize
    }
  }, [fontSize, terminalReady])

  useEffect(() => {
    if (!terminalInstanceRef.current || !terminalReady) return
    const terminal = terminalInstanceRef.current
    const newFontFamily = `'${fontFamily}', 'Fira Code', Monaco, Menlo, 'Ubuntu Mono', monospace`
    if (terminal.options.fontFamily !== newFontFamily) {
      terminal.options.fontFamily = newFontFamily
    }
  }, [fontFamily, terminalReady])

  // 监听光标设置变化并实时更新
  useEffect(() => {
    if (!terminalInstanceRef.current || !terminalReady) return
    const terminal = terminalInstanceRef.current
    if (terminal.options.cursorStyle !== cursorStyle) {
      terminal.options.cursorStyle = cursorStyle
      terminal.options.cursorWidth = cursorStyle === 'bar' ? 2 : 1
    }
  }, [cursorStyle, terminalReady])

  useEffect(() => {
    if (!terminalInstanceRef.current || !terminalReady) return
    const terminal = terminalInstanceRef.current
    if (terminal.options.cursorBlink !== cursorBlink) {
      terminal.options.cursorBlink = cursorBlink
    }
  }, [cursorBlink, terminalReady])

  // 监听回滚缓冲行数变化并实时更新
  useEffect(() => {
    if (!terminalInstanceRef.current || !terminalReady) return
    const terminal = terminalInstanceRef.current
    if (terminal.options.scrollback !== scrollback) {
      terminal.options.scrollback = scrollback
    }
  }, [scrollback, terminalReady])

  // Write prompt function - defined early to be used in useEffect
  const writePrompt = useCallback((terminal: Terminal) => {
    const hostShort = host.split('.')[0] || host
    terminal.write(`\x1b[1;32m${username}\x1b[0m\x1b[2m@\x1b[0m\x1b[1;36m${hostShort}\x1b[0m \x1b[1;34m~\x1b[0m\x1b[1;35m $\x1b[0m `)
  }, [host, username])

  useEffect(() => {
    if (!isClient || !terminalRef.current) return

    let terminal: Terminal | undefined
    let fitAddon: FitAddon | undefined
    let isMounted = true

    // 动态导入 xterm.js 及其插件
    const initTerminal = async () => {
      try {
        // 通知开始加载（不阻塞）
        if (isMounted) {
          onLoadingChange?.(true)
        }

        // 并行加载所有依赖，不添加人为延迟
        const [
          { Terminal: XTermTerminal },
          { FitAddon: XTermFitAddon },
          { WebLinksAddon },
        ] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-web-links"),
          // @ts-expect-error - CSS import
          import("@xterm/xterm/css/xterm.css"),
        ])

        // 获取终端主题 - 使用应用主题
        const terminalTheme = getTerminalTheme(theme, effectiveAppTheme)

        // 创建终端实例 - 使用配置的主题
        terminal = new XTermTerminal({
          theme: terminalTheme,
          fontSize: fontSize,
          fontFamily: `'${fontFamily}', 'Fira Code', Monaco, Menlo, 'Ubuntu Mono', monospace`,
          fontWeight: "400",
          fontWeightBold: "600",
          cursorBlink: cursorBlink,
          cursorStyle: cursorStyle,
          cursorWidth: cursorStyle === 'bar' ? 2 : 1,
          scrollback: scrollback,
          cols: 80,
          rows: 24,
          lineHeight: 1.2,
          letterSpacing: 0,
          // 性能优化选项
          allowProposedApi: true,
          allowTransparency: false,
          disableStdin: false,
          fastScrollModifier: 'shift',
          fastScrollSensitivity: 5,
          scrollSensitivity: 3,
          windowOptions: {},
        })

        // 添加插件
        fitAddon = new XTermFitAddon()
        const webLinksAddon = new WebLinksAddon()

        terminal.loadAddon(fitAddon)
        terminal.loadAddon(webLinksAddon)

        // 打开终端
        terminal.open(terminalRef.current!)
        fitAddon.fit()

        // 存储引用
        terminalInstanceRef.current = terminal
        fitAddonRef.current = fitAddon

        // 标记终端已准备就绪
        setTerminalReady(true)

        // 尝试加载 WebGL 渲染器以获得最佳性能 (GPU 加速)
        // 使用 requestAnimationFrame 确保 DOM 完全渲染后再加载
        requestAnimationFrame(async () => {
          if (!terminal || !isMounted) return

          try {
            const { WebglAddon } = await import("@xterm/addon-webgl")
            const webglAddon = new WebglAddon()

            // 监听 WebGL 上下文丢失,自动清理
            webglAddon.onContextLoss(() => {
              webglAddon.dispose()
            })

            terminal.loadAddon(webglAddon)
            // WebGL 渲染器已启用,使用 GPU 加速
          } catch (error) {
            // WebGL 不可用时自动降级到 Canvas 渲染器,性能仍然很好
          }
        })

        // 如果有 serverId 且已连接，建立 WebSocket 连接
        if (serverId && isConnected) {
          try {
            const ws = new TerminalWebSocket({
              serverId,
              cols: terminal.cols,
              rows: terminal.rows,
              onData: (data) => {
                // 直接使用 XTerm.js 的 write 方法
                // XTerm.js 内置高效的缓冲机制,无需额外批量处理
                if (terminal) {
                  terminal.write(data)
                }
              },
              onConnected: () => {
                if (isMounted) {
                  onLoadingChange?.(false)
                }
                // 显示欢迎信息
                if (terminal) {
                  terminal.writeln(`\x1b[1;32m✓\x1b[0m \x1b[2mConnected to\x1b[0m \x1b[1m${serverName}\x1b[0m \x1b[2m(${host})\x1b[0m`)
                  terminal.writeln(`\x1b[2m┌─ User:\x1b[0m \x1b[36m${username}\x1b[0m`)
                  terminal.writeln(`\x1b[2m└─ Session:\x1b[0m \x1b[33m${sessionId}\x1b[0m`)
                  terminal.writeln("")
                }
              },
              onDisconnected: () => {
                if (terminal) {
                  terminal.writeln("\r\n\x1b[1;31m✗ Connection closed\x1b[0m")
                }
              },
              onError: (error) => {
                console.error("[WebTerminal] WebSocket 错误:", error)
                if (terminal) {
                  terminal.writeln(`\r\n\x1b[1;31m✗ Error: ${error.message}\x1b[0m`)
                }
              }
            })

            ws.connect()
            wsRef.current = ws
          } catch (error) {
            console.error("[WebTerminal] 创建 WebSocket 失败:", error)
          }
        } else {
          // 没有 serverId，显示离线状态
          if (isMounted) {
            onLoadingChange?.(false)
          }
          if (!isConnected) {
            terminal.writeln(`\x1b[1;31m✗\x1b[0m \x1b[2mConnection failed to\x1b[0m \x1b[1m${serverName}\x1b[0m \x1b[2m(${host})\x1b[0m`)
            terminal.writeln(`\x1b[2m└─\x1b[0m \x1b[33mPlease check server status or network connection\x1b[0m`)
          }
        }

        // 处理用户输入 - 直接发送到 WebSocket
        terminal.onData((data: string) => {
          if (!isConnected || !wsRef.current) return

          // 发送用户输入到 WebSocket
          wsRef.current.sendInput(data)

          // 通知父组件（用于日志记录等）
          onCommand(data)
        })

        // 容器尺寸变化时重新适配 - 使用 ResizeObserver 避免全局重绘
        let resizeTimeout: NodeJS.Timeout | null = null
        let resizeObserver: ResizeObserver | null = null
        let removeWindowResize: (() => void) | null = null

        const applyFit = () => {
          if (!fitAddon || !terminal) return

          fitAddon.fit()
          const newCols = terminal.cols
          const newRows = terminal.rows

          if (wsRef.current) {
            wsRef.current.resize(newCols, newRows)
          }

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
          const containerElement = terminalRef.current
          if (containerElement) {
            resizeObserver.observe(containerElement)
          }
        } else {
          const handleResize = () => scheduleFit()
          window.addEventListener("resize", handleResize)
          removeWindowResize = () => window.removeEventListener("resize", handleResize)
        }

        return () => {
          // 清理 resize timeout
          if (resizeTimeout) {
            clearTimeout(resizeTimeout)
          }
          resizeObserver?.disconnect()
          resizeObserver = null
          removeWindowResize?.()
          removeWindowResize = null
          // 断开 WebSocket
          if (wsRef.current) {
            wsRef.current.disconnect()
            wsRef.current = null
          }
          terminal!.dispose()
        }
      } catch (error) {
        console.error("Failed to initialize terminal:", error)
        if (isMounted) {
          onLoadingChange?.(false)
        }
      }
    }

    initTerminal()

    return () => {
      isMounted = false
      setTerminalReady(false)
      if (terminal) {
        terminal.dispose()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isConnected, isClient])

  // 公开方法供父组件调用
  const writeToTerminal = useCallback((text: string) => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.writeln(text)
    }
  }, [])

  const clearTerminal = useCallback(() => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear()
      writePrompt(terminalInstanceRef.current)
    }
  }, [writePrompt])

  const fitTerminal = useCallback(() => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit()
    }
  }, [])

  // 暴露方法给父组件
  useEffect(() => {
    if (terminalRef.current) {
      // @ts-expect-error - Extending DOM element with custom methods
      terminalRef.current.writeToTerminal = writeToTerminal
      // @ts-expect-error - Extending DOM element with custom methods
      terminalRef.current.clearTerminal = clearTerminal
      // @ts-expect-error - Extending DOM element with custom methods
      terminalRef.current.fitTerminal = fitTerminal
    }
  }, [writeToTerminal, clearTerminal, fitTerminal])

  // 动态处理选中复制功能
  const selectionFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!terminalInstanceRef.current || !terminalReady || !copyOnSelect) return

    const terminal = terminalInstanceRef.current
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
  }, [copyOnSelect, terminalReady])

  // 动态处理右键粘贴功能
  useEffect(() => {
    if (!terminalRef.current || !terminalReady || !rightClickPaste) return

    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault()
      if (!navigator.clipboard?.readText) return
      try {
        const text = await navigator.clipboard.readText()
        if (text && wsRef.current) {
          wsRef.current.sendInput(text)
        }
      } catch (err) {
        console.error('Failed to read from clipboard:', err)
      }
    }

    const terminalEl = terminalRef.current
    terminalEl.addEventListener('contextmenu', handleContextMenu)
    return () => {
      terminalEl.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [rightClickPaste, terminalReady])

  // 动态处理快捷键功能
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
    const terminal = terminalInstanceRef.current

    if (!shortcuts || !terminal) {
      return true
    }

    // 快速路径: 如果没有修饰键,直接返回 (优化 99% 的按键)
    // 这将按键处理时间从 ~10ms 降低到 < 1ms
    if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      return true
    }

    // 只有在有修饰键时才检查快捷键
    if (matchesShortcut(event, shortcuts.copy)) {
      event.preventDefault()
      const selection = terminal.getSelection()
      if (selection && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(selection).catch(() => {
          // 静默处理错误
        })
      }
      return false
    }

    if (matchesShortcut(event, shortcuts.paste)) {
      event.preventDefault()
      if (navigator.clipboard?.readText) {
        navigator.clipboard.readText().then((text) => {
          if (text && wsRef.current) {
            wsRef.current.sendInput(text)
          }
        }).catch(() => {
          // 静默处理错误
        })
      }
      return false
    }

    if (matchesShortcut(event, shortcuts.clear)) {
      event.preventDefault()
      terminal.clear()
      return false
    }

    return true
  }, [matchesShortcut])

  useEffect(() => {
    if (!terminalInstanceRef.current || !terminalReady) return

    const terminal = terminalInstanceRef.current
    terminal.attachCustomKeyEventHandler(handleKeyEvent)

    return () => {
      terminal.attachCustomKeyEventHandler(() => true)
    }
  }, [handleKeyEvent, terminalReady])

  // 如果不是客户端，显示加载状态 - 使用主题变量背景避免闪烁
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
    // 将 hex 转换为 rgba
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
        ref={terminalRef}
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
