"use client"

import { useCallback, useEffect, type MutableRefObject } from "react"
import type { Terminal } from "@xterm/xterm"
import { useWebSocketConnection } from "@/hooks/useWebSocketConnection"
import type {
  CompletionDataResponse,
  CompletionUpdateResponse,
  TerminalAuthPrompt,
  TerminalAuthPromptResponder,
  TerminalConnectionPhase,
  TerminalHostKeyPrompt,
  TerminalHostKeyResponder,
  TerminalWebSocket,
  TerminalWebSocketAuthTicketProvider,
  TerminalWebSocketConstructor,
  TerminalWebSocketUrlResolver,
} from "@/lib/websocket-terminal"
import { useTerminalConnectionErrorFormatter } from "./use-terminal-connection-error-formatter"

type TerminalTranslator = (key: string, params?: Record<string, string | number>) => string

export interface TerminalCompletionConnectionBridge {
  enableCompletionFetch: boolean
  handleCompletionData: (data: CompletionDataResponse) => void
  handleCompletionUpdate: (data: CompletionUpdateResponse) => void
  clearProviderData: () => void
}

export interface TerminalAuthConnectionHandlers {
  handleAuthPrompt: (prompt: TerminalAuthPrompt, respond: TerminalAuthPromptResponder) => void
  handleHostKeyPrompt: (prompt: TerminalHostKeyPrompt, respond: TerminalHostKeyResponder) => void
  handleConnectionEnd: () => void
  handleConnectionPhaseChange: (phase: TerminalConnectionPhase) => void
}

export interface UseTerminalConnectionControllerOptions {
  sessionId: string
  serverId?: string
  shouldConnect: boolean
  isActive: boolean
  terminal: Terminal | null | undefined
  tTerminal: TerminalTranslator
  completion: TerminalCompletionConnectionBridge
  auth: TerminalAuthConnectionHandlers
  isTerminalReadyRef: MutableRefObject<boolean>
  sendInputRef: MutableRefObject<(data: string) => void>
  completionUpdateSenderRef: MutableRefObject<((command: string) => void) | null>
  onConnectionPhaseChange?: (phase: TerminalConnectionPhase) => void
  createAuthTicket?: TerminalWebSocketAuthTicketProvider
  createWebSocketUrl?: TerminalWebSocketUrlResolver
  WebSocketCtor?: TerminalWebSocketConstructor
}

export interface UseTerminalConnectionControllerResult {
  connectionPhase: TerminalConnectionPhase
  isTerminalReady: boolean
  resize: (cols: number, rows: number) => void
  ws: TerminalWebSocket | null
}

export function useTerminalConnectionController({
  sessionId,
  serverId,
  shouldConnect,
  isActive,
  terminal,
  tTerminal,
  completion,
  auth,
  isTerminalReadyRef,
  sendInputRef,
  completionUpdateSenderRef,
  onConnectionPhaseChange,
  createAuthTicket,
  createWebSocketUrl,
  WebSocketCtor,
}: UseTerminalConnectionControllerOptions): UseTerminalConnectionControllerResult {
  const formatTerminalErrorMessage = useTerminalConnectionErrorFormatter(tTerminal)
  const {
    enableCompletionFetch,
    handleCompletionData,
    handleCompletionUpdate,
    clearProviderData,
  } = completion
  const {
    handleAuthPrompt,
    handleHostKeyPrompt,
    handleConnectionEnd,
    handleConnectionPhaseChange: handleAuthConnectionPhaseChange,
  } = auth

  const handleConnectionPhaseChange = useCallback((phase: TerminalConnectionPhase) => {
    handleAuthConnectionPhaseChange(phase)
    onConnectionPhaseChange?.(phase)
  }, [handleAuthConnectionPhaseChange, onConnectionPhaseChange])

  const { sendInput, resize, ws, connectionPhase } = useWebSocketConnection({
    sessionId,
    serverId,
    shouldConnect,
    isActive,
    terminal: terminal ?? undefined,
    cols: terminal?.cols || 80,
    rows: terminal?.rows || 24,
    enableCompletionFetch,
    onCompletionData: handleCompletionData,
    onCompletionUpdate: handleCompletionUpdate,
    onAuthPrompt: handleAuthPrompt,
    onHostKeyPrompt: handleHostKeyPrompt,
    onConnectionEnd: handleConnectionEnd,
    onConnectionPhase: handleConnectionPhaseChange,
    formatErrorMessage: formatTerminalErrorMessage,
    createAuthTicket,
    createWebSocketUrl,
    WebSocketCtor,
  })

  const isTerminalReady = connectionPhase === "ready"

  useEffect(() => {
    isTerminalReadyRef.current = isTerminalReady
  }, [isTerminalReady, isTerminalReadyRef])

  useEffect(() => {
    sendInputRef.current = sendInput
  }, [sendInput, sendInputRef])

  useEffect(() => {
    completionUpdateSenderRef.current = ws
      ? (command: string) => ws.sendCompletionUpdate(command)
      : null
  }, [completionUpdateSenderRef, ws])

  useEffect(() => {
    if (!ws || !isTerminalReady || !serverId) {
      clearProviderData()
    }
  }, [clearProviderData, isTerminalReady, serverId, ws])

  return {
    connectionPhase,
    isTerminalReady,
    resize,
    ws,
  }
}
