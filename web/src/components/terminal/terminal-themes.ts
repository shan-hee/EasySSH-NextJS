// 终端主题配置

import { colorToHex, contrastRatio, ensureContrast, hexToRgb, mixHexColors } from "@/lib/color-utils"

export interface TerminalTheme {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

// 暗色主题
export const darkTheme: TerminalTheme = {
  background: "#000000",
  foreground: "#d4d4d8", // zinc-300
  cursor: "#22c55e", // green-500
  cursorAccent: "#000000",
  selectionBackground: "#3f3f46", // zinc-700
  black: "#18181b", // zinc-900
  red: "#ef4444", // red-500
  green: "#22c55e", // green-500
  yellow: "#eab308", // yellow-500
  blue: "#3b82f6", // blue-500
  magenta: "#a855f7", // purple-500
  cyan: "#06b6d4", // cyan-500
  white: "#f4f4f5", // zinc-100
  brightBlack: "#52525b", // zinc-600
  brightRed: "#f87171", // red-400
  brightGreen: "#4ade80", // green-400
  brightYellow: "#facc15", // yellow-400
  brightBlue: "#60a5fa", // blue-400
  brightMagenta: "#c084fc", // purple-400
  brightCyan: "#22d3ee", // cyan-400
  brightWhite: "#fafafa", // zinc-50
}

// 亮色主题
export const lightTheme: TerminalTheme = {
  background: "#ffffff",
  foreground: "#27272a", // zinc-800
  cursor: "#16a34a", // green-600
  cursorAccent: "#ffffff",
  selectionBackground: "#e4e4e7", // zinc-200
  black: "#18181b", // zinc-900
  red: "#dc2626", // red-600
  green: "#16a34a", // green-600
  yellow: "#ca8a04", // yellow-600
  blue: "#2563eb", // blue-600
  magenta: "#9333ea", // purple-600
  cyan: "#0891b2", // cyan-600
  white: "#f4f4f5", // zinc-100
  brightBlack: "#71717a", // zinc-500
  brightRed: "#ef4444", // red-500
  brightGreen: "#22c55e", // green-500
  brightYellow: "#eab308", // yellow-500
  brightBlue: "#3b82f6", // blue-500
  brightMagenta: "#a855f7", // purple-500
  brightCyan: "#06b6d4", // cyan-500
  brightWhite: "#fafafa", // zinc-50
}

// Solarized 主题
export const solarizedTheme: TerminalTheme = {
  background: "#002b36",
  foreground: "#839496",
  cursor: "#839496",
  cursorAccent: "#002b36",
  selectionBackground: "#073642",
  black: "#073642",
  red: "#dc322f",
  green: "#859900",
  yellow: "#b58900",
  blue: "#268bd2",
  magenta: "#d33682",
  cyan: "#2aa198",
  white: "#eee8d5",
  brightBlack: "#002b36",
  brightRed: "#cb4b16",
  brightGreen: "#586e75",
  brightYellow: "#657b83",
  brightBlue: "#839496",
  brightMagenta: "#6c71c4",
  brightCyan: "#93a1a1",
  brightWhite: "#fdf6e3",
}

// Dracula 主题
export const draculaTheme: TerminalTheme = {
  background: "#282a36",
  foreground: "#f8f8f2",
  cursor: "#f8f8f2",
  cursorAccent: "#282a36",
  selectionBackground: "#44475a",
  black: "#21222c",
  red: "#ff5555",
  green: "#50fa7b",
  yellow: "#f1fa8c",
  blue: "#bd93f9",
  magenta: "#ff79c6",
  cyan: "#8be9fd",
  white: "#f8f8f2",
  brightBlack: "#6272a4",
  brightRed: "#ff6e6e",
  brightGreen: "#69ff94",
  brightYellow: "#ffffa5",
  brightBlue: "#d6acff",
  brightMagenta: "#ff92df",
  brightCyan: "#a4ffff",
  brightWhite: "#ffffff",
}

const THEME_COLOR_FALLBACKS = {
  light: lightTheme,
  dark: darkTheme,
} as const

type OklchColor = {
  l: number
  c: number
  h: number
}

function getCssThemeValue(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()

  return value || fallback
}

function getCssThemeColor(name: string, fallback: string): string {
  return colorToHex(getCssThemeValue(name, fallback))
}

function getSelectionBackground(background: string, accent: string, foreground: string): string {
  const accentSelection = mixHexColors(background, accent, 0.35)
  if (contrastRatio(accentSelection, background) >= 1.25) {
    return accentSelection
  }

  return mixHexColors(background, foreground, 0.2)
}

function getTerminalBackground(appTheme: 'light' | 'dark', themeBackground: string): string {
  const rawSource = themeBackground
  const oklch = parseOklchColor(rawSource)

  if (oklch) {
    const lightness = appTheme === 'light'
      ? clamp(oklch.l, 0.925, 0.985)
      : clamp(oklch.l * 0.65, 0.095, 0.2)
    const chroma = clamp(oklch.c * (appTheme === 'light' ? 0.85 : 0.55), 0, appTheme === 'light' ? 0.04 : 0.035)

    return colorToHex(`oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${oklch.h.toFixed(3)})`)
  }

  const source = colorToHex(rawSource)
  const neutralTarget = appTheme === 'light' ? "#ffffff" : "#000000"
  const neutralAmount = appTheme === 'light' ? 0.38 : 0.55

  return mixHexColors(source, neutralTarget, neutralAmount)
}

function parseOklchColor(value: string): OklchColor | null {
  const match = /oklch\(([^)]+)\)/i.exec(value)
  if (!match) {
    return null
  }

