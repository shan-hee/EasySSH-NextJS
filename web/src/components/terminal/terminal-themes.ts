// 终端主题配置

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

// 获取主题函数
export function getTerminalTheme(
  themeName: 'default' | 'dark' | 'light' | 'solarized' | 'dracula',
  appTheme?: 'light' | 'dark'
): TerminalTheme {
  // 如果是 default，则根据应用主题选择
  if (themeName === 'default') {
    return appTheme === 'light' ? lightTheme : darkTheme
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
