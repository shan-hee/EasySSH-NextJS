"use client"

import { useEffect, useLayoutEffect } from "react"
import type { Terminal } from "@xterm/xterm"
import {
  getTerminalTheme,
  withTerminalBackgroundOpacity,
  type TerminalTheme,
} from "./terminal-themes"

export type TerminalThemeName = "default" | "dark" | "light" | "solarized" | "dracula"
export type TerminalCursorStyle = "block" | "underline" | "bar"
export type TerminalAppThemeMode = "light" | "dark"

export interface TerminalRendererThemeResult {
  terminalTheme: TerminalTheme
  terminalRendererTheme: TerminalTheme
}

export interface ResolveTerminalRendererThemeOptions {
  theme: TerminalThemeName
  appTheme: TerminalAppThemeMode
  transparentBackground: boolean
  backgroundOpacity: number
}

export interface UseTerminalRendererSettingsOptions {
  terminal: Terminal | null | undefined
  terminalReady: boolean
  terminalRendererTheme: TerminalTheme
  themeModeVersion: number
  fontSize: number
  fontFamily: string
  cursorStyle: TerminalCursorStyle
  cursorBlink: boolean
  scrollback: number
}

export function formatTerminalFontFamily(fontFamily: string) {
  return `'${fontFamily}', 'Fira Code', Monaco, Menlo, 'Ubuntu Mono', monospace`
}

export function resolveTerminalRendererTheme({
  theme,
  appTheme,
  transparentBackground,
  backgroundOpacity,
}: ResolveTerminalRendererThemeOptions): TerminalRendererThemeResult {
  const terminalTheme = getTerminalTheme(theme, appTheme)
  const shouldUseTransparentRendererBackground =
    transparentBackground || (theme === "default" && backgroundOpacity < 1)
  const transparentTerminalBackground = withTerminalBackgroundOpacity(terminalTheme.background, 0)
  const translucentTerminalBackground = withTerminalBackgroundOpacity(terminalTheme.background, backgroundOpacity)
  const terminalRendererBackground = shouldUseTransparentRendererBackground
    ? transparentTerminalBackground
    : backgroundOpacity < 1
      ? translucentTerminalBackground
      : terminalTheme.background

  return {
    terminalTheme,
    terminalRendererTheme: {
      ...terminalTheme,
      background: terminalRendererBackground,
    },
  }
}

export function useTerminalRendererSettings({
  terminal,
  terminalReady,
  terminalRendererTheme,
  themeModeVersion,
  fontSize,
  fontFamily,
  cursorStyle,
  cursorBlink,
  scrollback,
}: UseTerminalRendererSettingsOptions) {
  useLayoutEffect(() => {
    if (!terminal) return

    terminal.options.allowTransparency = true
    terminal.options.theme = terminalRendererTheme

    requestAnimationFrame(() => {
      terminal.refresh(0, terminal.rows - 1)
    })
  }, [terminal, terminalRendererTheme, themeModeVersion])

  useLayoutEffect(() => {
    if (!terminal || !terminalReady) return

    let shouldRefresh = false

    if (terminal.options.fontSize !== fontSize) {
      terminal.options.fontSize = fontSize
      shouldRefresh = true
    }

    if (terminal.options.fontFamily !== fontFamily) {
      terminal.options.fontFamily = fontFamily
      shouldRefresh = true
    }

    if (terminal.options.cursorStyle !== cursorStyle) {
      terminal.options.cursorStyle = cursorStyle
      terminal.options.cursorWidth = cursorStyle === "bar" ? 2 : 1
      shouldRefresh = true
    }

    if (terminal.options.cursorBlink !== cursorBlink) {
      terminal.options.cursorBlink = cursorBlink
      shouldRefresh = true
    }

    if (terminal.options.scrollback !== scrollback) {
      terminal.options.scrollback = scrollback
      shouldRefresh = true
    }

    if (shouldRefresh) {
      requestAnimationFrame(() => {
        terminal.refresh(0, terminal.rows - 1)
      })
    }
  }, [cursorBlink, cursorStyle, fontFamily, fontSize, scrollback, terminal, terminalReady])

  useEffect(() => {
    if (!terminal || !terminalReady) return

    if (terminal.options.scrollSensitivity !== 1) {
      terminal.options.scrollSensitivity = 1
    }
    if (terminal.options.fastScrollSensitivity !== 2) {
      terminal.options.fastScrollSensitivity = 2
    }
    if (terminal.options.fastScrollModifier !== "shift") {
      terminal.options.fastScrollModifier = "shift"
    }
  }, [terminalReady, terminal])
}
