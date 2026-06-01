"use client"

import { useCallback, useMemo, useRef } from "react"
import { useTranslations } from "next-intl"
import { ConnectionLoader } from "./connection-loader"
import { TerminalAuthChallengeDialog } from "./terminal-auth-challenge-dialog"
import { TerminalHostKeyDialog } from "./terminal-host-key-dialog"
import { CompletionPopup } from "./completion-popup"
import { useTerminalAuthFlowAdapters } from "./use-terminal-auth-flow-adapters"
import { useTerminalAutoFit } from "./use-terminal-auto-fit"
import { useTerminalCompletionController } from "./use-terminal-completion-controller"
import { useTerminalConnectionController } from "./use-terminal-connection-controller"
import { useTerminalContainerApi } from "./use-terminal-container-api"
import { useTerminalInputActions } from "./use-terminal-input-actions"
import {
  formatTerminalFontFamily,
  resolveTerminalRendererTheme,
  useTerminalRendererSettings,
  type TerminalCursorStyle,
  type TerminalThemeName,
} from "./use-terminal-renderer-settings"
import type { Terminal } from "@xterm/xterm"
import { TerminalThemeProvider } from "@/contexts/terminal-theme-context"
import { useCompletionConfig } from "@/contexts/completion-config-context"
import { useTerminalAuthFlow, type TerminalAuthFlowAdapters } from "@/components/terminal/use-terminal-auth-flow"
import { useOptionalSshWorkspace } from "@/components/ssh-workspace/ssh-workspace"
import { useTerminalInstance } from "@/hooks/useTerminalInstance"
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-mode"
import { createWorkspaceTerminalAuthTicketProviderAdapter } from "@/lib/session/workspace-adapters"
import type { TerminalConnectionPhase } from "@/lib/websocket-terminal"

export interface WebTerminalProps {
  sessionId: string
  serverId?: string
  serverName: string
  host: string
  username: string
  isActive: boolean
  shouldConnect: boolean
  onConnectionPhaseChange?: (phase: TerminalConnectionPhase) => void
  onAuthCancelled?: () => void
  authFlowAdapters?: TerminalAuthFlowAdapters
  onCommand: (command: string) => void
  onResize?: (cols: number, rows: number) => void
  theme?: TerminalThemeName
  fontSize?: number
  fontFamily?: string
  cursorStyle?: TerminalCursorStyle
  cursorBlink?: boolean
  scrollback?: number
  rightClickPaste?: boolean
  copyOnSelect?: boolean
  copyShortcut?: string
  pasteShortcut?: string
  clearShortcut?: string
  completionEnabled?: boolean
  completionTrigger?: "tab" | "auto"
  completionAutoDelay?: number
  completionMaxItems?: number
  completionShowIcon?: boolean
  completionShowDescription?: boolean
  enableWebgl?: boolean
  transparentBackground?: boolean
  backgroundOpacity?: number
}

