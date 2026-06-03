import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityLogService, DesktopActivityLogStatus, DesktopRuntimeInfo, DesktopService } from '../bindings/github.com/easyssh/easyssh-desktop'
import {
  DEFAULT_SFTP_DOWNLOAD_EXCLUDE_PATTERNS,
  createWorkspaceCapabilitiesFromRuntime,
  SshWorkspace,
  useOptionalSshWorkspace,
} from '@easyssh/ssh-workspace/desktop'
import type {
  SshWorkspaceAdapters,
  SshWorkspaceActivityLogAdapter,
  SshWorkspaceI18n,
  SshWorkspaceNotifier,
  SshWorkspacePreferenceAdapter,
  SshWorkspaceSessionController,
  SshWorkspaceThemeAdapter,
  SftpWorkspaceSession,
  WorkspaceSessionSeed,
  WorkspaceSessionSnapshot,
  WorkspaceTerminalSession,
  WorkspaceTransferTask,
  WorkspaceActivityLogItem,
  WorkspaceActivityLogListResult,
  WorkspaceActivityLogRecordInput,
  WorkspaceActivityLogStatistics,
  RuntimeInfo,
} from '@easyssh/ssh-workspace/desktop'

type ThemeMode = 'dark' | 'light'
type DensityMode = 'comfortable' | 'compact'
type SessionStatus = 'connected' | 'connecting' | 'idle'
type FileKind = 'directory' | 'file'
type TransferStatus = 'queued' | 'uploading' | 'completed' | 'cancelled'

interface WorkspaceFile {
  name: string
  kind: FileKind
  size: string
}

interface WorkspaceSession {
  id: string
  label: string
  host: string
  user: string
  path: string
  status: SessionStatus
  lastSeen: string
  lastActivity: number
  files: WorkspaceFile[]
  terminalLines: string[]
}

interface TransferTask {
  id: string
  name: string
  status: TransferStatus
  progress: number
  target: string
}

const emptyActivityStats: WorkspaceActivityLogStatistics = {
  total: 0,
  successCount: 0,
  failureCount: 0,
  byAction: {},
}

const activityActionLabels: Record<string, string> = {
  ssh_connect: 'SSH connect',
  ssh_disconnect: 'SSH disconnect',
  sftp_upload: 'SFTP upload',
  sftp_download: 'SFTP download',
  sftp_delete: 'SFTP delete',
  sftp_rename: 'SFTP rename',
  sftp_mkdir: 'SFTP mkdir',
  monitoring_query: 'Monitor query',
}

const formatActivityTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const toDesktopActivityStatus = (status?: WorkspaceActivityLogRecordInput['status']) => {
  switch (status) {
    case 'failure':
      return DesktopActivityLogStatus.DesktopActivityLogFailure
    case 'warning':
      return DesktopActivityLogStatus.DesktopActivityLogWarning
    case 'success':
    default:
      return DesktopActivityLogStatus.DesktopActivityLogSuccess
  }
}

const preferenceKeys = {
  theme: 'easyssh.desktop.theme',
  density: 'easyssh.desktop.density',
}

const readPreference = <T extends string>(key: string, fallback: T, allowed: readonly T[]) => {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = window.localStorage.getItem(key) as T | null
  return value && allowed.includes(value) ? value : fallback
}

const createFiles = (path: string): WorkspaceFile[] => [
  { name: path, kind: 'directory', size: '-' },
  { name: 'current.log', kind: 'file', size: '2.4 MB' },
  { name: 'release.tar.gz', kind: 'file', size: '86 MB' },
  { name: 'deploy.yaml', kind: 'file', size: '12 KB' },
]

const createTerminalLines = (user: string, host: string, path: string, status: SessionStatus) => {
  if (status === 'idle') {
    return [
      '$ ssh user@host',
      'Fill Quick Connect to open a workspace session.',
      '$',
    ]
  }

  if (status === 'connecting') {
    return [
      `$ ssh ${user}@${host}`,
      `Resolving ${host}...`,
      'Waiting for SSH handshake...',
    ]
  }

  return [
    `$ ssh ${user}@${host}`,
    `Connected to ${host}`,
    'Last login: Tue Jun 02 10:28:04 from EasySSH Desktop',
    `$ cd ${path}`,
    '$ uptime',
    '10:28:09 up 28 days, 4:13, 2 users, load average: 0.18, 0.21, 0.19',
    '$ tail -f current.log',
    '[info] workspace runtime: terminal + sftp + transfers',
    '[info] sftp pane mounted without dashboard shell',
  ]
}

