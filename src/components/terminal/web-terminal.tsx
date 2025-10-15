"use client"

import { useEffect, useRef, useState } from "react"

interface WebTerminalProps {
  sessionId: string
  serverName: string
  host: string
  username: string
  isConnected: boolean
  onCommand: (command: string) => void
  onResize?: (cols: number, rows: number) => void
}

export function WebTerminal({
  sessionId,
  serverName,
  host,
  username,
  isConnected,
  onCommand,
  onResize
}: WebTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const [currentLine, setCurrentLine] = useState("")
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isClient, setIsClient] = useState(false)

  // 确保只在客户端执行
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !terminalRef.current) return

    let terminal: any
    let fitAddon: any
    let webLinksAddon: any

    // 动态导入 xterm.js 及其插件
    const initTerminal = async () => {
      try {
        const { Terminal } = await import("xterm")
        const { FitAddon } = await import("@xterm/addon-fit")
        const { WebLinksAddon } = await import("@xterm/addon-web-links")

        // 动态导入样式
        await import("xterm/css/xterm.css")

        // 创建终端实例 - 现代化主题
        terminal = new Terminal({
          theme: {
            background: "#000000",
            foreground: "#d4d4d8", // zinc-300
            cursor: "#22c55e", // green-500
            cursorAccent: "#000000",
            selection: "#3f3f46", // zinc-700
            black: "#18181b", // zinc-900
            red: "#ef4444", // red-500
            green: "#22c55e", // green-500
            yellow: "#eab308", // yellow-500
            blue: "#3b82f6", // blue-500
            magenta: "#a855f7", // purple-500
            cyan: "#06b6d4", // cyan-500
            white: "#f4f4f5", // zinc-100
            brightBlack: "#52525b", // zinc-600
            brightRed: "#f87171", // red-400
            brightGreen: "#4ade80", // green-400
            brightYellow: "#facc15", // yellow-400
            brightBlue: "#60a5fa", // blue-400
            brightMagenta: "#c084fc", // purple-400
            brightCyan: "#22d3ee", // cyan-400
            brightWhite: "#fafafa", // zinc-50
          },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', Monaco, Menlo, 'Ubuntu Mono', monospace",
          fontWeight: "400",
          fontWeightBold: "600",
          cursorBlink: true,
          cursorStyle: "bar",
          cursorWidth: 2,
          scrollback: 5000,
          cols: 80,
          rows: 24,
          lineHeight: 1.2,
          letterSpacing: 0,
        })

        // 添加插件
        fitAddon = new FitAddon()
        webLinksAddon = new WebLinksAddon()

        terminal.loadAddon(fitAddon)
        terminal.loadAddon(webLinksAddon)

        // 打开终端
        terminal.open(terminalRef.current!)
        fitAddon.fit()

        // 存储引用
        terminalInstanceRef.current = terminal
        fitAddonRef.current = fitAddon

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
          if (!isConnected) return

          const char = data.charCodeAt(0)

          if (char === 13) { // Enter
            if (currentLine.trim()) {
              terminal.writeln("")
              onCommand(currentLine.trim())

              // 模拟命令执行
              setTimeout(() => {
                // 这里应该显示真实的命令输出
                terminal.writeln(`模拟输出: ${currentLine}`)
                terminal.writeln(`时间: ${new Date().toLocaleTimeString()}`)
                writePrompt(terminal)
              }, 100)
            } else {
              terminal.writeln("")
              writePrompt(terminal)
            }
            setCurrentLine("")
            setCursorPosition(0)
          } else if (char === 127) { // Backspace
            if (cursorPosition > 0) {
              const newLine = currentLine.slice(0, cursorPosition - 1) + currentLine.slice(cursorPosition)
              setCurrentLine(newLine)
              setCursorPosition(cursorPosition - 1)
              terminal.write("\b \b")
            }
          } else if (char >= 32) { // 可打印字符
            const newLine = currentLine.slice(0, cursorPosition) + data + currentLine.slice(cursorPosition)
            setCurrentLine(newLine)
            setCursorPosition(cursorPosition + 1)
            terminal.write(data)
          } else if (char === 27) { // ESC序列（方向键等）
            const sequence = data.slice(1)
            if (sequence === "[D" && cursorPosition > 0) { // 左箭头
              setCursorPosition(cursorPosition - 1)
              terminal.write("\x1b[D")
            } else if (sequence === "[C" && cursorPosition < currentLine.length) { // 右箭头
              setCursorPosition(cursorPosition + 1)
              terminal.write("\x1b[C")
            }
            // 可以添加更多方向键和快捷键处理
          }
        })

        // 窗口大小变化时重新适配
        const handleResize = () => {
          fitAddon.fit()
          if (onResize) {
            onResize(terminal.cols, terminal.rows)
          }
        }

        window.addEventListener("resize", handleResize)

        return () => {
          window.removeEventListener("resize", handleResize)
          terminal.dispose()
        }
      } catch (error) {
        console.error("Failed to initialize terminal:", error)
      }
    }

    initTerminal()

    return () => {
      if (terminal) {
        terminal.dispose()
      }
    }
  }, [sessionId, isConnected, isClient])

  // 写入命令提示符 - 现代化样式
  const writePrompt = (terminal: any) => {
    const hostShort = host.split('.')[0] || host
    terminal.write(`\x1b[1;32m${username}\x1b[0m\x1b[2m@\x1b[0m\x1b[1;36m${hostShort}\x1b[0m \x1b[1;34m~\x1b[0m\x1b[1;35m $\x1b[0m `)
  }

  // 公开方法供父组件调用
  const writeToTerminal = (text: string) => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.writeln(text)
    }
  }

  const clearTerminal = () => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear()
      writePrompt(terminalInstanceRef.current)
    }
  }

  const fitTerminal = () => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit()
    }
  }

  // 暴露方法给父组件
  useEffect(() => {
    if (terminalRef.current) {
      // @ts-ignore
      terminalRef.current.writeToTerminal = writeToTerminal
      // @ts-ignore
      terminalRef.current.clearTerminal = clearTerminal
      // @ts-ignore
      terminalRef.current.fitTerminal = fitTerminal
    }
  }, [])

  // 如果不是客户端，显示加载状态 - 现代化设计
  if (!isClient) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <div className="text-zinc-400 font-mono text-sm">
            Initializing terminal...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative overflow-hidden">
      <div
        ref={terminalRef}
        className="h-full w-full terminal-container"
        style={{
          backgroundColor: "#000000",
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