"use client"

import { useMemo } from "react"
import { toast } from "@/components/ui/sonner"
import { useOptionalSshWorkspace } from "@/components/ssh-workspace/ssh-workspace"
import { serversApi } from "@/lib/api"
import type { TerminalAuthFlowAdapters } from "./use-terminal-auth-flow"

export interface UseTerminalAuthFlowAdaptersOptions {
  authFlowAdapters?: TerminalAuthFlowAdapters
}

export function useTerminalAuthFlowAdapters({
  authFlowAdapters,
}: UseTerminalAuthFlowAdaptersOptions): TerminalAuthFlowAdapters {
  const workspace = useOptionalSshWorkspace()

  const workspaceAuthFlowAdapters = useMemo<TerminalAuthFlowAdapters | undefined>(() => {
    const notifier = workspace?.adapters.notifier
    const saveVerifiedCredential = workspace?.adapters.apiClient?.terminal?.saveVerifiedCredential

    if (!notifier?.action || !saveVerifiedCredential) {
      return undefined
    }

    return {
      notifySuccess: notifier.success,
      notifyError: notifier.error,
      requestCredentialSave: ({ title, description, actionLabel, onConfirm }) => notifier.action?.(title, {
        description,
        actionLabel,
        onAction: onConfirm,
      }),
      saveCredential: ({ serverId, authMethod, secret }) => saveVerifiedCredential({
        serverId,
        authMethod,
        secret,
      }),
    }
  }, [workspace?.adapters.apiClient?.terminal?.saveVerifiedCredential, workspace?.adapters.notifier])

  const defaultAuthFlowAdapters = useMemo<TerminalAuthFlowAdapters>(() => ({
    notifySuccess: toast.success,
    notifyError: toast.error,
    requestCredentialSave: ({ title, description, actionLabel, onConfirm }) => {
      toast(title, {
        description,
        action: {
          label: actionLabel,
          onClick: onConfirm,
        },
      })
    },
    saveCredential: ({ serverId, authMethod, secret }) => {
      const payload = authMethod === "key"
        ? {
            auth_method: "key" as const,
            private_key: secret,
            verified_connection_credential: true,
          }
        : {
            auth_method: "password" as const,
            password: secret,
            verified_connection_credential: true,
          }

      return serversApi.update(serverId, payload)
    },
  }), [])

  return authFlowAdapters ?? workspaceAuthFlowAdapters ?? defaultAuthFlowAdapters
}
