"use client"

import { useCallback, useRef, useState } from "react"
import type {
  TerminalAuthMethod,
  TerminalAuthPrompt,
  TerminalAuthPromptResponder,
  TerminalConnectionPhase,
  TerminalHostKeyPrompt,
  TerminalHostKeyResponder,
} from "@/lib/websocket-terminal"

type TerminalTranslator = (key: string, params?: Record<string, string | number>) => string

export interface TerminalCredentialSaveRequest {
  serverId: string
  authMethod: TerminalAuthMethod
  secret: string
}

export interface TerminalCredentialSavePrompt {
  title: string
  description: string
  actionLabel: string
  onConfirm: () => void
}

export interface TerminalAuthFlowAdapters {
  notifySuccess?: (message: string) => unknown
  notifyError?: (message: string) => unknown
  requestCredentialSave?: (prompt: TerminalCredentialSavePrompt) => unknown
  saveCredential?: (request: TerminalCredentialSaveRequest) => Promise<unknown>
}

export interface UseTerminalAuthFlowOptions {
  serverId?: string
  serverName: string
  tTerminal: TerminalTranslator
  adapters?: TerminalAuthFlowAdapters
  onAuthCancelled?: () => void
}

export function useTerminalAuthFlow({
  serverId,
  serverName,
  tTerminal,
  adapters,
  onAuthCancelled,
}: UseTerminalAuthFlowOptions) {
  const [authChallenge, setAuthChallenge] = useState<{
    prompt: TerminalAuthPrompt
    respond: TerminalAuthPromptResponder
  } | null>(null)
  const [hostKeyWarning, setHostKeyWarning] = useState<{
    prompt: TerminalHostKeyPrompt
    respond: TerminalHostKeyResponder
  } | null>(null)
  const [hostKeyTrusting, setHostKeyTrusting] = useState(false)
  const hostKeyResponseSentRef = useRef(false)
  const successfulCredentialRef = useRef<{
    authMethod: TerminalAuthMethod
    secret: string
  } | null>(null)

  const handleAuthPrompt = useCallback((
    prompt: TerminalAuthPrompt,
    respond: TerminalAuthPromptResponder,
  ) => {
    setAuthChallenge({ prompt, respond })
  }, [])

  const handleHostKeyPrompt = useCallback((
    prompt: TerminalHostKeyPrompt,
    respond: TerminalHostKeyResponder,
  ) => {
    hostKeyResponseSentRef.current = false
    setHostKeyWarning({ prompt, respond })
  }, [])

  const handleConnectionEnd = useCallback(() => {
    setAuthChallenge(null)
    setHostKeyWarning(null)
    setHostKeyTrusting(false)
    successfulCredentialRef.current = null
  }, [])

  const handleAuthChallengeSubmit = useCallback((answers: string[], authMethod?: TerminalAuthMethod) => {
    if (
      authChallenge?.prompt.kind === "credential_retry" &&
      authMethod &&
      answers[0]
    ) {
      successfulCredentialRef.current = {
        authMethod,
        secret: answers[0],
      }
    }

    authChallenge?.respond(answers, false, authMethod)
    setAuthChallenge(null)
  }, [authChallenge])

  const handleAuthChallengeCancel = useCallback(() => {
    authChallenge?.respond([], true)
    setAuthChallenge(null)
    onAuthCancelled?.()
  }, [authChallenge, onAuthCancelled])

  const handleTrustHostKey = useCallback(() => {
    if (!hostKeyWarning || hostKeyResponseSentRef.current) {
      return
    }

    setHostKeyTrusting(true)
    try {
      hostKeyResponseSentRef.current = true
      hostKeyWarning.respond(true, hostKeyWarning.prompt.received_key)
      adapters?.notifySuccess?.(tTerminal("hostKeyChangedSuccess"))
      setHostKeyWarning(null)
    } finally {
      setHostKeyTrusting(false)
    }
  }, [adapters, hostKeyWarning, tTerminal])

  const handleCancelHostKey = useCallback(() => {
    if (!hostKeyWarning || hostKeyResponseSentRef.current) {
      return
    }

    hostKeyResponseSentRef.current = true
    hostKeyWarning.respond(false)
    setHostKeyWarning(null)
  }, [hostKeyWarning])

  const handleConnectionPhaseChange = useCallback((phase: TerminalConnectionPhase) => {
    if (phase !== "ready" || !successfulCredentialRef.current) {
      return
    }

    const credential = successfulCredentialRef.current
    successfulCredentialRef.current = null

    if (!serverId || !adapters?.saveCredential || !adapters.requestCredentialSave) {
      return
    }

    adapters.requestCredentialSave({
      title: tTerminal("authRetrySavePrompt"),
      description: tTerminal("authRetrySaveDescription", { server: serverName }),
      actionLabel: tTerminal("authRetrySaveAction"),
      onConfirm: () => {
        void adapters.saveCredential?.({
          serverId,
          authMethod: credential.authMethod,
          secret: credential.secret,
        }).then(() => {
          adapters.notifySuccess?.(tTerminal("authRetrySaveSuccess"))
        }).catch((error) => {
          console.error("[WebTerminal] 保存补充凭据失败:", error)
          adapters.notifyError?.(tTerminal("authRetrySaveFailed"))
        })
      },
    })
  }, [adapters, serverId, serverName, tTerminal])

  return {
    authChallenge,
    hostKeyWarning,
    hostKeyTrusting,
    handleAuthPrompt,
    handleHostKeyPrompt,
    handleConnectionEnd,
    handleConnectionPhaseChange,
    handleAuthChallengeSubmit,
    handleAuthChallengeCancel,
    handleTrustHostKey,
    handleCancelHostKey,
  }
}