export function WebTerminal({
  sessionId,
  serverId,
  serverName,
  host,
  username,
  isActive,
  shouldConnect,
  onConnectionPhaseChange,
  onAuthCancelled,
  authFlowAdapters,
  onCommand,
  onResize,
  theme = "default",
  fontSize = 14,
  fontFamily = "JetBrains Mono",
  cursorStyle = "bar",
  cursorBlink = true,
  scrollback = 1000,
  rightClickPaste = true,
  copyOnSelect = true,
  copyShortcut = "Ctrl+Shift+C",
  pasteShortcut = "Ctrl+Shift+V",
  clearShortcut = "Ctrl+L",
  completionEnabled = true,
  completionTrigger = "auto",
  completionAutoDelay = 200,
  completionMaxItems = 10,
  completionShowIcon = true,
  completionShowDescription = true,
  enableWebgl = true,
  transparentBackground = false,
  backgroundOpacity = 1,
}: WebTerminalProps) {
  const tTerminal = useTranslations("terminal")
  const workspace = useOptionalSshWorkspace()
  const { completionConfig, globalConfig } = useCompletionConfig()
  const { mode: effectiveAppTheme, version: themeModeVersion } = useEffectiveThemeMode()
  const effectiveCompletionEnabled = completionEnabled && completionConfig.enabled

  const terminalFontFamily = formatTerminalFontFamily(fontFamily)
  const { terminalTheme, terminalRendererTheme } = useMemo(() => {
    void themeModeVersion
    return resolveTerminalRendererTheme({
      theme,
      appTheme: effectiveAppTheme,
      transparentBackground,
      backgroundOpacity,
    })
  }, [backgroundOpacity, effectiveAppTheme, theme, themeModeVersion, transparentBackground])

  const { terminal, fitAddon, terminalReady, containerRef, isClient } = useTerminalInstance(
    sessionId,
    {
      theme: terminalRendererTheme,
      fontSize,
      fontFamily: terminalFontFamily,
      cursorStyle,
      cursorBlink,
      scrollback,
      enableWebgl,
    },
    true
  )

  const isTerminalReadyRef = useRef(false)
  const sendInputRef = useRef<(data: string) => void>(() => {})
  const completionUpdateSenderRef = useRef<((command: string) => void) | null>(null)

  const completionProviderEnabled = useMemo(() => ({
    local: !!globalConfig.providers.local,
    session: !!globalConfig.providers.session,
    script: !!globalConfig.providers.script,
    remoteHistory: !!globalConfig.providers.remote_history,
  }), [
    globalConfig.providers.local,
    globalConfig.providers.remote_history,
    globalConfig.providers.script,
    globalConfig.providers.session,
  ])

  const effectiveAuthFlowAdapters = useTerminalAuthFlowAdapters({ authFlowAdapters })
  const terminalAuthTicketProvider = useMemo(
    () => createWorkspaceTerminalAuthTicketProviderAdapter(workspace?.adapters.authTicketProvider),
    [workspace?.adapters.authTicketProvider],
  )
  const authFlow = useTerminalAuthFlow({
    serverId,
    serverName,
    tTerminal,
    adapters: effectiveAuthFlowAdapters,
    onAuthCancelled,
  })

  const terminalCompletion = useTerminalCompletionController({
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
    providerEnabled: completionProviderEnabled,
    sendInputRef,
    completionUpdateSenderRef,
    onCommand,
  })

  const { resize } = useTerminalConnectionController({
    sessionId,
    serverId,
    shouldConnect,
    isActive,
    terminal,
    tTerminal,
    completion: terminalCompletion,
    auth: authFlow,
    isTerminalReadyRef,
    sendInputRef,
    completionUpdateSenderRef,
    onConnectionPhaseChange,
    createAuthTicket: terminalAuthTicketProvider,
    createWebSocketUrl: workspace?.adapters.apiClient?.terminal?.createWebSocketUrl,
  })

  useTerminalRendererSettings({
    terminal,
    terminalReady,
    terminalRendererTheme,
    themeModeVersion,
    fontSize,
    fontFamily: terminalFontFamily,
    cursorStyle,
    cursorBlink,
    scrollback,
  })

  const writePrompt = useCallback((term: Terminal) => {
    const hostShort = host.split(".")[0] || host
    term.write(`\x1b[1;32m${username}\x1b[0m\x1b[2m@\x1b[0m\x1b[1;36m${hostShort}\x1b[0m \x1b[1;34m~\x1b[0m\x1b[1;35m $\x1b[0m `)
  }, [host, username])

  useTerminalAutoFit({
    terminal,
    fitAddon,
    containerRef,
    isActive,
    terminalReady,
    onTerminalResize: resize,
    onResize,
  })

  useTerminalContainerApi({
    terminal,
    fitAddon,
    containerRef,
    writePrompt,
  })

  useTerminalInputActions({
    terminal,
    terminalReady,
    containerRef,
    copyOnSelect,
    rightClickPaste,
    copyShortcut,
    pasteShortcut,
    clearShortcut,
  })

  if (!isClient) {
    return (
      <div className="h-full w-full bg-background flex items-center justify-center">
        <ConnectionLoader
          serverName={serverName}
          message={tTerminal("connectionLoaderInitializing")}
        />
      </div>
    )
  }

  return (
    <div className="h-full w-full relative overflow-hidden">
      <div
        ref={containerRef}
        className="h-full w-full terminal-container"
      />

      {terminalCompletion.completionState.visible && terminal && (
        <TerminalThemeProvider theme={terminalTheme}>
          <CompletionPopup
            items={terminalCompletion.completionState.items}
            selectedIndex={terminalCompletion.completionState.selectedIndex}
            position={terminalCompletion.completionState.position}
            matchedPrefix={terminalCompletion.completionState.matchedPrefix}
            showIcon={completionShowIcon}
            onSelect={terminalCompletion.applyCompletionItem}
            onClose={terminalCompletion.closeCompletion}
            onPlacementChange={terminalCompletion.setCompletionPlacement}
          />
        </TerminalThemeProvider>
      )}

      <TerminalAuthChallengeDialog
        prompt={authFlow.authChallenge?.prompt ?? null}
        serverName={`${username}@${host}`}
        onSubmit={authFlow.handleAuthChallengeSubmit}
        onCancel={authFlow.handleAuthChallengeCancel}
      />

      <TerminalHostKeyDialog
        prompt={authFlow.hostKeyWarning?.prompt ?? null}
        isTrusting={authFlow.hostKeyTrusting}
        labels={{
          title: tTerminal("hostKeyChangedTitle"),
          description: tTerminal("hostKeyChangedDescription", { server: serverName }),
          expected: tTerminal("hostKeyChangedExpected"),
          received: tTerminal("hostKeyChangedReceived"),
          risk: tTerminal("hostKeyChangedRisk"),
          cancel: tTerminal("hostKeyChangedCancel"),
          trust: tTerminal("hostKeyChangedTrust"),
          trusting: tTerminal("hostKeyChangedTrusting"),
        }}
        onCancel={authFlow.handleCancelHostKey}
        onTrust={authFlow.handleTrustHostKey}
      />

      <style jsx global>{`
        .terminal-container {
          /* 阻断终端滚动向页面的滚动链传递 */
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
        }
        .terminal-container .xterm,
        .terminal-container .xterm-screen,
        .terminal-container .xterm-viewport {
          background: transparent !important;
        }
        .terminal-container .xterm {
          padding: 16px;
        }
        @media (max-width: 767px) {
          .terminal-container .xterm {
            padding: 12px;
          }
        }
        .terminal-container .xterm-screen {
          border-radius: 0;
        }
        .terminal-container .xterm-viewport {
          /* 在终端滚动到边界时，不继续滚动外层页面 */
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
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
