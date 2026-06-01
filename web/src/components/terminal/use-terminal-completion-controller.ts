"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react"
import type { Terminal } from "@xterm/xterm"
import { CompletionEngine } from "@/lib/completion/completion-engine"
import { LocalCommandProvider } from "@/lib/completion/providers/local-command-provider"
import { RemoteHistoryProvider } from "@/lib/completion/providers/remote-history-provider"
import { ScriptProvider } from "@/lib/completion/providers/script-provider"
import { SessionProvider } from "@/lib/completion/providers/session-provider"
import type { CompletionConfig, CompletionItem } from "@/lib/completion/types"
import {
  applyCompletion,
  getCursorScreenPosition,
  isBackspaceKey,
  isDownArrow,
  isEnterKey,
  isEscapeKey,
  isTabKey,
  isUpArrow,
  parseCompletionContext,
} from "@/lib/completion/utils"
import type { CompletionDataResponse, CompletionUpdateResponse } from "@/lib/websocket-terminal"

export type CompletionPlacement = "top" | "bottom"

export interface TerminalCompletionProviderFlags {
  local: boolean
  session: boolean
  script: boolean
  remoteHistory: boolean
}

export interface TerminalCompletionState {
  visible: boolean
  items: CompletionItem[]
  selectedIndex: number
  position: { x: number; y: number }
  matchedPrefix: string
}

export interface UseTerminalCompletionControllerOptions {
  sessionId: string
  terminal: Terminal | null | undefined
  terminalReady: boolean
  isTerminalReadyRef: MutableRefObject<boolean>
  containerRef: RefObject<HTMLDivElement | null>
  completionConfig: CompletionConfig
  effectiveCompletionEnabled: boolean
  completionTrigger: "tab" | "auto"
  completionAutoDelay: number
  completionMaxItems: number
  completionShowIcon: boolean
  completionShowDescription: boolean
  providerEnabled: TerminalCompletionProviderFlags
  sendInputRef: MutableRefObject<(data: string) => void>
  completionUpdateSenderRef: MutableRefObject<((command: string) => void) | null>
  onCommand: (command: string) => void
}

export interface UseTerminalCompletionControllerResult {
  completionState: TerminalCompletionState
  closeCompletion: () => void
  applyCompletionItem: (item: CompletionItem) => void
  setCompletionPlacement: Dispatch<SetStateAction<CompletionPlacement>>
  handleCompletionData: (data: CompletionDataResponse) => void
  handleCompletionUpdate: (data: CompletionUpdateResponse) => void
  clearProviderData: () => void
  enableCompletionFetch: boolean
}

const emptyCompletionState: TerminalCompletionState = {
  visible: false,
  items: [],
  selectedIndex: 0,
  position: { x: 0, y: 0 },
  matchedPrefix: "",
}

