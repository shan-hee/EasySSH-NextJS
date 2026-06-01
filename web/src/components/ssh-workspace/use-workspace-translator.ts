"use client"

import { useCallback } from "react"
import { useOptionalSshWorkspace } from "@/components/ssh-workspace/ssh-workspace"

export type WorkspaceTranslationParams = Record<string, string | number>
export type WorkspaceUiTranslator = (key: string, params?: WorkspaceTranslationParams) => string

export function useWorkspaceTranslator(namespace: string): WorkspaceUiTranslator {
  const workspace = useOptionalSshWorkspace()
  const workspaceI18n = workspace?.adapters.i18n

  return useCallback(
    (key: string, params?: WorkspaceTranslationParams) => {
      if (workspaceI18n) {
        return workspaceI18n.t(namespace, key, params)
      }

      return key
    },
    [namespace, workspaceI18n],
  )
}

export function useWorkspaceCommonTranslator(): WorkspaceUiTranslator {
  return useWorkspaceTranslator("common")
}

export function useWorkspaceSftpTranslator(): WorkspaceUiTranslator {
  return useWorkspaceTranslator("sftp")
}
