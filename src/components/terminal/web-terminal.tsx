"use client"

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react"
import { useTheme } from "next-themes"
import { ConnectionLoader } from "./connection-loader"
import { getTerminalTheme } from "./terminal-themes"
import type { Terminal } from "xterm"
import type { FitAddon } from "@xterm/addon-fit"

interface WebTerminalProps {
  sessionId: string
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
  const [currentLine, setCurrentLine] = useState("")
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isClient, setIsClient] = useState(false)

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
        // 开始进入动画
        if (isMounted) {
          onLoadingChange?.(true)
        }

        // 进入动画 800ms + 加载延迟 700ms
        await new Promise(resolve => setTimeout(resolve, 1500))

        const { Terminal: XTermTerminal } = await import("xterm")
        const { FitAddon: XTermFitAddon } = await import("@xterm/addon-fit")
        const { WebLinksAddon } = await import("@xterm/addon-web-links")

        // 动态导入样式
        // @ts-expect-error - CSS import
        await import("xterm/css/xterm.css")

        // 获取终端主题 - 使用应用主题
        const terminalTheme = getTerminalTheme(theme, effectiveAppTheme)

        // 创建终端实例 - 使用配置的主题
        terminal = new XTermTerminal({
          theme: {
            background: terminalTheme.background,
            foreground: terminalTheme.foreground,
            cursor: terminalTheme.cursor,
            cursorAccent: terminalTheme.cursorAccent,
            selectionBackground: terminalTheme.selectionBackground,
            black: terminalTheme.black,
            red: terminalTheme.red,
            green: terminalTheme.green,
            yellow: terminalTheme.yellow,
            blue: terminalTheme.blue,
            magenta: terminalTheme.magenta,
            cyan: terminalTheme.cyan,
            white: terminalTheme.white,
            brightBlack: terminalTheme.brightBlack,
            brightRed: terminalTheme.brightRed,
            brightGreen: terminalTheme.brightGreen,
            brightYellow: terminalTheme.brightYellow,
            brightBlue: terminalTheme.brightBlue,
            brightMagenta: terminalTheme.brightMagenta,
            brightCyan: terminalTheme.brightCyan,
            brightWhite: terminalTheme.brightWhite,
          },
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

        // 终端准备完成，隐藏加载动画
        if (isMounted) {
          onLoadingChange?.(false)
        }

        // 显示欢迎信息 - 现代化样式
        if (isConnected) {
          terminal.writeln(`\x1b[1;32m✓\x1b[0m \x1b[2mConnected to\x1b[0m \x1b[1m${serverName}\x1b[0m \x1b[2m(${host})\x1b[0m`)
          terminal.writeln(`\x1b[2m┌─ User:\x1b[0m \x1b[36m${username}\x1b[0m`)
          terminal.writeln(`\x1b[2m└─ Session:\x1b[0m \x1b[33m${sessionId}\x1b[0m`)
          terminal.writeln("")
          writePrompt(terminal)
        } else {
          terminal.writeln(`\x1b[1;31m✗\x1b[0m \x1b[2mConnection failed to\x1b[0m \x1b[1m${serverName}\x1b[0m \x1b[2m(${host})\x1b[0m`)
          terminal.writeln(`\x1b[2m└─\x1b[0m \x1b[33mPlease check server status or network connection\x1b[0m`)
        }

        // 处理用户输入
        terminal.onData((data: string) => {
          if (!terminal || !isConnected) return

          const char = data.charCodeAt(0)

          if (char === 13) { // Enter
            if (currentLine.trim()) {
              terminal!.writeln("")
              onCommand(currentLine.trim())

              // 模拟命令执行
              setTimeout(() => {
                // 这里应该显示真实的命令输出
                terminal!.writeln(`模拟输出: ${currentLine}`)
                terminal!.writeln(`时间: ${new Date().toLocaleTimeString()}`)
                writePrompt(terminal!)
              }, 100)
            } else {
              terminal!.writeln("")
              writePrompt(terminal!)
            }
            setCurrentLine("")
            setCursorPosition(0)
          } else if (char === 127) { // Backspace
            if (cursorPosition > 0) {
              const newLine = currentLine.slice(0, cursorPosition - 1) + currentLine.slice(cursorPosition)
              setCurrentLine(newLine)
              setCursorPosition(cursorPosition - 1)
              terminal!.write("\b \b")
            }
          } else if (char >= 32) { // 可打印字符
            const newLine = currentLine.slice(0, cursorPosition) + data + currentLine.slice(cursorPosition)
            setCurrentLine(newLine)
            setCursorPosition(cursorPosition + 1)
            terminal!.write(data)
          } else if (char === 27) { // ESC序列（方向键等）
            const sequence = data.slice(1)
            if (sequence === "[D" && cursorPosition > 0) { // 左箭头
              setCursorPosition(cursorPosition - 1)
              terminal!.write("\x1b[D")
            } else if (sequence === "[C" && cursorPosition < currentLine.length) { // 右箭头
              setCursorPosition(cursorPosition + 1)
              terminal!.write("\x1b[C")
            }
            // 可以添加更多方向键和快捷键处理
          }
        })

        // 窗口大小变化时重新适配
        const handleResize = () => {
          fitAddon!.fit()
          if (onResize && terminal) {
            onResize(terminal.cols, terminal.rows)
          }
        }

        window.addEventListener("resize", handleResize)

        return () => {
          window.removeEventListener("resize", handleResize)
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
