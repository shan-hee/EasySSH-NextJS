# EasySSH Desktop

EasySSH Desktop is the Wails v3 shell for the embeddable SSH/SFTP workspace. The desktop home screen keeps the web terminal workspace shape, while moving dashboard navigation and administration concerns out of the first window.

## Scope

- Wails v3 desktop shell with a compact SSH/SFTP workspace first screen.
- Runtime bridge for platform, version, capability, and data directory information.
- Icon entry points for desktop-only controls such as theme and workspace settings.
- Production metadata for Windows, macOS, and Linux build assets.

## Build

From this directory:

```bash
/root/go/bin/wails3 task windows:build ARCH=386
```

The Windows x86 executable is written to `bin/easysshdesktop.exe`. The release zip is produced from the executable and supporting release metadata.

## Layout

- `main.go`: Wails application entry point and main window configuration.
- `desktopservice.go`: Desktop runtime bridge exposed to the frontend.
- `frontend/`: React/Vite workspace shell UI.
- `build/`: Wails platform build assets and packaging metadata.
