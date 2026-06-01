"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"
import type { Terminal } from "@xterm/xterm"

type ParsedShortcut = {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

export interface UseTerminalInputActionsOptions {
  terminal: Terminal | null | undefined
  terminalReady: boolean
  containerRef: RefObject<HTMLDivElement | null>
  copyOnSelect?: boolean
  rightClickPaste?: boolean
  copyShortcut?: string
  pasteShortcut?: string
  clearShortcut?: string
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+").map((s) => s.trim().toLowerCase())
  return {
    ctrl: parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    meta: parts.includes("meta"),
    key: parts[parts.length - 1] || "",
  }
}

function matchesShortcut(event: KeyboardEvent, shortcut: ParsedShortcut) {
  if (!shortcut.key) return false

  return (
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt &&
    event.metaKey === shortcut.meta &&
    event.key.toLowerCase() === shortcut.key.toLowerCase()
  )
}

export function useTerminalInputActions({
  terminal,
  terminalReady,
  containerRef,
  copyOnSelect = true,
  rightClickPaste = true,
  copyShortcut = "Ctrl+Shift+C",
  pasteShortcut = "Ctrl+Shift+V",
  clearShortcut = "Ctrl+L",
}: UseTerminalInputActionsOptions) {
  const selectionFrameRef = useRef<number | null>(null)
  const shortcutsRef = useRef<{
    copy: ParsedShortcut
    paste: ParsedShortcut
    clear: ParsedShortcut
  } | null>(null)

  useEffect(() => {
    shortcutsRef.current = {
      copy: parseShortcut(copyShortcut),
      paste: parseShortcut(pasteShortcut),
      clear: parseShortcut(clearShortcut),
    }
  }, [clearShortcut, copyShortcut, pasteShortcut])

  useEffect(() => {
    if (!terminal || !terminalReady || !copyOnSelect) return

    const handleSelection = () => {
      if (selectionFrameRef.current !== null) return

      selectionFrameRef.current = requestAnimationFrame(() => {
        selectionFrameRef.current = null
        const selection = terminal.getSelection()

        if (selection && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(selection).catch(() => {
            // Ignore clipboard permission errors; selection should still behave normally.
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

  useEffect(() => {
    if (!containerRef.current || !terminalReady || !rightClickPaste) return

    const xtermRoot = containerRef.current.querySelector(".xterm") as HTMLElement | null
    if (!xtermRoot) return

    const handleContextMenu = async (event: MouseEvent) => {
      event.preventDefault()

      if (!navigator.clipboard?.readText || !terminal) return

      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          terminal.paste(text)
        }
      } catch (error) {
        console.error("Failed to read from clipboard:", error)
      }
    }

    xtermRoot.addEventListener("contextmenu", handleContextMenu)

    return () => {
      xtermRoot.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [rightClickPaste, terminalReady, containerRef, terminal])

  const handleKeyEvent = useCallback((event: KeyboardEvent) => {
    const shortcuts = shortcutsRef.current
    const term = terminal

    if (!shortcuts || !term) {
      return true
    }

    if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      return true
    }

    if (matchesShortcut(event, shortcuts.copy)) {
      event.preventDefault()
      const selection = term.getSelection()
      if (selection && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(selection).catch(() => {})
      }
      return false
    }

    if (matchesShortcut(event, shortcuts.paste)) {
      event.preventDefault()
      if (navigator.clipboard?.readText) {
        navigator.clipboard.readText().then((text) => {
          if (text) {
            term.paste(text)
          }
        }).catch(() => {})
      }
      return false
    }

    if (matchesShortcut(event, shortcuts.clear)) {
      event.preventDefault()
      term.clear()
      return false
    }

    return true
  }, [terminal])

  useEffect(() => {
    if (!terminal || !terminalReady) return

    terminal.attachCustomKeyEventHandler(handleKeyEvent)

    return () => {
      terminal.attachCustomKeyEventHandler(() => true)
    }
  }, [handleKeyEvent, terminalReady, terminal])
}
