"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { ITheme } from "@xterm/xterm"

/**
 * 终端主题 Context
 * 用于在终端组件树中共享 xterm.js 主题令牌
 */
const TerminalThemeContext = createContext<ITheme | null>(null)

interface TerminalThemeProviderProps {
  theme: ITheme
  children: ReactNode
}

/**
 * 终端主题提供者
 * 将终端主题令牌注入到组件树中
 */
export function TerminalThemeProvider({
  theme,
  children,
}: TerminalThemeProviderProps) {
  return (
    <TerminalThemeContext.Provider value={theme}>
      {children}
    </TerminalThemeContext.Provider>
  )
}

/**
 * 使用终端主题的 Hook
 * @returns 终端主题对象，包含所有颜色令牌
 * @throws 如果在 TerminalThemeProvider 外部使用会抛出错误
 */
export function useTerminalTheme(): ITheme {
  const theme = useContext(TerminalThemeContext)

  if (!theme) {
    throw new Error(
      "useTerminalTheme must be used within a TerminalThemeProvider"
    )
  }

  return theme
}

/**
 * 可选的终端主题 Hook（不抛出错误）
 * @returns 终端主题对象或 null
 */
export function useTerminalThemeOptional(): ITheme | null {
  return useContext(TerminalThemeContext)
}
