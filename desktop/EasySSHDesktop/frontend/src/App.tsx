import { useEffect, useMemo, useState } from 'react'
import { DesktopRuntimeInfo, DesktopService } from '../bindings/github.com/easyssh/easyssh-desktop'

type ThemeMode = 'dark' | 'light'

const terminalLines = [
  '$ ssh deploy@production',
  'Connecting to production... ready',
  'Last login: Tue Jun 02 10:28:04 from EasySSH Desktop',
  '$ uptime',
  '10:28:09 up 28 days, 4:13, 2 users, load average: 0.18, 0.21, 0.19',
  '$ tail -f /var/log/app/current.log',
  '[info] workspace runtime: terminal + sftp + transfers',
  '[info] sftp pane mounted in page mode',
]

const transferTasks = [
  { name: 'release.tar.gz', status: 'uploading', progress: 68 },
  { name: 'backup.sql', status: 'queued', progress: 12 },
]

function App() {
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [runtime, setRuntime] = useState<DesktopRuntimeInfo | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    DesktopService.RuntimeInfo()
      .then((value) => setRuntime(value))
      .catch((error: unknown) => {
        console.error('[EasySSH Desktop] Failed to load runtime info:', error)
      })
  }, [])

  const capabilitySummary = useMemo(() => {
    if (!runtime) {
      return 'loading runtime'
    }

    return ['terminal', 'sftp', 'transfers']
      .filter((capability) => runtime.capabilities[capability])
      .join(' / ')
  }, [runtime])

  return (
    <main className={`desktop-shell theme-${theme}`}>
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
            <div className="session-tabs">
              <button className="tab active" type="button">production</button>
              <button className="tab" type="button">staging</button>
              <button className="tab new-tab" type="button" aria-label="New session">+</button>
            </div>
            <div className="toolbar-meta">{capabilitySummary}</div>
          </div>

          <div className="terminal-surface">
            {terminalLines.map((line) => (
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
              <input value="production.internal" readOnly />
            </label>
            <label>
              <span>User</span>
              <input value="deploy" readOnly />
            </label>
            <button className="primary-action" type="button">Open Terminal</button>
          </section>

          <section className="file-pane">
            <div className="section-title">SFTP</div>
            <div className="file-row directory"><span>▸</span><span>/var/www</span></div>
            <div className="file-row"><span>·</span><span>current.log</span><small>2.4 MB</small></div>
            <div className="file-row"><span>·</span><span>release.tar.gz</span><small>86 MB</small></div>
          </section>

          <section className="transfer-pane">
            <div className="section-title">Transfers</div>
            {transferTasks.map((task) => (
              <div className="transfer-task" key={task.name}>
                <div className="transfer-header">
                  <span>{task.name}</span>
                  <small>{task.status}</small>
                </div>
                <div className="progress-track"><div style={{ width: `${task.progress}%` }} /></div>
              </div>
            ))}
          </section>
        </aside>
      </section>

      {settingsOpen && (
        <aside className="settings-popover" aria-label="Workspace settings panel">
          <div className="section-title">Workspace</div>
          <div className="settings-row"><span>Runtime</span><strong>{runtime?.profile ?? 'desktop'}</strong></div>
          <div className="settings-row"><span>Version</span><strong>{runtime?.version ?? '0.1.0'}</strong></div>
          <div className="settings-row"><span>Platform</span><strong>{runtime ? `${runtime.platform}/${runtime.arch}` : '-'}</strong></div>
          <div className="settings-row data-dir"><span>Data</span><strong>{runtime?.dataDir ?? '-'}</strong></div>
        </aside>
      )}
    </main>
  )
}

export default App
