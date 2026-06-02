"use client"

import { useEffect, useRef, useState, useCallback, useMemo, Suspense, startTransition } from "react"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"
import { SshWorkspace } from "@easyssh/ssh-workspace"
import { TerminalComponent } from "@/components/terminal/terminal-component"
import type { TerminalSettings } from "@/components/terminal/terminal-settings-dialog"
import type {
  TerminalSession,
  TerminalConnectionPhase,
} from "@/components/terminal/types"
import type { QuickServer } from "@/components/terminal/quick-connect"
import { serversApi, sftpApi, type Server } from "@/lib/api"
import { createAuthTicket } from "@/lib/auth-ticket"
import { createTerminalWorkspaceSessionControllerAdapter, createTerminalWorkspaceSessionStoreAdapter, useTerminalStore } from "@/stores/terminal-store"
import { createSftpSessionApi } from "@/lib/session/sftp-session-api"
import { createBrowserWorkspacePreferenceAdapter, createWorkspaceAdapters, createWorkspaceAuthTicketProviderAdapter, createWorkspaceI18nAdapter, createWorkspaceNotifierAdapter, createWorkspaceSettingsAdapter } from "@/lib/session/workspace-adapters"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"
import { useSystemConfig } from "@/contexts/system-config-context"
import { createWorkspaceCapabilitiesFromRuntime, useRuntime } from "@/shell/runtime"

const statusFromConnectionPhase = (phase: TerminalConnectionPhase) => {
  if (phase === "ready") return "connected" as const
  if (phase === "failed" || phase === "closed" || phase === "idle") return "disconnected" as const
  return "reconnecting" as const
}

const createQuickSession = (
  quickConnectName: string,
  id: string = "quick-initial"
): TerminalSession => {
  const now = Date.now()

  return {
    id,
    serverName: quickConnectName,
    host: "",
    port: undefined,
    username: "",
    shouldConnect: false,
    connectionPhase: "idle",
    status: "disconnected",
    lastActivity: now,
    type: "quick",
    pinned: false,
  }
}

const readTerminalBehaviorSettings = (defaults: { maxTabs: number; inactiveMinutes: number }) => {
  if (typeof window === "undefined") {
    return defaults
  }

  try {
    const saved = localStorage.getItem("terminal-settings")
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<TerminalSettings>
      return {
        maxTabs:
          typeof parsed.maxTabs === "number" && Number.isFinite(parsed.maxTabs)
            ? parsed.maxTabs
            : defaults.maxTabs,
        inactiveMinutes:
          typeof parsed.inactiveMinutes === "number" && Number.isFinite(parsed.inactiveMinutes)
            ? parsed.inactiveMinutes
            : defaults.inactiveMinutes,
      }
    }

    const legacyMaxTabs = Number(localStorage.getItem("tab.maxTabs") || defaults.maxTabs)
    const legacyInactiveMinutes = Number(
      localStorage.getItem("tab.inactiveMinutes") || defaults.inactiveMinutes
    )

    return {
      maxTabs: Number.isFinite(legacyMaxTabs) ? legacyMaxTabs : defaults.maxTabs,
      inactiveMinutes: Number.isFinite(legacyInactiveMinutes)
        ? legacyInactiveMinutes
        : defaults.inactiveMinutes,
    }
  } catch {
    return defaults
  }
}