const initialSessions: WorkspaceSession[] = [
  {
    id: 'production',
    label: 'production',
    host: 'production.internal',
    user: 'deploy',
    path: '/var/www',
    status: 'connected',
    lastSeen: 'active',
    lastActivity: Date.now() - 120000,
    files: createFiles('/var/www'),
    terminalLines: createTerminalLines('deploy', 'production.internal', '/var/www', 'connected'),
  },
  {
    id: 'staging',
    label: 'staging',
    host: 'staging.internal',
    user: 'deploy',
    path: '/srv/app',
    status: 'idle',
    lastSeen: 'ready',
    lastActivity: Date.now() - 240000,
    files: createFiles('/srv/app'),
    terminalLines: createTerminalLines('deploy', 'staging.internal', '/srv/app', 'idle'),
  },
]

const initialTransfers: TransferTask[] = [
  { id: 'release', name: 'release.tar.gz', status: 'uploading', progress: 68, target: 'production' },
  { id: 'backup', name: 'backup.sql', status: 'queued', progress: 12, target: 'staging' },
]

const cloneWorkspaceSession = (session: WorkspaceSession): WorkspaceSession => ({
  ...session,
  files: session.files.map((file) => ({ ...file })),
  terminalLines: [...session.terminalLines],
})

const cloneInitialWorkspaceSessions = () => initialSessions.map(cloneWorkspaceSession)

const normalizePath = (value: string) => {
  const path = value.trim() || '/'
  return path.startsWith('/') ? path : `/${path}`
}

const sessionIdFor = (user: string, host: string) => `${user}@${host}`.replace(/[^a-zA-Z0-9@._-]/g, '-')

const buildWorkspaceRuntime = (runtime: DesktopRuntimeInfo | null): RuntimeInfo | null => {
  if (!runtime) {
    return null
  }

  return {
    profile: runtime.profile === 'web' ? 'web' : 'desktop',
    principal: {
      kind: 'local_owner',
      role: 'owner',
    },
    single_user: true,
    portable: !!runtime.capabilities.portable_mode,
    managed: false,
    data_dir: runtime.dataDir,
    version: runtime.version,
    capabilities: runtime.capabilities,
  }
}

const mapSessionStatusToConnectionPhase = (status: SessionStatus) => {
  if (status === 'connected') {
    return 'ready' as const
  }

  if (status === 'connecting') {
    return 'ssh_connecting' as const
  }

  return 'idle' as const
}

const mapTerminalSessionToSessionStatus = (session: WorkspaceTerminalSession): SessionStatus => {
  if (session.status === 'connected' || session.connectionPhase === 'ready') {
    return 'connected'
  }

  if (
    session.shouldConnect ||
    session.status === 'reconnecting' ||
    session.connectionPhase === 'ticket' ||
    session.connectionPhase === 'ws_connecting' ||
    session.connectionPhase === 'ssh_connecting' ||
    session.connectionPhase === 'authenticating' ||
    session.connectionPhase === 'reconnecting'
  ) {
    return 'connecting'
  }

  return 'idle'
}

const mapSftpSessionToSessionStatus = (session: SftpWorkspaceSession): SessionStatus => {
  if (session.isLoading) {
    return 'connecting'
  }

  return session.isConnected ? 'connected' : 'idle'
}

const mapSessionToTerminalSession = (
  session: WorkspaceSession,
): WorkspaceTerminalSession => ({
  id: session.id,
  serverId: session.id,
  serverName: session.label,
  host: session.host,
  username: session.user,
  port: undefined,
  shouldConnect: session.status !== 'idle',
  connectionPhase: mapSessionStatusToConnectionPhase(session.status),
  status: session.status === 'connected' ? 'connected' : session.status === 'connecting' ? 'reconnecting' : 'disconnected',
  lastActivity: session.lastActivity,
  type: session.status === 'idle' ? 'config' : 'terminal',
  pinned: session.status === 'connected',
})

const mapSessionToSftpSession = (
  session: WorkspaceSession,
): SftpWorkspaceSession => ({
  id: session.id,
  serverId: session.id,
  serverName: session.label,
  host: session.host,
  username: session.user,
  label: session.label,
  color: session.status === 'connected' ? 'var(--ok)' : 'var(--muted)',
  currentPath: session.path,
  files: session.files.map((file) => ({
    name: file.name,
    type: file.kind,
    size: file.size,
    sizeBytes: file.kind === 'directory' ? 0 : Number.parseInt(file.size.replace(/[^0-9]/g, ''), 10) || 0,
    modified: session.lastSeen,
    permissions: file.kind === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--',
  })),
  isConnected: session.status === 'connected',
  isLoading: session.status === 'connecting',
})