export function useTerminalCompletionController({
  sessionId,
  terminal,
  terminalReady,
  isTerminalReadyRef,
  containerRef,
  completionConfig,
  effectiveCompletionEnabled,
  completionTrigger,
  completionAutoDelay,
  completionMaxItems,
  completionShowIcon,
  completionShowDescription,
  providerEnabled,
  sendInputRef,
  completionUpdateSenderRef,
  onCommand,
}: UseTerminalCompletionControllerOptions): UseTerminalCompletionControllerResult {
  const completionEngineRef = useRef<CompletionEngine | null>(null)
  const completionEngineSessionIdRef = useRef<string | null>(null)
  const remoteHistoryProviderRef = useRef<RemoteHistoryProvider | null>(null)
  const scriptProviderRef = useRef<ScriptProvider | null>(null)
  const sessionProviderRef = useRef<SessionProvider | null>(null)
  const autoCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completionInProgressRef = useRef(false)
  const handleCompletionRequestRef = useRef<(() => Promise<void>) | undefined>(undefined)
  const [completionState, setCompletionState] = useState<TerminalCompletionState>(emptyCompletionState)
  const [completionPlacement, setCompletionPlacement] = useState<CompletionPlacement>("bottom")
  const completionPlacementRef = useRef<CompletionPlacement>("bottom")
  const completionStateRef = useRef(completionState)

  useEffect(() => {
    completionPlacementRef.current = completionPlacement
  }, [completionPlacement])

  useEffect(() => {
    completionStateRef.current = completionState
  }, [completionState])

  const getMergedConfig = useCallback((): CompletionConfig => ({
    ...completionConfig,
    trigger: completionTrigger,
    autoTriggerDelay: completionAutoDelay,
    maxItems: completionMaxItems,
    showIcon: completionShowIcon,
    showDescription: completionShowDescription,
  }), [
    completionAutoDelay,
    completionConfig,
    completionMaxItems,
    completionShowDescription,
    completionShowIcon,
    completionTrigger,
  ])

  const syncProviderEnabledState = useCallback((engine: CompletionEngine) => {
    engine.setProviderEnabled("local", effectiveCompletionEnabled && providerEnabled.local)
    engine.setProviderEnabled("session", effectiveCompletionEnabled && providerEnabled.session)
    engine.setProviderEnabled("script", effectiveCompletionEnabled && providerEnabled.script)
    engine.setProviderEnabled("remote-history", effectiveCompletionEnabled && providerEnabled.remoteHistory)
  }, [
    effectiveCompletionEnabled,
    providerEnabled.local,
    providerEnabled.remoteHistory,
    providerEnabled.script,
    providerEnabled.session,
  ])

  const createCompletionEngine = useCallback((targetSessionId: string) => {
    const engine = new CompletionEngine(targetSessionId, getMergedConfig())

    engine.registerProvider(new LocalCommandProvider())

    const sessionProvider = new SessionProvider()
    sessionProviderRef.current = sessionProvider
    engine.registerProvider(sessionProvider)

    const scriptProvider = new ScriptProvider()
    scriptProviderRef.current = scriptProvider
    engine.registerProvider(scriptProvider)

    const remoteHistoryProvider = new RemoteHistoryProvider()
    remoteHistoryProviderRef.current = remoteHistoryProvider
    engine.registerProvider(remoteHistoryProvider)

    syncProviderEnabledState(engine)
    completionEngineRef.current = engine
    completionEngineSessionIdRef.current = targetSessionId
  }, [getMergedConfig, syncProviderEnabledState])

  useEffect(() => {
    if (completionEngineRef.current && completionEngineSessionIdRef.current === sessionId) {
      return
    }

    if (autoCompleteTimerRef.current) {
      clearTimeout(autoCompleteTimerRef.current)
      autoCompleteTimerRef.current = null
    }
    completionInProgressRef.current = false
    setCompletionState(emptyCompletionState)
    createCompletionEngine(sessionId)
  }, [createCompletionEngine, sessionId])

  useEffect(() => {
    if (!completionEngineRef.current) return

    completionEngineRef.current.updateConfig(getMergedConfig())
    syncProviderEnabledState(completionEngineRef.current)
    completionEngineRef.current.clearCache()
  }, [getMergedConfig, syncProviderEnabledState])

  const clearProviderData = useCallback(() => {
    remoteHistoryProviderRef.current?.clear()
    scriptProviderRef.current?.clear()
    sessionProviderRef.current?.clear()
    completionEngineRef.current?.clearCache()
  }, [])

  const handleCompletionData = useCallback((data: CompletionDataResponse) => {
    remoteHistoryProviderRef.current?.loadHistory(data.history, data.timestamp)
    scriptProviderRef.current?.loadScripts(data.scripts)
    completionEngineRef.current?.clearCache()
  }, [])

  const handleCompletionUpdate = useCallback((data: CompletionUpdateResponse) => {
    remoteHistoryProviderRef.current?.addCommand(data.newCommand)
    completionEngineRef.current?.clearCache()
  }, [])

  const closeCompletion = useCallback(() => {
    setCompletionState(emptyCompletionState)
  }, [])

  useEffect(() => {
    if (!effectiveCompletionEnabled && completionStateRef.current.visible) {
      closeCompletion()
    }
  }, [effectiveCompletionEnabled, closeCompletion])

  const applyCompletionItem = useCallback((item: CompletionItem) => {
    if (!terminal) return

    const context = parseCompletionContext(terminal)
    const isFullLineCompletion = item.source === "script" || item.type === "history"
    let deleteCount: number
    let completionText = item.text

    if (isFullLineCompletion) {
      const currentLine = context.fullLine.trim()

      if (currentLine && item.text.startsWith(currentLine)) {
        deleteCount = 0
        completionText = item.text.slice(currentLine.length)
      } else {
        deleteCount = context.fullLine.length
      }
    } else {
      deleteCount = context.currentWord.length
    }

    applyCompletion(terminal, completionText, deleteCount, sendInputRef.current)
    closeCompletion()
  }, [closeCompletion, sendInputRef, terminal])

  const handleCompletionRequest = useCallback(async () => {
    if (!effectiveCompletionEnabled || !terminal || !completionEngineRef.current) {
      return
    }

    if (completionInProgressRef.current) {
      return
    }
    completionInProgressRef.current = true

    const context = parseCompletionContext(terminal)

    try {
      const result = await completionEngineRef.current.getCompletions(context)

      if (!result || result.items.length === 0) {
        closeCompletion()
        return
      }

      const cursorPosition = getCursorScreenPosition(terminal)
      let position = {
        x: cursorPosition.x,
        y: cursorPosition.y,
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        position = {
          x: position.x + rect.left,
          y: position.y + rect.top,
        }
      }

      const rawPrefix = context.fullLine.slice(
        0,
        Math.min(context.cursorPosition, context.fullLine.length)
      )
      const linePrefix = rawPrefix.trim()
      const matchedPrefix = linePrefix || context.currentWord

      setCompletionState({
        visible: true,
        items: result.items,
        selectedIndex: 0,
        position,
        matchedPrefix,
      })
    } finally {
      completionInProgressRef.current = false
    }
  }, [containerRef, effectiveCompletionEnabled, terminal, closeCompletion])

  useEffect(() => {
    handleCompletionRequestRef.current = handleCompletionRequest
  }, [handleCompletionRequest])

  useEffect(() => {
    if (!terminal || !terminalReady) return

    const disposable = terminal.onData((data: string) => {
      if (!isTerminalReadyRef.current) return

      if (isTabKey(data)) {
        if (effectiveCompletionEnabled && completionTrigger === "tab") {
          void handleCompletionRequestRef.current?.()
          return
        }

        sendInputRef.current(data)
        onCommand(data)
        return
      }

      if (completionStateRef.current.visible && isEscapeKey(data)) {
        closeCompletion()
        if (autoCompleteTimerRef.current) {
          clearTimeout(autoCompleteTimerRef.current)
          autoCompleteTimerRef.current = null
        }
        return
      }

      if (completionStateRef.current.visible) {
        if (isUpArrow(data)) {
          const isTopPlacement = completionPlacementRef.current === "top"
          setCompletionState((prev) => {
            const delta = isTopPlacement ? 1 : -1
            const nextIndex = Math.max(0, Math.min(prev.items.length - 1, prev.selectedIndex + delta))
            if (nextIndex === prev.selectedIndex) return prev
            return { ...prev, selectedIndex: nextIndex }
          })
          return
        }

        if (isDownArrow(data)) {
          const isTopPlacement = completionPlacementRef.current === "top"
          setCompletionState((prev) => {
            const delta = isTopPlacement ? -1 : 1
            const nextIndex = Math.max(0, Math.min(prev.items.length - 1, prev.selectedIndex + delta))
            if (nextIndex === prev.selectedIndex) return prev
            return { ...prev, selectedIndex: nextIndex }
          })
          return
        }

        if (isEnterKey(data)) {
          const selectedItem = completionStateRef.current.items[completionStateRef.current.selectedIndex]
          if (selectedItem) {
            applyCompletionItem(selectedItem)
          }
          return
        }

        closeCompletion()
      }

      sendInputRef.current(data)
      onCommand(data)

      if (isEnterKey(data)) {
        if (autoCompleteTimerRef.current) {
          clearTimeout(autoCompleteTimerRef.current)
          autoCompleteTimerRef.current = null
        }

        const context = parseCompletionContext(terminal)
        const command = context.fullLine.trim()

        if (command && sessionProviderRef.current) {
          sessionProviderRef.current.addCommand(command)
        }

        if (command && remoteHistoryProviderRef.current) {
          remoteHistoryProviderRef.current.addCommand(command)
        }

        if (command) {
          completionUpdateSenderRef.current?.(command)
        }

        return
      }

      if (!effectiveCompletionEnabled || completionTrigger !== "auto") {
        return
      }

      if (autoCompleteTimerRef.current) {
        clearTimeout(autoCompleteTimerRef.current)
        autoCompleteTimerRef.current = null
      }

      if (isBackspaceKey(data)) {
        closeCompletion()
        return
      }

      if (!data || data.length === 0) {
        return
      }
      const firstCharCode = data.charCodeAt(0)
      if (firstCharCode < 32 || firstCharCode === 127) {
        return
      }

      if (data === " ") {
        return
      }

      autoCompleteTimerRef.current = setTimeout(() => {
        if (!effectiveCompletionEnabled || completionTrigger !== "auto") {
          autoCompleteTimerRef.current = null
          return
        }

        const context = parseCompletionContext(terminal)
        const rawPrefix = context.fullLine.slice(
          0,
          Math.min(context.cursorPosition, context.fullLine.length)
        )
        const linePrefix = rawPrefix.trim()
        const effectivePrefix = linePrefix || context.currentWord

        if (effectivePrefix && effectivePrefix.length >= 2) {
          void handleCompletionRequestRef.current?.()
        }

        autoCompleteTimerRef.current = null
      }, completionEngineRef.current?.getConfig().autoTriggerDelay ?? completionAutoDelay ?? 200)
    })

    return () => {
      disposable.dispose()
      if (autoCompleteTimerRef.current) {
        clearTimeout(autoCompleteTimerRef.current)
        autoCompleteTimerRef.current = null
      }
    }
  }, [
    applyCompletionItem,
    closeCompletion,
    completionAutoDelay,
    completionTrigger,
    completionUpdateSenderRef,
    effectiveCompletionEnabled,
    isTerminalReadyRef,
    onCommand,
    sendInputRef,
    terminal,
    terminalReady,
  ])

  return {
    completionState,
    closeCompletion,
    applyCompletionItem,
    setCompletionPlacement,
    handleCompletionData,
    handleCompletionUpdate,
    clearProviderData,
    enableCompletionFetch: effectiveCompletionEnabled && (providerEnabled.remoteHistory || providerEnabled.script),
  }
}