function TerminalPageContent() {
  const { ready } = useAuthReady()
  const { config: systemConfig } = useSystemConfig()
  const { runtime } = useRuntime()
  const tCommon = useTranslations("common")
  const t = useTranslations("terminal")
  const tSftp = useTranslations("sftp")
  const quickConnectName = t("quickConnectTabName")
  const [servers, setServers] = useState<QuickServer[]>([])
  const [loading, setLoading] = useState(true)
  const [maxTabs, setMaxTabs] = useState(50)
  const [inactiveMinutes, setInactiveMinutes] = useState(60)
  const inactivityNotifiedRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const missingServerToastRef = useRef<Set<string>>(new Set())

  const sessions = useTerminalStore((state) => state.sessions)
  const activeSessionId = useTerminalStore((state) => state.activeSessionId)
  const setSessions = useTerminalStore((state) => state.setSessions)
  const setActiveSessionId = useTerminalStore((state) => state.setActiveSessionId)
  const updateSessionActivity = useTerminalStore((state) => state.updateSessionActivity)
  const getSessionLastActivity = useTerminalStore((state) => state.getSessionLastActivity)
  const workspaceSessionStore = useMemo(() => createTerminalWorkspaceSessionStoreAdapter(), [])
  const workspaceSessionController = useMemo(() => createTerminalWorkspaceSessionControllerAdapter(), [])
  const workspaceAuthTicketProvider = useMemo(() => createWorkspaceAuthTicketProviderAdapter(createAuthTicket), [])
  const sftpSessionApi = useMemo(() => createSftpSessionApi(sftpApi), [])
  const workspacePreferences = useMemo(() => createBrowserWorkspacePreferenceAdapter(), [])
  const workspaceAdapters = useMemo(() => createWorkspaceAdapters({
    apiClient: {
      sftp: sftpSessionApi,
      terminal: {
        saveVerifiedCredential: ({ serverId, authMethod, secret }) => {
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
      },
    },
    i18n: createWorkspaceI18nAdapter({
      common: tCommon,
      terminal: t,
      sftp: tSftp,
    }),
    notifier: createWorkspaceNotifierAdapter(toast),
    settings: createWorkspaceSettingsAdapter({
      sftp: {
        downloadExcludePatterns: systemConfig?.download_exclude_patterns,
      },
    }),
    preferences: workspacePreferences,
    authTicketProvider: workspaceAuthTicketProvider,
    sessionStore: workspaceSessionStore,
    sessionController: workspaceSessionController,
  }), [tCommon, t, tSftp, systemConfig?.download_exclude_patterns, sftpSessionApi, workspaceAuthTicketProvider, workspacePreferences, workspaceSessionController, workspaceSessionStore])
  const workspaceCapabilities = useMemo(() => createWorkspaceCapabilitiesFromRuntime(runtime, {
    defaults: {
      terminal: true,
      sftp: true,
      transfers: true,
      ai: true,
      monitor: true,
      docker: true,
      activityLog: false,
      fullscreen: true,
    },
  }), [runtime])
  const tabPolicyMaxTabs = systemConfig?.tab_session?.max_tabs ?? 50
  const tabPolicyInactiveMinutes = systemConfig?.tab_session?.inactive_minutes ?? 60

  const applyTerminalBehaviorSettings = useCallback(
    (settings: { maxTabs: number; inactiveMinutes: number }) => {
      setMaxTabs(Math.max(1, Math.min(settings.maxTabs, tabPolicyMaxTabs)))
      setInactiveMinutes(Math.max(5, Math.min(settings.inactiveMinutes, tabPolicyInactiveMinutes)))
    },
    [tabPolicyMaxTabs, tabPolicyInactiveMinutes]
  )

  const resetToQuickSession = useCallback(() => {
    const quickSession = createQuickSession(quickConnectName, `quick-${Date.now()}`)
    setSessions([quickSession])
    setActiveSessionId(quickSession.id)
    updateSessionActivity(quickSession.id, quickSession.lastActivity)
  }, [quickConnectName, setActiveSessionId, setSessions, updateSessionActivity])

  // 初始化终端页签元数据。切换到其他菜单再回来时，如果 store 里已有页签，不重建快速连接。
  useEffect(() => {
    if (!ready || initializedRef.current) return
    initializedRef.current = true

    let pendingServerId: string | null = null
    let pendingServerName = ""

    if (typeof window !== "undefined") {
      const pendingConnection = sessionStorage.getItem("pendingConnection")
      if (pendingConnection) {
        try {
          const data = JSON.parse(pendingConnection)
          pendingServerId = data.server
          pendingServerName = data.name || ""
          sessionStorage.removeItem("pendingConnection")
        } catch (error) {
          console.error("Failed to parse pending connection:", error)
        }
      }
    }

    if (pendingServerId) {
      const now = Date.now()
      const reusableQuickSession = sessions.find(
        (session) => session.type === "quick" && session.id === activeSessionId
      ) ?? sessions.find((session) => session.type === "quick")
      const reusableQuickSessionId = reusableQuickSession?.id
      const sessionId = reusableQuickSessionId ?? `auto-${pendingServerId}-${now}`
      const pendingSession: TerminalSession = {
        id: sessionId,
        serverId: pendingServerId,
        serverName: pendingServerName,
        host: "",
        port: undefined,
        username: "",
        shouldConnect: false,
        connectionPhase: "idle",
        status: "reconnecting",
        lastActivity: now,
        type: "terminal",
        pinned: false,
      }

      setSessions((prev) => {
        if (!reusableQuickSessionId) {
          return [...prev, pendingSession]
        }

        let replaced = false
        const next = prev.map((session) => {
          if (session.id !== reusableQuickSessionId) {
            return session
          }

          replaced = true
          return pendingSession
        })

        return replaced ? next : [...prev, pendingSession]
      })
      setActiveSessionId(sessionId)
      updateSessionActivity(sessionId, now)
      return
    }

    if (sessions.length === 0) {
      const quickSession = createQuickSession(quickConnectName)
      setSessions([quickSession])
      setActiveSessionId(quickSession.id)
      updateSessionActivity(quickSession.id, quickSession.lastActivity)
      return
    }

    if (!activeSessionId || !sessions.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(sessions[0]?.id ?? null)
    }
  }, [
    activeSessionId,
    quickConnectName,
    ready,
    sessions,
    setActiveSessionId,
    setSessions,
    updateSessionActivity,
  ])

  // 加载服务器列表
  const loadServers = useCallback(async () => {
    try {
      setLoading(true)

      const response = await serversApi.list({
        page: 1,
        limit: 100,
      })

      const serverList = Array.isArray(response)
        ? response
        : (response?.data || [])

      const quickServers: QuickServer[] = serverList.map((server: Server) => ({
        id: String(server.id),
        name: server.name || `${server.username}@${server.host}:${server.port}`,
        host: server.host,
        port: server.port,
        username: server.username,
        status: server.status === "online" ? "online" : "offline",
        group: server.group,
        tags: server.tags,
        last_connected: server.last_connected,
      }))

      startTransition(() => {
        setServers(quickServers)
        setLoading(false)
      })
    } catch (error: unknown) {
      console.error("Failed to load servers:", error)
      toast.error(getErrorMessage(error, t("errorLoadServers")))
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      void loadServers()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadServers, ready])

  // 待连接会话先以 serverId 占位创建，服务器列表加载后补齐连接信息。
  useEffect(() => {
    if (loading || servers.length === 0) return

    setSessions((prev) => {
      let changed = false

      const next = prev.map((session) => {
        if (
          session.type !== "terminal" ||
          !session.serverId ||
          session.host
        ) {
          return session
        }

        const server = servers.find((item) => item.id === String(session.serverId))
        if (!server) {
          if (!missingServerToastRef.current.has(session.id)) {
            missingServerToastRef.current.add(session.id)
            toast.error(t("errorServerNotFound"))
          }

          changed = true
          return {
            ...createQuickSession(quickConnectName),
            id: session.id,
            lastActivity: session.lastActivity,
          }
        }

        changed = true
        return {
          ...session,
          serverId: server.id,
          serverName: server.name || `${server.username}@${server.host}:${server.port}`,
          host: server.host,
          port: server.port,
          username: server.username,
          shouldConnect: true,
          connectionPhase: "idle" as const,
          status: "reconnecting" as const,
          group: server.group,
          tags: server.tags,
        }
      })

      return changed ? next : prev
    })
  }, [loading, quickConnectName, servers, setSessions, t])

  // 读取终端行为设置，和终端设置弹窗使用同一个 localStorage key。
  useEffect(() => {
    const loadSettings = () => {
      const settings = readTerminalBehaviorSettings({
        maxTabs: tabPolicyMaxTabs,
        inactiveMinutes: tabPolicyInactiveMinutes,
      })
      applyTerminalBehaviorSettings(settings)
    }

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      requestIdleCallback(loadSettings)
    } else {
      setTimeout(loadSettings, 0)
    }
  }, [applyTerminalBehaviorSettings, tabPolicyInactiveMinutes, tabPolicyMaxTabs])

  const handleNewSession = (): string | void => {
    if (sessions.length >= maxTabs) {
      toast.error(t("errorMaxTabsReached", { max: maxTabs }))
      return
    }

    const now = Date.now()
    const id = `quick-${now}`
    const newTab: TerminalSession = {
      id,
      serverName: quickConnectName,
      host: "",
      username: "",
      shouldConnect: false,
      connectionPhase: "idle",
      status: "disconnected",
      lastActivity: now,
      type: "quick",
      pinned: false,
    }

    setSessions((prev) => [...prev, newTab])
    setActiveSessionId(id)
    updateSessionActivity(id, now)
    return id
  }

  const handleStartConnectionFromQuick = (sessionId: string, server: QuickServer) => {
    const now = Date.now()
    const terminalStore = useTerminalStore.getState()

    startTransition(() => {
      const terminalInstance = terminalStore.getTerminal(sessionId)
      if (terminalInstance) {
        terminalStore.setTerminal(sessionId, {
          ...terminalInstance,
          serverId: String(server.id),
        })
      }

      setSessions((prev) => prev.map((session) => session.id === sessionId ? {
        id: sessionId,
        serverId: String(server.id),
        serverName: server.name || `${server.username}@${server.host}:${server.port}`,
        host: server.host,
        port: server.port,
        username: server.username,
        shouldConnect: true,
        connectionPhase: "idle",
        status: "reconnecting",
        lastActivity: now,
        group: server.group,
        tags: server.tags,
        pinned: false,
        type: "terminal",
      } : session))

      setActiveSessionId(sessionId)
      updateSessionActivity(sessionId, now)

      setTimeout(() => {
        startTransition(() => {
          void loadServers()
        })
      }, 1000)
    })
  }

  const handleCloseSession = useCallback((sessionId: string) => {
    if (sessions.length <= 1) {
      resetToQuickSession()
      return
    }

    const currentIndex = sessions.findIndex((session) => session.id === sessionId)
    const isClosingActive = activeSessionId === sessionId

    if (isClosingActive && currentIndex !== -1) {
      const nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : currentIndex - 1
      setActiveSessionId(sessions[nextIndex]?.id ?? null)
    }

    setSessions((prev) => prev.filter((session) => session.id !== sessionId))
  }, [
    activeSessionId,
    resetToQuickSession,
    sessions,
    setActiveSessionId,
    setSessions,
  ])

  const handleDuplicateSession = (sessionId: string) => {
    const src = sessions.find((session) => session.id === sessionId)
    if (!src) return
    if (sessions.length >= maxTabs) {
      toast.error(t("errorMaxTabsReached", { max: maxTabs }))
      return
    }

    const now = Date.now()
    const dup: TerminalSession = {
      ...src,
      id: `session-${now}`,
      lastActivity: now,
      pinned: false,
      connectionPhase: src.type === "terminal" ? "idle" : src.connectionPhase,
      status: src.type === "terminal" ? "reconnecting" : src.status,
    }

    setSessions((prev) => [...prev, dup])
    setActiveSessionId(dup.id)
    updateSessionActivity(dup.id, now)
  }

  const handleCloseOthers = (sessionId: string) => {
    setSessions((prev) => prev.filter((session) => session.id === sessionId || session.pinned))
    setActiveSessionId(sessionId)
  }

  const handleCloseAll = () => {
    const next = sessions.filter((session) => session.pinned)
    if (next.length === 0) {
      resetToQuickSession()
      return
    }

    setSessions(next)
    setActiveSessionId(next[0].id)
  }

  const handleTogglePin = (sessionId: string) => {
    setSessions((prev) => prev.map((session) => (
      session.id === sessionId
        ? { ...session, pinned: !session.pinned }
        : session
    )))
  }

  const handleConnectionPhaseChange = useCallback((sessionId: string, phase: TerminalConnectionPhase) => {
    setSessions((prev) => prev.map((session) => {
      if (session.id !== sessionId) return session

      return {
        ...session,
        connectionPhase: phase,
        status: statusFromConnectionPhase(phase),
      }
    }))

    if (phase === "ready") {
      updateSessionActivity(sessionId)
    }
  }, [setSessions, updateSessionActivity])

  const handleAuthCancelled = useCallback((sessionId: string) => {
    const terminalStore = useTerminalStore.getState()
    terminalStore.destroySession(sessionId)

    const now = Date.now()
    setSessions((prev) => prev.map((session) => {
      if (session.id !== sessionId) return session

      return {
        ...createQuickSession(quickConnectName, sessionId),
        lastActivity: now,
      }
    }))
    updateSessionActivity(sessionId, now)
  }, [quickConnectName, setSessions, updateSessionActivity])

  const handleReorder = (newOrderIds: string[]) => {
    const map = new Map(sessions.map((session) => [session.id, session]))
    const newList = newOrderIds.map((id) => map.get(id)!).filter(Boolean)
    if (newList.length === sessions.length) setSessions(newList)
  }

  const handleSendCommand = (sessionId: string, command: string) => {
    if (process.env.NODE_ENV === "development" && command.trim()) {
      // console.log(`Session ${sessionId}: ${command}`)
    }

    updateSessionActivity(sessionId)
    inactivityNotifiedRef.current.delete(sessionId)
  }

  const sessionsRef = useRef(sessions)
  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      const threshold = inactiveMinutes * 60 * 1000

      sessionsRef.current.forEach((session) => {
        const lastActivity = getSessionLastActivity(session.id) ?? session.lastActivity
        if (now - lastActivity >= threshold && !inactivityNotifiedRef.current.has(session.id)) {
          inactivityNotifiedRef.current.add(session.id)
          toast(t("inactiveToastTitle", { name: session.serverName }), {
            description: t("inactiveToastDescription", { minutes: inactiveMinutes }),
            action: { label: t("inactiveToastActionLabel"), onClick: () => handleCloseSession(session.id) },
          })
        }
      })
    }, 60 * 1000)

    return () => clearInterval(timer)
  }, [getSessionLastActivity, handleCloseSession, inactiveMinutes, t])

  return (
    <SshWorkspace
      adapters={workspaceAdapters}
      capabilities={workspaceCapabilities}
      layout="web"
    >
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TerminalComponent
          sessions={sessions}
          onNewSession={handleNewSession}
          onCloseSession={handleCloseSession}
          onSendCommand={handleSendCommand}
          onDuplicateSession={handleDuplicateSession}
          onCloseOthers={handleCloseOthers}
          onCloseAll={handleCloseAll}
          onTogglePin={handleTogglePin}
          onReorderSessions={handleReorder}
          onStartConnectionFromQuick={handleStartConnectionFromQuick}
          onAuthCancelled={handleAuthCancelled}
          servers={servers}
          serversLoading={loading}
          externalActiveSessionId={activeSessionId}
          onActiveSessionChange={setActiveSessionId}
          onConnectionPhaseChange={handleConnectionPhaseChange}
          onBehaviorSettingsChange={applyTerminalBehaviorSettings}
        />
      </div>
    </SshWorkspace>
  )
}

export default function TerminalPage() {
  const tCommon = useTranslations("common")
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center">{tCommon("loading")}</div>}>
      <TerminalPageContent />
    </Suspense>
  )
}
