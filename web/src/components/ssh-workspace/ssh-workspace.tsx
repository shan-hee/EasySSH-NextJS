"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  SshWorkspaceAdapters,
  SshWorkspaceCapabilities,
  SshWorkspaceLayout,
  SshWorkspaceProps,
  WorkspaceSessionSeed,
  WorkspaceSessionSnapshot,
} from "@/lib/session/workspace"

export type SshWorkspaceSnapshotUpdater =
  | WorkspaceSessionSnapshot
  | ((snapshot: WorkspaceSessionSnapshot) => WorkspaceSessionSnapshot)

export interface SshWorkspaceContextValue {
  adapters: SshWorkspaceAdapters
  capabilities: SshWorkspaceCapabilities
  layout: SshWorkspaceLayout
  initialSessions: WorkspaceSessionSeed[]
  snapshot: WorkspaceSessionSnapshot
  updateSnapshot: (updater: SshWorkspaceSnapshotUpdater) => void
}

export interface SshWorkspaceRootProps extends SshWorkspaceProps {
  children?: ReactNode
}

const createEmptySnapshot = (adapters: SshWorkspaceAdapters): WorkspaceSessionSnapshot => ({
  terminalSessions: [],
  sftpSessions: [],
  transferTasks: adapters.transferManager?.tasks ?? [],
  activeSessionId: null,
})

const SshWorkspaceContext = createContext<SshWorkspaceContextValue | null>(null)

export function SshWorkspace({
  adapters,
  capabilities,
  initialSessions = [],
  layout = "web",
  onSessionChange,
  children,
}: SshWorkspaceRootProps) {
  const sessionStore = adapters.sessionStore
  const transferTasks = adapters.transferManager?.tasks

  const [snapshot, setSnapshot] = useState<WorkspaceSessionSnapshot>(() => (
    sessionStore?.getSnapshot() ?? createEmptySnapshot(adapters)
  ))

  const updateSnapshot = useCallback((updater: SshWorkspaceSnapshotUpdater) => {
    setSnapshot((current) => (
      typeof updater === "function"
        ? updater(current)
        : updater
    ))
  }, [])

  useEffect(() => {
    if (!sessionStore) {
      return
    }

    setSnapshot(sessionStore.getSnapshot())
    return sessionStore.subscribe?.((nextSnapshot) => {
      setSnapshot(nextSnapshot)
    })
  }, [sessionStore])

  useEffect(() => {
    setSnapshot((current) => ({
      ...current,
      transferTasks: transferTasks ?? current.transferTasks,
    }))
  }, [transferTasks])

  useEffect(() => {
    onSessionChange?.(snapshot)
  }, [onSessionChange, snapshot])

  const value = useMemo<SshWorkspaceContextValue>(() => ({
    adapters,
    capabilities,
    layout,
    initialSessions,
    snapshot,
    updateSnapshot,
  }), [adapters, capabilities, initialSessions, layout, snapshot, updateSnapshot])

  return (
    <SshWorkspaceContext.Provider value={value}>
      {children}
    </SshWorkspaceContext.Provider>
  )
}

export function useSshWorkspace() {
  const context = useContext(SshWorkspaceContext)
  if (!context) {
    throw new Error("useSshWorkspace must be used within SshWorkspace")
  }

  return context
}

export function useOptionalSshWorkspace() {
  return useContext(SshWorkspaceContext)
}