const createWorkspaceSessionFromTerminalSession = (
  session: WorkspaceTerminalSession,
  fallback?: WorkspaceSession,
): WorkspaceSession => {
  const status = mapTerminalSessionToSessionStatus(session)
  const host = session.host || fallback?.host || 'localhost'
  const user = session.username || fallback?.user || 'user'
  const path = fallback?.path ?? '/home/user'
  const label = session.serverName || fallback?.label || host.split('.')[0] || session.id

  return {
    id: session.id,
    label,
    host,
    user,
    path,
    status,
    lastSeen: status === 'connected' ? 'active' : status === 'connecting' ? 'connecting' : 'ready',
    lastActivity: session.lastActivity ?? fallback?.lastActivity ?? Date.now(),
    files: fallback?.files.map((file) => ({ ...file })) ?? createFiles(path),
    terminalLines: createTerminalLines(user, host, path, status),
  }
}

const createWorkspaceSessionFromSftpSession = (
  session: SftpWorkspaceSession,
  fallback?: WorkspaceSession,
): WorkspaceSession => {
  const status = mapSftpSessionToSessionStatus(session)
  const host = session.host || fallback?.host || 'localhost'
  const user = session.username || fallback?.user || 'user'
  const path = session.currentPath || fallback?.path || '/'
  const label = session.label || session.serverName || fallback?.label || host.split('.')[0] || session.id
  const files = session.files.length > 0
    ? session.files.map((file) => ({
        name: file.name,
        kind: file.type,
        size: file.size,
      }))
    : fallback?.files.map((file) => ({ ...file })) ?? createFiles(path)

  return {
    id: session.id,
    label,
    host,
    user,
    path,
    status,
    lastSeen: status === 'connected' ? 'active' : status === 'connecting' ? 'connecting' : 'ready',
    lastActivity: fallback?.lastActivity ?? Date.now(),
    files,
    terminalLines: createTerminalLines(user, host, path, status),
  }
}

const mapTransferToWorkspaceTransferTask = (task: TransferTask): WorkspaceTransferTask => ({
  id: task.id,
  fileName: task.name,
  fileSize: `${task.progress}%`,
  fileSizeBytes: task.progress,
  progress: task.progress,
  status: task.status === 'completed'
    ? 'completed'
    : task.status === 'cancelled'
      ? 'cancelled'
      : task.status === 'queued'
        ? 'pending'
        : 'uploading',
  type: 'upload',
  sourceServer: 'desktop',
  targetServer: task.target,
  transferMethod: 'sftp',
  stage: 'http',
})

const buildWorkspaceSnapshot = (
  sessions: WorkspaceSession[],
  transfers: TransferTask[],
  activeSessionId: string | null,
): WorkspaceSessionSnapshot => ({
  terminalSessions: sessions.map(mapSessionToTerminalSession),
  sftpSessions: sessions.map(mapSessionToSftpSession),
  transferTasks: transfers.map(mapTransferToWorkspaceTransferTask),
  activeSessionId,
})

const buildWorkspaceSessionSeeds = (sessions: WorkspaceSession[]): WorkspaceSessionSeed[] => (
  sessions.map((session) => ({
    serverId: session.id,
    serverName: session.label,
    host: session.host,
    username: session.user,
    initialPath: session.path,
  }))
)

