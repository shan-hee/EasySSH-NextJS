import { create } from "zustand"
import type { SftpWorkspaceSession, SshWorkspaceSessionStoreAdapter, WorkspaceSessionSnapshot, WorkspaceTransferTask } from "@/lib/session/workspace"

export type { SftpWorkspaceSession } from "@/lib/session/workspace"

interface SftpSessionStoreState {
  sessions: SftpWorkspaceSession[]
  nextSessionId: number
  fullscreenSessionId: string | null
  activeId: string | null
  sessionsById: Record<string, SftpWorkspaceSession>

  setSessions: (updater: SftpWorkspaceSession[] | ((sessions: SftpWorkspaceSession[]) => SftpWorkspaceSession[])) => void
  setNextSessionId: (updater: number | ((value: number) => number)) => void
  setFullscreenSessionId: (sessionId: string | null | ((value: string | null) => string | null)) => void
  setActiveId: (sessionId: string | null | ((value: string | null) => string | null)) => void
  resetWorkspaceState: () => void
}

const toLookup = (sessions: SftpWorkspaceSession[]) =>
  sessions.reduce<Record<string, SftpWorkspaceSession>>((acc, session) => {
    acc[session.id] = session
    return acc
  }, {})

export const useSftpSessionStore = create<SftpSessionStoreState>((set) => ({
  sessions: [],
  nextSessionId: 1,
  fullscreenSessionId: null,
  activeId: null,
  sessionsById: {},

  setSessions: (updater) => {
    set((state) => {
      const sessions = typeof updater === "function" ? updater(state.sessions) : updater
      return {
        sessions,
        sessionsById: toLookup(sessions),
      }
    })
  },

  setNextSessionId: (updater) => {
    set((state) => ({
      nextSessionId: typeof updater === "function" ? updater(state.nextSessionId) : updater,
    }))
  },

  setFullscreenSessionId: (updater) => {
    set((state) => ({
      fullscreenSessionId: typeof updater === "function" ? updater(state.fullscreenSessionId) : updater,
    }))
  },

  setActiveId: (updater) => {
    set((state) => ({
      activeId: typeof updater === "function" ? updater(state.activeId) : updater,
    }))
  },

  resetWorkspaceState: () => {
    set({
      sessions: [],
      nextSessionId: 1,
      fullscreenSessionId: null,
      activeId: null,
      sessionsById: {},
    })
  },
}))

export function createSftpWorkspaceSessionStoreAdapter(
  getTransferTasks: () => WorkspaceTransferTask[] = () => [],
): SshWorkspaceSessionStoreAdapter {
  return {
    getSnapshot: (): WorkspaceSessionSnapshot => {
      const state = useSftpSessionStore.getState()
      return {
        terminalSessions: [],
        sftpSessions: state.sessions,
        transferTasks: getTransferTasks(),
        activeSessionId: state.activeId,
      }
    },
    subscribe: (listener: (snapshot: WorkspaceSessionSnapshot) => void) => (
      useSftpSessionStore.subscribe((state) => {
        listener({
          terminalSessions: [],
          sftpSessions: state.sessions,
          transferTasks: getTransferTasks(),
          activeSessionId: state.activeId,
        })
      })
    ),
  }
}
