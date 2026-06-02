import { useEffect, useMemo, useState } from 'react'
import { DesktopRuntimeInfo, DesktopService } from '../bindings/github.com/easyssh/easyssh-desktop'

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
    files: createFiles('/srv/app'),
    terminalLines: createTerminalLines('deploy', 'staging.internal', '/srv/app', 'idle'),
  },
]

const initialTransfers: TransferTask[] = [
  { id: 'release', name: 'release.tar.gz', status: 'uploading', progress: 68, target: 'production' },
  { id: 'backup', name: 'backup.sql', status: 'queued', progress: 12, target: 'staging' },
]

const normalizePath = (value: string) => {
  const path = value.trim() || '/'
  return path.startsWith('/') ? path : `/${path}`
}

const sessionIdFor = (user: string, host: string) => `${user}@${host}`.replace(/[^a-zA-Z0-9@._-]/g, '-')

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => (
    readPreference(preferenceKeys.theme, 'dark', ['dark', 'light'])
  ))
  const [density, setDensity] = useState<DensityMode>(() => (
    readPreference(preferenceKeys.density, 'comfortable', ['comfortable', 'compact'])
  ))
  const [runtime, setRuntime] = useState<DesktopRuntimeInfo | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sessions, setSessions] = useState<WorkspaceSession[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState(initialSessions[0].id)
  const [transfers, setTransfers] = useState<TransferTask[]>(initialTransfers)
  const [quickHost, setQuickHost] = useState(initialSessions[0].host)
  const [quickUser, setQuickUser] = useState(initialSessions[0].user)
  const [quickPath, setQuickPath] = useState(initialSessions[0].path)

  useEffect(() => {
    DesktopService.RuntimeInfo()
      .then((value) => setRuntime(value))
      .catch((error: unknown) => {
        console.error('[EasySSH Desktop] Failed to load runtime info:', error)
      })
  }, [])

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

  const activeSession = useMemo(() => (
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0]
  ), [activeSessionId, sessions])

  const capabilitySummary = useMemo(() => {
    if (!runtime) {
      return 'loading runtime'
    }

    return ['terminal', 'sftp', 'transfers']
      .filter((capability) => runtime.capabilities[capability])
      .join(' / ')
  }, [runtime])

  const connectedCount = sessions.filter((session) => session.status === 'connected').length
  const activeTransfers = transfers.filter((task) => task.status === 'uploading' || task.status === 'queued').length

  const openSession = () => {
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
  }

  const createDraftSession = () => {
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
      files: createFiles('/home/user'),
      terminalLines: createTerminalLines('user', 'new.server.local', '/home/user', 'idle'),
    }

    setSessions((current) => [...current, session])
    setActiveSessionId(id)
    setQuickHost(session.host)
    setQuickUser(session.user)
    setQuickPath(session.path)
  }

  const queueTransfer = () => {
    const target = activeSession?.label ?? 'workspace'
    const nextIndex = transfers.length + 1
    setTransfers((current) => [{
      id: `task-${Date.now()}`,
      name: `workspace-sync-${nextIndex}.tar.gz`,
      status: 'uploading',
      progress: 4,
      target,
    }, ...current])
  }

  const cancelTransfer = (taskId: string) => {
    setTransfers((current) => current.map((task) => (
      task.id === taskId && task.status !== 'completed'
        ? { ...task, status: 'cancelled', progress: 0 }
        : task
    )))
  }

  const clearFinishedTransfers = () => {
    setTransfers((current) => current.filter((task) => (
      task.status !== 'completed' && task.status !== 'cancelled'
    )))
  }

  return (
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
          </section>
        </aside>
      </section>

      <footer className="status-strip" aria-label="Workspace status">
        <span>{connectedCount} connected</span>
        <span>{activeTransfers} active transfer</span>
        <span>{runtime ? `${runtime.platform}/${runtime.arch}` : 'runtime loading'}</span>
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
  )
}

export default App
