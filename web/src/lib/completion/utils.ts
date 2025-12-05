/**
 * 终端补全工具函数
 */

import type { Terminal } from "@xterm/xterm"
import type { CompletionContext } from "./types"

/**
 * 从终端获取当前输入行
 * @param terminal xterm.js 终端实例
 * @returns 当前行的文本内容
 */
export function getCurrentLine(terminal: Terminal): string {
  const buffer = terminal.buffer.active
  const cursorY = buffer.cursorY + buffer.baseY
  const line = buffer.getLine(cursorY)

  if (!line) return ""

  // 转换为字符串,去除 ANSI 转义序列
  const text = line.translateToString(true)

  return text
}

/**
 * 从当前行提取命令输入(去除 prompt)
 * @param line 完整行文本
 * @returns 去除 prompt 后的命令
 */
export function extractCommand(line: string): string {
  // 常见 prompt 模式:
  // user@host:~$ command
  // user@host:~/path$ command
  // [user@host ~]$ command
  // > command
  // $ command
  // # command

  // 匹配最后一个 $, #, > 符号后的内容
  const promptPatterns = [
    /^.*?[$#>]\s*(.*)$/, // 标准 prompt
    /^\[.*?\]\s*[$#>]\s*(.*)$/, // 带方括号的 prompt
    /^.*?:\s*(.*)$/, // 简单冒号 prompt
  ]

  for (const pattern of promptPatterns) {
    const match = line.match(pattern)
    if (match && match[1] !== undefined) {
      return match[1]
    }
  }

  // 如果没有匹配到 prompt,返回整行
  return line.trim()
}

/**
 * 解析命令为补全上下文
 * @param terminal xterm.js 终端实例
 * @returns 补全上下文
 */
export function parseCompletionContext(terminal: Terminal): CompletionContext {
  const buffer = terminal.buffer.active
  const fullLine = getCurrentLine(terminal)
  const command = extractCommand(fullLine)

  // 获取光标在命令中的位置
  const cursorX = buffer.cursorX
  const promptLength = fullLine.length - command.length
  const cursorPosition = Math.max(0, cursorX - promptLength)

  // 分词(简单按空格分割)
  const tokens = command.split(/\s+/).filter((t) => t.length > 0)

  // 找到光标所在的词
  let currentTokenIndex = 0
  let charCount = 0

  for (let i = 0; i < tokens.length; i++) {
    const tokenStart = charCount
    const tokenEnd = charCount + tokens[i].length

    if (cursorPosition >= tokenStart && cursorPosition <= tokenEnd) {
      currentTokenIndex = i
      break
    }

    // +1 for space
    charCount = tokenEnd + 1
  }

  // 获取当前词
  const currentWord = tokens[currentTokenIndex] || ""

  return {
    fullLine: command,
    cursorPosition,
    currentWord,
    tokens,
    currentTokenIndex,
  }
}

/**
 * 计算光标在屏幕上的位置(用于定位补全弹窗)
 * @param terminal xterm.js 终端实例
 * @returns 光标的屏幕坐标和当前行区域
 */
export function getCursorScreenPosition(terminal: Terminal): {
  x: number
  y: number
  lineTop: number
  lineBottom: number
} {
  const buffer = terminal.buffer.active
  const cursorX = buffer.cursorX
  const cursorY = buffer.cursorY
  const padding = 16 // 终端内边距

  // 方案1: 尝试使用内部API获取精确尺寸
  const dimensions = (terminal as any)._core?._renderService?.dimensions
  if (dimensions?.css?.cell) {
    const lineHeight = dimensions.css.cell.height
    const lineTop = padding + cursorY * lineHeight
    const lineBottom = lineTop + lineHeight
    return {
      x: padding + cursorX * dimensions.css.cell.width,
      y: padding + (cursorY + 1) * lineHeight, // +1 显示在光标下方
      lineTop,
      lineBottom,
    }
  }

  // 方案2: 尝试通过DOM测量获取字符尺寸
  const xtermScreen = document.querySelector(".xterm-screen")
  if (xtermScreen && terminal.cols > 0 && terminal.rows > 0) {
    const rect = xtermScreen.getBoundingClientRect()
    // 减去padding计算实际渲染区域
    const renderWidth = rect.width - padding * 2
    const renderHeight = rect.height - padding * 2

    if (renderWidth > 0 && renderHeight > 0) {
      const charWidth = renderWidth / terminal.cols
      const lineHeight = renderHeight / terminal.rows
      const lineTop = padding + cursorY * lineHeight
      const lineBottom = lineTop + lineHeight

      return {
        x: padding + cursorX * charWidth,
        y: padding + (cursorY + 1) * lineHeight,
        lineTop,
        lineBottom,
      }
    }
  }

  // 方案3: 最终降级 - 使用经验值
  // 基于常见终端字体大小(14px)的估算
  const charWidth = 8.4 // 14px字体的平均字符宽度
  const lineHeight = 20 // 14px字体的行高
  const lineTop = padding + cursorY * lineHeight
  const lineBottom = lineTop + lineHeight

  return {
    x: padding + cursorX * charWidth,
    y: padding + (cursorY + 1) * lineHeight,
    lineTop,
    lineBottom,
  }
}

/**
 * 应用补全到终端
 * @param terminal xterm.js 终端实例
 * @param completion 补全文本
 * @param deleteCount 需要删除的字符数
 * @param sendInput 发送真实输入的函数（通过 WebSocket）
 */
export function applyCompletion(
  terminal: Terminal,
  completion: string,
  deleteCount: number,
  sendInput: (data: string) => void
): void {
  // 合并删除和补全为一次操作，避免竞态条件和视觉闪烁
  let combinedInput = ""

  // 添加删除字符（如果需要）
  if (deleteCount > 0) {
    // 使用 \x7f (DEL/Backspace) 发送真实的删除操作
    // 这会同时更新显示和输入缓冲区
    combinedInput += "\x7f".repeat(deleteCount)
  }

  // 添加补全文本
  // 这确保补全的内容进入输入缓冲区，可以被正常删除
  combinedInput += completion

  // 一次性发送合并后的输入，消除两次发送导致的延迟和闪烁
  if (combinedInput) {
    sendInput(combinedInput)
  }
}

/**
 * 去除 ANSI 转义序列
 * @param text 包含 ANSI 转义序列的文本
 * @returns 纯文本
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
}

/**
 * 计算两个字符串的公共前缀
 * @param strings 字符串数组
 * @returns 公共前缀
 */
export function getCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return ""
  if (strings.length === 1) return strings[0]

  let prefix = strings[0]

  for (let i = 1; i < strings.length; i++) {
    while (strings[i].indexOf(prefix) !== 0) {
      prefix = prefix.substring(0, prefix.length - 1)
      if (prefix === "") return ""
    }
  }

  return prefix
}

/**
 * 检查是否是 Tab 键
 * @param data 终端输入数据
 * @returns 是否是 Tab 键
 */
export function isTabKey(data: string): boolean {
  return data === "\t"
}

/**
 * 检查是否是 Escape 键
 * @param data 终端输入数据
 * @returns 是否是 Escape 键
 */
export function isEscapeKey(data: string): boolean {
  return data === "\x1b"
}

/**
 * 检查是否是上箭头键
 * @param data 终端输入数据
 * @returns 是否是上箭头键
 */
export function isUpArrow(data: string): boolean {
  return data === "\x1b[A"
}

/**
 * 检查是否是下箭头键
 * @param data 终端输入数据
 * @returns 是否是下箭头键
 */
export function isDownArrow(data: string): boolean {
  return data === "\x1b[B"
}

/**
 * 检查是否是回车键
 * @param data 终端输入数据
 * @returns 是否是回车键
 */
export function isEnterKey(data: string): boolean {
  return data === "\r" || data === "\n"
}

/**
 * 命令匹配辅助:
 * - 优先按整行前缀前缀匹配: command.startsWith(linePrefix)
 * - 如果整行不匹配, 按“按空格分词 + 最后一个词前缀匹配”的方式匹配:
 *   例如: linePrefix = "docker sy", command = "docker system prune -af"
 *   => tokensPrefix = ["docker", "sy"], tokensCmd = ["docker", "system", "prune", "-af"]
 *   => 前面的 token 要完全相等, 最后一个 token 允许前缀匹配
 */
export function matchesCommandWithPrefix(
  command: string,
  linePrefix: string,
  currentWord: string
): boolean {
  const cleanedLinePrefix = linePrefix.trim()
  const effectivePrefix =
    cleanedLinePrefix || (currentWord ? currentWord.trim() : "")

  if (!effectivePrefix) return false

  const cmdLower = command.toLowerCase()
  const linePrefixLower = cleanedLinePrefix.toLowerCase()
  const currentWordLower = currentWord.toLowerCase()

  // 1. 整行前缀匹配
  if (cleanedLinePrefix && cmdLower.startsWith(linePrefixLower)) {
    return true
  }

  // 2. 按 token 匹配:
  //    - 前面的 token 必须完全相等
  //    - 最后一个 token 允许前缀匹配 (用户正在输入的那个词)
  const prefixTokens = (cleanedLinePrefix || currentWordLower)
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase())

  const cmdTokens = command
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase())

  if (prefixTokens.length === 0 || cmdTokens.length === 0) {
    return false
  }

  for (let i = 0; i < prefixTokens.length; i++) {
    const p = prefixTokens[i]
    const c = cmdTokens[i]
    if (!c) return false

    const isLast = i === prefixTokens.length - 1

    if (isLast) {
      // 最后一个词允许前缀匹配
      if (!c.startsWith(p)) return false
    } else {
      // 之前的词必须完全匹配
      if (c !== p) return false
    }
  }

  return true
}
