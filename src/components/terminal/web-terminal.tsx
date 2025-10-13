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

        // 创建终端实例
        terminal = new Terminal({
          theme: {
            background: "#000000",
            foreground: "#00ff00",
            cursor: "#ffffff",
            selection: "#ffffff40",
          },
          fontSize: 14,
          fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
          cursorBlink: true,
          cursorStyle: "block",
          scrollback: 1000,
          cols: 80,
          rows: 24,
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

        // 显示欢迎信息
        if (isConnected) {
          terminal.writeln(`\x1b[32m✓ 连接到 ${serverName} (${host})\x1b[0m`)
          terminal.writeln(`\x1b[36m用户: ${username}\x1b[0m`)
          terminal.writeln(`\x1b[33m会话ID: ${sessionId}\x1b[0m`)
          terminal.writeln("")
          writePrompt(terminal)
        } else {
          terminal.writeln(`\x1b[31m✗ 无法连接到 ${serverName} (${host})\x1b[0m`)
          terminal.writeln(`\x1b[33m请检查服务器状态或网络连接\x1b[0m`)
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

  // 写入命令提示符
  const writePrompt = (terminal: any) => {
    terminal.write(`\x1b[32m${username}@${host.split('.').pop()}\x1b[0m:\x1b[34m~\x1b[0m$ `)
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

  // 如果不是客户端，显示加载状态
  if (!isClient) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className="text-green-400 font-mono">
          正在初始化终端...
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <div
        ref={terminalRef}
        className="h-full w-full terminal-container"
        style={{
          backgroundColor: "#000000",
        }}
      />
      <style jsx global>{`
        .terminal-container .xterm {
          padding: 10px;
        }
        .terminal-container .xterm-screen {
          border-radius: 4px;
        }
        .terminal-container .xterm-viewport {
          scrollbar-width: thin;
          scrollbar-color: #444 transparent;
        }
        .terminal-container .xterm-viewport::-webkit-scrollbar {
          width: 8px;
        }
        .terminal-container .xterm-viewport::-webkit-scrollbar-track {
          background: transparent;
        }
        .terminal-container .xterm-viewport::-webkit-scrollbar-thumb {
          background-color: #444;
          border-radius: 4px;
        }
        .terminal-container .xterm-viewport::-webkit-scrollbar-thumb:hover {
          background-color: #555;
        }
      `}</style>
    </div>
  )
}