function WorkspaceMountBadge() {
  const workspace = useOptionalSshWorkspace()

  if (!workspace) {
    return null
  }

  return (
    <span className="workspace-badge">
      {workspace.layout} workspace · {workspace.snapshot.terminalSessions.length} terminals · {workspace.snapshot.sftpSessions.length} sftp · {workspace.snapshot.transferTasks.length} transfers
    </span>
  )
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => (
    readPreference(preferenceKeys.theme, 'dark', ['dark', 'light'])
  ))
  const [density, setDensity] = useState<DensityMode>(() => (
    readPreference(preferenceKeys.density, 'comfortable', ['comfortable', 'compact'])
  ))
  const [runtime, setRuntime] = useState<DesktopRuntimeInfo | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sessions, setSessions] = useState<WorkspaceSession[]>(() => cloneInitialWorkspaceSessions())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessions[0].id)
  const [transfers, setTransfers] = useState<TransferTask[]>(initialTransfers)
  const [quickHost, setQuickHost] = useState(initialSessions[0].host)
  const [quickUser, setQuickUser] = useState(initialSessions[0].user)
  const [quickPath, setQuickPath] = useState(initialSessions[0].path)
  const [activityItems, setActivityItems] = useState<WorkspaceActivityLogItem[]>([])
  const [activityStats, setActivityStats] = useState<WorkspaceActivityLogStatistics>(emptyActivityStats)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const transfersRef = useRef(transfers)
  transfersRef.current = transfers
  const completedTransferIdsRef = useRef(new Set<string>())
  const activeSessionIdRef = useRef<string | null>(activeSessionId)
  activeSessionIdRef.current = activeSessionId
  const workspaceRuntime = useMemo(() => buildWorkspaceRuntime(runtime), [runtime])
  const workspaceCapabilities = useMemo(() => createWorkspaceCapabilitiesFromRuntime(workspaceRuntime, {
    defaults: {
      terminal: true,
      sftp: true,
      transfers: true,
      ai: true,
      monitor: true,
      docker: true,
      activityLog: true,
      fullscreen: true,
      crossSessionDrag: true,
    },
  }), [workspaceRuntime])
  const workspaceSnapshot = useMemo(
    () => buildWorkspaceSnapshot(sessions, transfers, activeSessionId),
    [activeSessionId, sessions, transfers],
  )
  const workspaceSnapshotRef = useRef(workspaceSnapshot)
  workspaceSnapshotRef.current = workspaceSnapshot
  const workspaceSnapshotListenersRef = useRef(new Set<(snapshot: WorkspaceSessionSnapshot) => void>())

  useEffect(() => {
    workspaceSnapshotListenersRef.current.forEach((listener) => {
      listener(workspaceSnapshotRef.current)
    })
  }, [workspaceSnapshot])

  const workspaceSessionStore = useMemo<SshWorkspaceAdapters["sessionStore"]>(() => ({
    getSnapshot: () => workspaceSnapshotRef.current,
    subscribe: (listener) => {
      workspaceSnapshotListenersRef.current.add(listener)
      listener(workspaceSnapshotRef.current)
      return () => {
        workspaceSnapshotListenersRef.current.delete(listener)
      }
    },
  }), [])

  const syncWorkspaceSelection = useCallback((nextSessions: WorkspaceSession[], preferredSessionId: string | null = activeSessionIdRef.current) => {
    const resolvedSession = nextSessions.find((session) => session.id === preferredSessionId)
      ?? nextSessions[0]
      ?? null

    setActiveSessionId(resolvedSession?.id ?? null)

    if (resolvedSession) {
      setQuickHost(resolvedSession.host)
      setQuickUser(resolvedSession.user)
      setQuickPath(resolvedSession.path)
      return
    }

    setQuickHost('localhost')
    setQuickUser('user')
    setQuickPath('/')
  }, [])

  const commitWorkspaceSessions = useCallback((nextSessions: WorkspaceSession[], preferredSessionId: string | null = activeSessionIdRef.current) => {
    setSessions(nextSessions)
    syncWorkspaceSelection(nextSessions, preferredSessionId)
  }, [syncWorkspaceSelection])

  const activateWorkspaceSession = useCallback((sessionId: string | null) => {
    syncWorkspaceSelection(sessionsRef.current, sessionId)
  }, [syncWorkspaceSelection])

  const closeWorkspaceSession = useCallback((sessionId: string) => {
    const remainingSessions = sessionsRef.current.filter((session) => session.id !== sessionId)
    commitWorkspaceSessions(remainingSessions, activeSessionIdRef.current === sessionId ? null : activeSessionIdRef.current)
  }, [commitWorkspaceSessions])

  const resetWorkspaceSessions = useCallback(() => {
    const nextSessions = cloneInitialWorkspaceSessions()
    commitWorkspaceSessions(nextSessions, nextSessions[0]?.id ?? null)
  }, [commitWorkspaceSessions])

  const workspaceSessionController = useMemo<SshWorkspaceSessionController>(() => ({
    terminal: {
      getSessions: () => workspaceSnapshotRef.current.terminalSessions,
      getActiveSessionId: () => activeSessionIdRef.current,
      setSessions: (updater) => {
        const currentSessions = sessionsRef.current
        const currentTerminalSessions = currentSessions.map(mapSessionToTerminalSession)
        const nextTerminalSessions = typeof updater === 'function'
          ? updater(currentTerminalSessions)
          : updater

        const nextSessions = nextTerminalSessions.map((session) => createWorkspaceSessionFromTerminalSession(
          session,
          currentSessions.find((item) => item.id === session.id),
        ))

        commitWorkspaceSessions(nextSessions, activeSessionIdRef.current)
      },
      addSession: (session) => {
        const currentSessions = sessionsRef.current
        const nextSession = createWorkspaceSessionFromTerminalSession(
          session,
          currentSessions.find((item) => item.id === session.id),
        )
        const nextSessions = currentSessions.some((item) => item.id === session.id)
          ? currentSessions.map((item) => item.id === session.id ? nextSession : item)
          : [...currentSessions, nextSession]

        commitWorkspaceSessions(nextSessions, session.id)
      },
      updateSession: (sessionId, update) => {
        const currentSessions = sessionsRef.current
        const nextSessions = currentSessions.map((session) => {
          if (session.id !== sessionId) {
            return session
          }

          return createWorkspaceSessionFromTerminalSession({
            ...mapSessionToTerminalSession(session),
            ...update,
          }, session)
        })

        commitWorkspaceSessions(nextSessions, activeSessionIdRef.current)
      },
      activateSession: activateWorkspaceSession,
      closeSession: closeWorkspaceSession,
      reset: resetWorkspaceSessions,
    },
    sftp: {
      getSessions: () => workspaceSnapshotRef.current.sftpSessions,
      getActiveSessionId: () => activeSessionIdRef.current,
      setSessions: (updater) => {
        const currentSessions = sessionsRef.current
        const currentSftpSessions = currentSessions.map(mapSessionToSftpSession)
        const nextSftpSessions = typeof updater === 'function'
          ? updater(currentSftpSessions)
          : updater

        const nextSessions = nextSftpSessions.map((session) => createWorkspaceSessionFromSftpSession(
          session,
          currentSessions.find((item) => item.id === session.id),
        ))

        commitWorkspaceSessions(nextSessions, activeSessionIdRef.current)
      },
      addSession: (session) => {
        const currentSessions = sessionsRef.current
        const nextSession = createWorkspaceSessionFromSftpSession(
          session,
          currentSessions.find((item) => item.id === session.id),
        )
        const nextSessions = currentSessions.some((item) => item.id === session.id)
          ? currentSessions.map((item) => item.id === session.id ? nextSession : item)
          : [...currentSessions, nextSession]

        commitWorkspaceSessions(nextSessions, session.id)
      },
      updateSession: (sessionId, update) => {
        const currentSessions = sessionsRef.current
        const nextSessions = currentSessions.map((session) => {
          if (session.id !== sessionId) {
            return session
          }

          return createWorkspaceSessionFromSftpSession({
            ...mapSessionToSftpSession(session),
            ...update,
          }, session)
        })

        commitWorkspaceSessions(nextSessions, activeSessionIdRef.current)
      },
      activateSession: activateWorkspaceSession,
      closeSession: closeWorkspaceSession,
      setFullscreenSession: activateWorkspaceSession,
      reset: resetWorkspaceSessions,
    },
    resetAll: resetWorkspaceSessions,
  }), [activateWorkspaceSession, closeWorkspaceSession, commitWorkspaceSessions, resetWorkspaceSessions])

  const workspaceI18n = useMemo<SshWorkspaceI18n>(() => ({
    locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    t: (_namespace, key) => key,
  }), [])
  const workspaceNotifier = useMemo<SshWorkspaceNotifier>(() => ({
    success: (message) => {
      console.info('[EasySSH Desktop]', message)
    },
    error: (message) => {
      console.error('[EasySSH Desktop]', message)
    },
    promise: <T,>(promise: Promise<T>, messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: unknown) => string)
    }) => {
      void messages
      return promise
    },
  }), [])
  const workspacePreferences = useMemo<SshWorkspacePreferenceAdapter>(() => ({
    getString: (key) => {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setString: (key, value) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        void key
        void value
      }
    },
    removeString: (key) => {
      try {
        window.localStorage.removeItem(key)
      } catch {
        void key
      }
    },
  }), [])
  const workspaceTheme = useMemo<SshWorkspaceThemeAdapter>(() => ({
    mode: theme,
    terminalTheme: theme === 'dark' ? 'dark' : 'light',
  }), [theme])
  const workspaceSettings = useMemo(() => ({
    sftp: {
      downloadExcludePatterns: DEFAULT_SFTP_DOWNLOAD_EXCLUDE_PATTERNS,
    },
  }), [])
  const workspaceSessionSeeds = useMemo(() => buildWorkspaceSessionSeeds(sessions), [sessions])

  const loadActivityLog = useCallback(async () => {
    try {
      setActivityLoading(true)
      setActivityError(null)
      const [listResult, statistics] = await Promise.all([
        ActivityLogService.List({ page: 1, limit: 8 }) as Promise<WorkspaceActivityLogListResult>,
        ActivityLogService.GetStatistics({}) as Promise<WorkspaceActivityLogStatistics>,
      ])

      setActivityItems(listResult.items ?? [])
      setActivityStats({
        ...emptyActivityStats,
        ...statistics,
        byAction: statistics.byAction ?? {},
      })
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : 'Activity log unavailable')
    } finally {
      setActivityLoading(false)
    }
  }, [])

  const activityLogAdapter = useMemo<SshWorkspaceActivityLogAdapter>(() => ({
    list: async (params) => {
      const result = await ActivityLogService.List({
        page: params?.page,
        limit: params?.limit,
        action: params?.action,
        serverId: params?.serverId,
        status: params?.status ? toDesktopActivityStatus(params.status) : undefined,
        startDate: params?.startDate,
        endDate: params?.endDate,
      }) as WorkspaceActivityLogListResult

      return {
        ...result,
        items: result.items ?? [],
      }
    },
    getById: async (id) => ActivityLogService.GetById(id) as Promise<WorkspaceActivityLogItem>,
    getStatistics: async (params) => {
      const statistics = await ActivityLogService.GetStatistics({
        startDate: params?.startDate,
        endDate: params?.endDate,
      }) as WorkspaceActivityLogStatistics

      return {
        ...emptyActivityStats,
        ...statistics,
        byAction: statistics.byAction ?? {},
      }
    },
    record: async (input) => {
      const item = await ActivityLogService.Record({
        action: input.action,
        resource: input.resource,
        status: toDesktopActivityStatus(input.status),
        serverId: input.serverId,
        durationMs: input.durationMs,
        detail: input.detail,
      }) as WorkspaceActivityLogItem
      void loadActivityLog()
      return item
    },
    clear: async (before) => {
      const removed = await ActivityLogService.Clear(before ?? '')
      void loadActivityLog()
      return removed
    },
  }), [loadActivityLog])

  const recordActivity = useCallback((input: WorkspaceActivityLogRecordInput) => {
    void activityLogAdapter.record?.(input).catch((error: unknown) => {
      setActivityError(error instanceof Error ? error.message : 'Failed to record activity')
    })
  }, [activityLogAdapter])

  const clearActivityLog = useCallback(() => {
    if (activityStats.total < 1 || !window.confirm('Clear local activity history?')) {
      return
    }

    void activityLogAdapter.clear?.().catch((error: unknown) => {
      setActivityError(error instanceof Error ? error.message : 'Failed to clear activity')
    })
  }, [activityLogAdapter, activityStats.total])

  useEffect(() => {
    DesktopService.RuntimeInfo()
      .then((value) => setRuntime(value))
      .catch((error: unknown) => {
        console.error('[EasySSH Desktop] Failed to load runtime info:', error)
      })
  }, [])

  useEffect(() => {
    void loadActivityLog()
  }, [loadActivityLog])

  useEffect(() => {
    window.localStorage.setItem(preferenceKeys.theme, theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem(preferenceKeys.density, density)
  }, [density])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTransfers((current) => current.map((task) => {
        if (task.status !== 'uploading') {
          return task
        }

        const nextProgress = Math.min(task.progress + 3, 100)
        return {
          ...task,
          progress: nextProgress,
          status: nextProgress >= 100 ? 'completed' : 'uploading',
        }
      }))
    }, 1800)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    transfers.forEach((task) => {
      if (task.status !== 'completed' || completedTransferIdsRef.current.has(task.id)) {
        return
      }

      completedTransferIdsRef.current.add(task.id)
      recordActivity({
        action: 'sftp_upload',
        resource: task.name,
        status: 'success',
        serverId: task.target,
        detail: `Upload completed for ${task.target}`,
      })
    })
  }, [recordActivity, transfers])

  const activeSession = useMemo(() => (
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0]
  ), [activeSessionId, sessions])

  const capabilitySummary = useMemo(() => {
    if (!workspaceRuntime) {
      return 'loading runtime'
    }

    return ['terminal', 'sftp', 'transfers']
      .filter((capability) => workspaceCapabilities[capability])
      .join(' / ')
  }, [workspaceCapabilities, workspaceRuntime])

  const connectedCount = sessions.filter((session) => session.status === 'connected').length
  const activeTransfers = transfers.filter((task) => task.status === 'uploading' || task.status === 'queued').length
  const activitySuccessRate = activityStats.total > 0
    ? Math.round((activityStats.successCount / activityStats.total) * 100)
    : 0

  const openSession = useCallback(() => {
    const host = quickHost.trim() || 'localhost'
    const user = quickUser.trim() || 'user'
    const path = normalizePath(quickPath)
    const id = sessionIdFor(user, host)
    const label = host.split('.')[0] || host
    const session: WorkspaceSession = {
      id,
      label,
      host,
      user,
      path,
      status: 'connected',
      lastSeen: 'active',
      lastActivity: Date.now(),
      files: createFiles(path),
      terminalLines: createTerminalLines(user, host, path, 'connected'),
    }

    setSessions((current) => {
      const exists = current.some((item) => item.id === id)
      return exists
        ? current.map((item) => item.id === id ? session : item)
        : [...current, session]
    })
    setActiveSessionId(id)
    recordActivity({
      action: 'ssh_connect',
      resource: `${user}@${host}${path}`,
      status: 'success',
      serverId: id,
      detail: 'Desktop quick connect',
    })
  }, [quickHost, quickPath, quickUser, recordActivity])

  const createDraftSession = useCallback(() => {
    const index = sessions.length + 1
    const id = `draft-${Date.now()}`
    const session: WorkspaceSession = {
      id,
      label: `session-${index}`,
      host: 'new.server.local',
      user: 'user',
      path: '/home/user',
      status: 'idle',
      lastSeen: 'draft',
      lastActivity: Date.now(),
      files: createFiles('/home/user'),
      terminalLines: createTerminalLines('user', 'new.server.local', '/home/user', 'idle'),
    }

    setSessions((current) => [...current, session])
    setActiveSessionId(id)
    setQuickHost(session.host)
    setQuickUser(session.user)
    setQuickPath(session.path)
  }, [sessions.length])

  const queueTransfer = useCallback(() => {
    const target = activeSession?.label ?? 'workspace'
    const nextIndex = transfers.length + 1
    const name = `workspace-sync-${nextIndex}.tar.gz`
    setTransfers((current) => [{
      id: `task-${Date.now()}`,
      name,
      status: 'uploading',
      progress: 4,
      target,
    }, ...current])
    recordActivity({
      action: 'sftp_upload',
      resource: name,
      status: 'warning',
      serverId: target,
      detail: 'Upload queued in desktop workspace',
    })
  }, [activeSession?.label, recordActivity, transfers.length])

  const cancelTransfer = useCallback((taskId: string) => {
    const task = transfersRef.current.find((item) => item.id === taskId)
    setTransfers((current) => current.map((task) => (
      task.id === taskId && task.status !== 'completed'
        ? { ...task, status: 'cancelled', progress: 0 }
        : task
    )))
    if (task && task.status !== 'completed' && task.status !== 'cancelled') {
      recordActivity({
        action: 'sftp_upload',
        resource: task.name,
        status: 'failure',
        serverId: task.target,
        detail: 'Transfer cancelled',
      })
    }
  }, [recordActivity])

  const clearFinishedTransfers = useCallback(() => {
    setTransfers((current) => current.filter((task) => (
      task.status !== 'completed' && task.status !== 'cancelled'
    )))
  }, [])

  const workspaceTransferManager = useMemo(() => ({
    tasks: workspaceSnapshot.transferTasks,
    clearCompleted: clearFinishedTransfers,
    cancelTask: cancelTransfer,
  }), [clearFinishedTransfers, cancelTransfer, workspaceSnapshot.transferTasks])

  const workspaceAdapters = useMemo<SshWorkspaceAdapters>(() => ({
    i18n: workspaceI18n,
    notifier: workspaceNotifier,
    theme: workspaceTheme,
    panes: {
      fileManager: {
        mountMode: 'page',
        anchorTop: 0,
      },
    },
    settings: workspaceSettings,
    preferences: workspacePreferences,
    transferManager: workspaceTransferManager,
    activityLog: activityLogAdapter,
    sessionStore: workspaceSessionStore,
    sessionController: workspaceSessionController,
  }), [activityLogAdapter, workspaceI18n, workspaceNotifier, workspacePreferences, workspaceSettings, workspaceTheme, workspaceTransferManager, workspaceSessionStore, workspaceSessionController])

  return (
    <SshWorkspace
      adapters={workspaceAdapters}
      capabilities={workspaceCapabilities}
      initialSessions={workspaceSessionSeeds}
      layout="desktop"
    >
      <main className={`desktop-shell theme-${theme} density-${density}`}>
      <header className="titlebar">
        <div className="brand-block">
          <div className="brand-mark">E</div>
          <div>
            <div className="brand-title">EasySSH</div>
            <div className="brand-subtitle">SSH Workspace</div>
          </div>
        </div>

        <div className="window-actions" aria-label="Window tools">
          <button
            className="icon-button"
            type="button"
            title="Toggle theme"
            aria-label="Toggle theme"
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          >
            <span className={theme === 'dark' ? 'theme-icon moon' : 'theme-icon sun'} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Workspace settings"
            aria-label="Workspace settings"
            onClick={() => setSettingsOpen((current) => !current)}
          >
            <span className="settings-icon" />
          </button>
        </div>
      </header>

      <section className="workspace-grid">
        <section className="terminal-pane" aria-label="Terminal workspace">
          <div className="pane-toolbar">
            <div className="session-tabs" role="tablist" aria-label="SSH sessions">
              {sessions.map((session) => (
                <button
                  className={`tab ${session.id === activeSessionId ? 'active' : ''}`}
                  type="button"
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id)
                    setQuickHost(session.host)
                    setQuickUser(session.user)
                    setQuickPath(session.path)
                  }}
                >
                  <span className={`status-dot ${session.status}`} />
                  <span>{session.label}</span>
                </button>
              ))}
              <button className="tab new-tab" type="button" aria-label="New session" onClick={createDraftSession}>+</button>
            </div>
            <div className="toolbar-meta">{capabilitySummary}</div>
          </div>

          <div className="terminal-surface">
            {(activeSession?.terminalLines ?? []).map((line) => (
              <div className="terminal-line" key={line}>{line}</div>
            ))}
            <div className="terminal-line prompt"><span>$</span><span className="cursor" /></div>
          </div>
        </section>

        <aside className="side-pane" aria-label="SFTP and transfer workspace">
          <section className="quick-connect">
            <div className="section-title">Quick Connect</div>
            <label>
              <span>Host</span>
              <input value={quickHost} onChange={(event) => setQuickHost(event.target.value)} spellCheck={false} />
            </label>
            <label>
              <span>User</span>
              <input value={quickUser} onChange={(event) => setQuickUser(event.target.value)} spellCheck={false} />
            </label>
            <label>
              <span>Path</span>
              <input value={quickPath} onChange={(event) => setQuickPath(event.target.value)} spellCheck={false} />
            </label>
            <button className="primary-action" type="button" onClick={openSession}>Open Terminal</button>
          </section>

          <section className="file-pane">
            <div className="section-header">
              <div className="section-title">SFTP</div>
              <button className="text-action" type="button" onClick={queueTransfer}>Upload</button>
            </div>
            {(activeSession?.files ?? []).map((file) => (
              <div className={`file-row ${file.kind}`} key={`${file.name}-${file.size}`}>
                <span>{file.kind === 'directory' ? '/' : '-'}</span>
                <span>{file.name}</span>
                <small>{file.size}</small>
              </div>
            ))}
          </section>

          <section className="transfer-pane">
            <div className="section-header">
              <div className="section-title">Transfers</div>
              <button className="text-action" type="button" onClick={clearFinishedTransfers}>Clear</button>
            </div>
            <div className="transfer-list">
              {transfers.map((task) => (
                <div className={`transfer-task ${task.status}`} key={task.id}>
                  <div className="transfer-header">
                    <span>{task.name}</span>
                    <small>{task.status}</small>
                  </div>
                  <div className="progress-track"><div style={{ width: `${task.progress}%` }} /></div>
                  <div className="transfer-footer">
                    <small>{task.target}</small>
                    {task.status !== 'completed' && task.status !== 'cancelled' && (
                      <button className="inline-action" type="button" onClick={() => cancelTransfer(task.id)}>Cancel</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="activity-pane">
            <div className="section-header">
              <div className="section-title">Activity</div>
              <div className="activity-actions">
                <button className="text-action" type="button" onClick={() => void loadActivityLog()} disabled={activityLoading}>Refresh</button>
                <button className="text-action" type="button" onClick={clearActivityLog} disabled={activityStats.total < 1}>Clear</button>
              </div>
            </div>
            <div className="activity-summary">
              <div className="metric"><span>Total</span><strong>{activityStats.total}</strong></div>
              <div className="metric"><span>Success</span><strong>{activitySuccessRate}%</strong></div>
              <div className="metric"><span>Failed</span><strong>{activityStats.failureCount}</strong></div>
            </div>
            <div className="activity-list">
              {activityError ? (
                <div className="activity-empty error">{activityError}</div>
              ) : activityLoading && activityItems.length === 0 ? (
                <div className="activity-empty">Loading activity...</div>
              ) : activityItems.length === 0 ? (
                <div className="activity-empty">No local activity yet</div>
              ) : activityItems.map((item) => (
                <div className={`activity-row ${item.status}`} key={item.id}>
                  <span className="activity-status" />
                  <div>
                    <div className="activity-line">
                      <strong>{activityActionLabels[item.action] ?? item.action}</strong>
                      <small>{formatActivityTime(item.createdAt)}</small>
                    </div>
                    <div className="activity-resource" title={item.resource}>{item.resource || '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <footer className="status-strip" aria-label="Workspace status">
        <span>{connectedCount} connected</span>
        <span>{activeTransfers} active transfer</span>
        <span>{runtime ? `${runtime.platform}/${runtime.arch}` : 'runtime loading'}</span>
        <WorkspaceMountBadge />
      </footer>

      {settingsOpen && (
        <aside className="settings-popover" aria-label="Workspace settings panel">
          <div className="section-title">Workspace</div>
          <div className="settings-row"><span>Runtime</span><strong>{runtime?.profile ?? 'desktop'}</strong></div>
          <div className="settings-row"><span>Version</span><strong>{runtime?.version ?? '0.1.0'}</strong></div>
          <div className="settings-row"><span>Sessions</span><strong>{sessions.length}</strong></div>
          <div className="settings-row"><span>Density</span><button className="pill-action" type="button" onClick={() => setDensity((current) => current === 'compact' ? 'comfortable' : 'compact')}>{density}</button></div>
          <div className="settings-row data-dir"><span>Data</span><strong>{runtime?.dataDir ?? '-'}</strong></div>
        </aside>
      )}
      </main>
    </SshWorkspace>
  )
}

export default App
