"use client"

import { useEffect, type RefObject } from "react"
import type { FitAddon } from "@xterm/addon-fit"
import type { Terminal } from "@xterm/xterm"

export interface UseTerminalAutoFitOptions {
  terminal: Terminal | null | undefined
  fitAddon: FitAddon | null | undefined
  containerRef: RefObject<HTMLDivElement | null>
  isActive: boolean
  terminalReady: boolean
  onTerminalResize: (cols: number, rows: number) => void
  onResize?: (cols: number, rows: number) => void
  debounceMs?: number
}

export function useTerminalAutoFit({
  terminal,
  fitAddon,
  containerRef,
  isActive,
  terminalReady,
  onTerminalResize,
  onResize,
  debounceMs = 80,
}: UseTerminalAutoFitOptions) {
  useEffect(() => {
    if (!isActive || !terminal || !fitAddon || !containerRef.current || !terminalReady) return

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null
    let resizeObserver: ResizeObserver | null = null
    let removeWindowResize: (() => void) | null = null

    const applyFit = () => {
      const containerElement = containerRef.current
      if (
        !isActive ||
        !fitAddon ||
        !terminal ||
        !containerElement ||
        containerElement.clientWidth <= 0 ||
        containerElement.clientHeight <= 0
      ) {
        return
      }

      fitAddon.fit()
      const newCols = terminal.cols
      const newRows = terminal.rows
      terminal.refresh(0, terminal.rows - 1)

      onTerminalResize(newCols, newRows)
      onResize?.(newCols, newRows)
    }

    const scheduleFit = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = setTimeout(applyFit, debounceMs)
    }

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleFit()
      })
      const containerElement = containerRef.current
      if (containerElement) {
        resizeObserver.observe(containerElement)
      }
    } else {
      const handleResize = () => scheduleFit()
      window.addEventListener("resize", handleResize)
      removeWindowResize = () => window.removeEventListener("resize", handleResize)
    }

    scheduleFit()

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      removeWindowResize?.()
      removeWindowResize = null
    }
  }, [containerRef, debounceMs, fitAddon, isActive, onResize, onTerminalResize, terminal, terminalReady])
}
