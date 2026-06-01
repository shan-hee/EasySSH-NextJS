"use client"

import { useCallback, useEffect, type RefObject } from "react"
import type { FitAddon } from "@xterm/addon-fit"
import type { Terminal } from "@xterm/xterm"

export interface TerminalContainerApiElement extends HTMLDivElement {
  writeToTerminal?: (text: string) => void
  clearTerminal?: () => void
  fitTerminal?: () => void
}

export interface UseTerminalContainerApiOptions {
  terminal: Terminal | null | undefined
  fitAddon: FitAddon | null | undefined
  containerRef: RefObject<HTMLDivElement | null>
  writePrompt: (terminal: Terminal) => void
}

export function useTerminalContainerApi({
  terminal,
  fitAddon,
  containerRef,
  writePrompt,
}: UseTerminalContainerApiOptions) {
  const writeToTerminal = useCallback((text: string) => {
    terminal?.writeln(text)
  }, [terminal])

  const clearTerminal = useCallback(() => {
    if (!terminal) return

    terminal.clear()
    writePrompt(terminal)
  }, [terminal, writePrompt])

  const fitTerminal = useCallback(() => {
    fitAddon?.fit()
  }, [fitAddon])

  useEffect(() => {
    const container = containerRef.current as TerminalContainerApiElement | null
    if (!container) return

    container.writeToTerminal = writeToTerminal
    container.clearTerminal = clearTerminal
    container.fitTerminal = fitTerminal
  }, [containerRef, writeToTerminal, clearTerminal, fitTerminal])

  return {
    writeToTerminal,
    clearTerminal,
    fitTerminal,
  }
}