  const parts = match[1].split("/")[0].trim().split(/\s+/)
  if (parts.length < 3) {
    return null
  }

  const l = parts[0].endsWith("%") ? Number.parseFloat(parts[0]) / 100 : Number.parseFloat(parts[0])
  const c = Number.parseFloat(parts[1])
  const h = parts[2] === "none" ? 0 : Number.parseFloat(parts[2])

  if (![l, c, h].every((part) => Number.isFinite(part))) {
    return null
  }

  return { l, c, h }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isLightColor(color: string): boolean {
  const [r, g, b] = hexToRgb(color) ?? [255, 255, 255]
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]

  return luminance > 0.5
}

function getThemeGeneratorTerminalTheme(appTheme: 'light' | 'dark' = 'dark'): TerminalTheme {
  const initialFallback = THEME_COLOR_FALLBACKS[appTheme]
  const themeBackground = getCssThemeValue('background', initialFallback.background)
  const inferredAppTheme: 'light' | 'dark' = isLightColor(colorToHex(themeBackground)) ? 'light' : 'dark'
  const fallback = THEME_COLOR_FALLBACKS[inferredAppTheme]
  const background = getTerminalBackground(inferredAppTheme, themeBackground)
  const foreground = ensureContrast(getCssThemeColor('foreground', fallback.foreground), background, 7)
  const mutedForeground = ensureContrast(getCssThemeColor('muted-foreground', fallback.brightBlack), background, 3)
  const primary = ensureContrast(getCssThemeColor('primary', fallback.cursor), background, 3)
  const accent = getCssThemeColor('accent', fallback.selectionBackground)
  const destructive = ensureContrast(getCssThemeColor('destructive', fallback.red), background, 3)
  const connected = ensureContrast(getCssThemeColor('status-connected', fallback.green), background, 3)
  const warning = ensureContrast(getCssThemeColor('status-warning', fallback.yellow), background, 3)
  const blue = ensureContrast(getCssThemeColor('chart-1', fallback.blue), background, 3)
  const cyan = ensureContrast(getCssThemeColor('chart-2', fallback.cyan), background, 3)
  const magenta = ensureContrast(getCssThemeColor('chart-4', fallback.magenta), background, 3)
  const white = ensureContrast(foreground, background, 7)
  const black = ensureContrast(mixHexColors(background, foreground, inferredAppTheme === 'light' ? 0.85 : 0.18), background, 3)

  return {
    background,
    foreground,
    cursor: primary,
    cursorAccent: ensureContrast(background, primary, 3),
    selectionBackground: getSelectionBackground(background, accent, foreground),
    black,
    red: destructive,
    green: connected,
    yellow: warning,
    blue,
    magenta,
    cyan,
    white,
    brightBlack: mutedForeground,
    brightRed: ensureContrast(mixHexColors(destructive, foreground, 0.18), background, 4.5),
    brightGreen: ensureContrast(mixHexColors(connected, foreground, 0.16), background, 4.5),
    brightYellow: ensureContrast(mixHexColors(warning, foreground, 0.16), background, 4.5),
    brightBlue: ensureContrast(mixHexColors(blue, foreground, 0.16), background, 4.5),
    brightMagenta: ensureContrast(mixHexColors(magenta, foreground, 0.16), background, 4.5),
    brightCyan: ensureContrast(mixHexColors(cyan, foreground, 0.16), background, 4.5),
    brightWhite: ensureContrast(mixHexColors(foreground, "#ffffff", inferredAppTheme === 'light' ? 0 : 0.12), background, 8),
  }
}

// 获取主题函数
export function getTerminalTheme(
  themeName: 'default' | 'dark' | 'light' | 'solarized' | 'dracula',
  appTheme?: 'light' | 'dark'
): TerminalTheme {
  // default 跟随应用主题 CSS 变量，并为终端做可读性兜底。
  if (themeName === 'default') {
    return getThemeGeneratorTerminalTheme(appTheme)
  }

  switch (themeName) {
    case 'dark':
      return darkTheme
    case 'light':
      return lightTheme
    case 'solarized':
      return solarizedTheme
    case 'dracula':
      return draculaTheme
    default:
      return darkTheme
  }
}

export function withTerminalBackgroundOpacity(color: string, opacity: number): string {
  const normalized = color.replace('#', '')

  if (normalized.length !== 6) {
    return color
  }

  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)

  if ([r, g, b].some(Number.isNaN)) {
    return color
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
