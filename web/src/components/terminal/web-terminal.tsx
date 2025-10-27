"use client"

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react"
import { useTheme } from "next-themes"
import { ConnectionLoader } from "./connection-loader"
import { getTerminalTheme } from "./terminal-themes"
import { TerminalWebSocket } from "@/lib/websocket-terminal"
import type { Terminal } from "xterm"
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
}: WebTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<TerminalWebSocket | null>(null)
  const [isClient, setIsClient] = useState(false)

  // 优化：批量写入缓冲区，减少重绘次数
  const writeBufferRef = useRef<string[]>([])
  const writeScheduledRef = useRef(false)

  // 批量写入函数 - 使用 requestAnimationFrame 合并多次写入
  const flushWriteBuffer = useCallback(() => {
    if (!terminalInstanceRef.current || writeBufferRef.current.length === 0) {
      writeScheduledRef.current = false
      return
    }

    // 合并所有待写入的数据
    const dataToWrite = writeBufferRef.current.join('')
    writeBufferRef.current = []
    writeScheduledRef.current = false

    // 一次性写入终端
    terminalInstanceRef.current.write(dataToWrite)
  }, [])

  // 调度写入操作
  const scheduleWrite = useCallback((data: string) => {
    writeBufferRef.current.push(data)

    if (!writeScheduledRef.current) {
      writeScheduledRef.current = true
      requestAnimationFrame(flushWriteBuffer)
    }
  }, [flushWriteBuffer])

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
          import("xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-web-links"),
          // @ts-expect-error - CSS import
          import("xterm/css/xterm.css"),
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

        // 如果有 serverId 且已连接，建立 WebSocket 连接
        if (serverId && isConnected) {
          try {
            const ws = new TerminalWebSocket({
              serverId,
              cols: terminal.cols,
              rows: terminal.rows,
              onData: (data) => {
                // 使用批量写入优化性能，减少重绘次数
                scheduleWrite(data)
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

        // 窗口大小变化时重新适配 - 使用防抖避免频繁触发
        let resizeTimeout: NodeJS.Timeout | null = null
        const handleResize = () => {
          if (resizeTimeout) {
            clearTimeout(resizeTimeout)
          }

          resizeTimeout = setTimeout(() => {
            if (!fitAddon || !terminal) return

            fitAddon.fit()
            const newCols = terminal.cols
            const newRows = terminal.rows

            // 通知 WebSocket 调整大小
            if (wsRef.current) {
              wsRef.current.resize(newCols, newRows)
            }

            // 通知父组件
            if (onResize) {
              onResize(newCols, newRows)
            }
          }, 100) // 100ms 防抖延迟
        }

        window.addEventListener("resize", handleResize)

        return () => {
          // 清理 resize timeout
          if (resizeTimeout) {
            clearTimeout(resizeTimeout)
          }
          window.removeEventListener("resize", handleResize)
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
      // 清理批量写入缓冲区
      writeBufferRef.current = []
      writeScheduledRef.current = false
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

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* 终端容器 */}
      <div
        ref={terminalRef}
        className="h-full w-full terminal-container"
        style={{
          backgroundColor: currentTheme.background,
        }}
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
