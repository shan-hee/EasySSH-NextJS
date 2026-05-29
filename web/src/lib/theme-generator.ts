import { SHADCN_STUDIO_PRESET_STYLES } from "@/lib/theme-generator-presets"
import { dispatchThemeGeneratorChange } from "@/lib/theme-generator-events"
import { colorToHex, hexToRgb } from "@/lib/color-utils"

export { colorToHex } from "@/lib/color-utils"

export type ThemeMode = "light" | "dark"
export type ThemeBaseColorId = "neutral" | "zinc" | "slate" | "stone"
export type ThemeVisualStyleId = "mira" | "clean" | "compact" | "expressive"
export type ThemeMenuColorId = "solid" | "soft" | "transparent"
export type ThemeMenuAccentId = "subtle" | "bold"
export type ThemeIconLibraryId = "lucide"

export type ThemeStyleProps = {
  background: string
  foreground: string
  card: string
  "card-foreground": string
  popover: string
  "popover-foreground": string
  primary: string
  "primary-foreground": string
  secondary: string
  "secondary-foreground": string
  muted: string
  "muted-foreground": string
  accent: string
  "accent-foreground": string
  destructive: string
  border: string
  input: string
  ring: string
  "chart-1": string
  "chart-2": string
  "chart-3": string
  "chart-4": string
  "chart-5": string
  sidebar: string
  "sidebar-foreground": string
  "sidebar-primary": string
  "sidebar-primary-foreground": string
  "sidebar-accent": string
  "sidebar-accent-foreground": string
  "sidebar-border": string
  "sidebar-ring": string
  "font-sans": string
  "font-serif": string
  "font-mono": string
  radius: string
  "shadow-color": string
  "shadow-opacity": string
  "shadow-blur": string
  "shadow-spread": string
  "shadow-offset-x": string
  "shadow-offset-y": string
  spacing: string
}

export type ThemeStyles = {
  light: ThemeStyleProps
  dark: ThemeStyleProps
}

export type ThemeGeneratorState = {
  mode: ThemeMode
  preset: string | null
  baseColor: ThemeBaseColorId
  style: ThemeVisualStyleId
  iconLibrary: ThemeIconLibraryId
  menuColor: ThemeMenuColorId
  menuAccent: ThemeMenuAccentId
  styles: ThemeStyles
}

export type StoredThemeGeneratorState = ThemeGeneratorState & {
  css?: string
}

export type ThemePreset = {
  id: string
  label: string
  badge?: string
  styles: ThemeStyles
}

export const THEME_GENERATOR_STORAGE_KEY = "easyssh-theme-generator"
export const THEME_GENERATOR_STYLE_ID = "easyssh-theme-generator-style"

const BASE_COLOR_IDS: ThemeBaseColorId[] = ["neutral", "zinc", "slate", "stone"]
const VISUAL_STYLE_IDS: ThemeVisualStyleId[] = ["mira", "clean", "compact", "expressive"]
const MENU_COLOR_IDS: ThemeMenuColorId[] = ["solid", "soft", "transparent"]
const MENU_ACCENT_IDS: ThemeMenuAccentId[] = ["subtle", "bold"]

export const DEFAULT_FONT_SANS =
  'var(--font-inter), var(--font-noto-sans-sc), "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
export const DEFAULT_FONT_SERIF = 'Georgia, Cambria, "Times New Roman", Times, serif'
export const DEFAULT_FONT_MONO =
  'var(--font-jetbrains-mono), "Fira Code", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

export const THEME_COLOR_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]

const NON_COLOR_KEYS = [
  "font-sans",
  "font-serif",
  "font-mono",
  "radius",
  "shadow-color",
  "shadow-opacity",
  "shadow-blur",
  "shadow-spread",
  "shadow-offset-x",
  "shadow-offset-y",
  "spacing",
] as const

const THEME_STYLE_KEYS = [...THEME_COLOR_KEYS, ...NON_COLOR_KEYS] as const

const DEFAULT_LIGHT_THEME_STYLES: ThemeStyleProps = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  "card-foreground": "oklch(0.145 0 0)",
  popover: "oklch(1 0 0)",
  "popover-foreground": "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  "primary-foreground": "oklch(0.985 0 0)",
  secondary: "oklch(0.97 0 0)",
  "secondary-foreground": "oklch(0.205 0 0)",
  muted: "oklch(0.97 0 0)",
  "muted-foreground": "oklch(0.556 0 0)",
  accent: "oklch(0.97 0 0)",
  "accent-foreground": "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.922 0 0)",
  input: "oklch(0.922 0 0)",
  ring: "oklch(0.708 0 0)",
  "chart-1": "oklch(0.60 0.17 259)",
  "chart-2": "oklch(0.55 0.13 165)",
  "chart-3": "oklch(0.72 0.19 50)",
  "chart-4": "oklch(0.73 0.13 306)",
  "chart-5": "oklch(0.65 0.21 7)",
  sidebar: "oklch(0.985 0 0)",
  "sidebar-foreground": "oklch(0.145 0 0)",
  "sidebar-primary": "oklch(0.205 0 0)",
  "sidebar-primary-foreground": "oklch(0.985 0 0)",
  "sidebar-accent": "oklch(0.97 0 0)",
  "sidebar-accent-foreground": "oklch(0.205 0 0)",
  "sidebar-border": "oklch(0.922 0 0)",
  "sidebar-ring": "oklch(0.708 0 0)",
  "font-sans": DEFAULT_FONT_SANS,
  "font-serif": DEFAULT_FONT_SERIF,
  "font-mono": DEFAULT_FONT_MONO,
  radius: "0.625rem",
  "shadow-color": "oklch(0 0 0)",
  "shadow-opacity": "0.10",
  "shadow-blur": "3px",
  "shadow-spread": "0px",
  "shadow-offset-x": "0px",
  "shadow-offset-y": "1px",
  spacing: "0.25rem",
}

const DEFAULT_DARK_THEME_STYLES: ThemeStyleProps = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  "card-foreground": "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  "popover-foreground": "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  "primary-foreground": "oklch(0.205 0 0)",
  secondary: "oklch(0.269 0 0)",
  "secondary-foreground": "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  "muted-foreground": "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  "accent-foreground": "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  ring: "oklch(0.556 0 0)",
  "chart-1": "oklch(0.60 0.17 259)",
  "chart-2": "oklch(0.55 0.13 165)",
  "chart-3": "oklch(0.72 0.19 50)",
  "chart-4": "oklch(0.73 0.13 306)",
  "chart-5": "oklch(0.65 0.21 7)",
  sidebar: "oklch(0.205 0 0)",
  "sidebar-foreground": "oklch(0.985 0 0)",
  "sidebar-primary": "oklch(0.488 0.243 264.376)",
  "sidebar-primary-foreground": "oklch(0.985 0 0)",
  "sidebar-accent": "oklch(0.269 0 0)",
  "sidebar-accent-foreground": "oklch(0.985 0 0)",
  "sidebar-border": "oklch(1 0 0 / 10%)",
  "sidebar-ring": "oklch(0.556 0 0)",
  "font-sans": DEFAULT_FONT_SANS,
  "font-serif": DEFAULT_FONT_SERIF,
  "font-mono": DEFAULT_FONT_MONO,
  radius: "0.625rem",
  "shadow-color": "oklch(0 0 0)",
  "shadow-opacity": "0.10",
  "shadow-blur": "3px",
  "shadow-spread": "0px",
  "shadow-offset-x": "0px",
  "shadow-offset-y": "1px",
  spacing: "0.25rem",
}

export const DEFAULT_THEME_STYLES: ThemeStyles = {
  light: DEFAULT_LIGHT_THEME_STYLES,
  dark: DEFAULT_DARK_THEME_STYLES,
}

const SHADCN_STUDIO_PRESET_IDS = [
  "art-deco",
  "caffeine",
  "claude",
  "clean-slate",
  "corporate",
  "elegant-luxury",
  "ghibli-studio",
  "marshmallow",
  "marvel",
  "material-design",
  "midnight-bloom",
  "modern-minimal",
  "nature",
  "neo-brutalism",
  "pastel-dreams",
  "perplexity",
  "slack",
  "spotify",
  "summer",
  "sunset-horizon",
  "valorant",
  "vs-code",
] as const

const SHADCN_STUDIO_PRESET_LABELS: Record<(typeof SHADCN_STUDIO_PRESET_IDS)[number], string> = {
  "art-deco": "Art Deco",
  caffeine: "Caffeine",
  claude: "Claude",
  "clean-slate": "Clean Slate",
  corporate: "Corporate",
  "elegant-luxury": "Elegant Luxury",
  "ghibli-studio": "Ghibli Studio",
  marshmallow: "Marshmallow",
  marvel: "Marvel",
  "material-design": "Material Design",
  "midnight-bloom": "Midnight Bloom",
  "modern-minimal": "Modern Minimal",
  nature: "Nature",
  "neo-brutalism": "Neo Brutalism",
  "pastel-dreams": "Pastel Dreams",
  perplexity: "Perplexity",
  slack: "Slack",
  spotify: "Spotify",
  summer: "Summer",
  "sunset-horizon": "Sunset Horizon",
  valorant: "Valorant",
  "vs-code": "Vs Code",
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "default", label: "Default", styles: cloneThemeStyles(DEFAULT_THEME_STYLES) },
  ...SHADCN_STUDIO_PRESET_IDS.map((id) => ({
    id,
    label: SHADCN_STUDIO_PRESET_LABELS[id],
    styles: mergeThemeStyles(SHADCN_STUDIO_PRESET_STYLES[id]),
  })),
]

export const FONT_OPTIONS = {
  Inter: 'Inter, var(--font-noto-sans-sc), sans-serif',
  Geist: 'Geist, var(--font-noto-sans-sc), sans-serif',
  Montserrat: 'Montserrat, var(--font-noto-sans-sc), sans-serif',
  Poppins: 'Poppins, var(--font-noto-sans-sc), sans-serif',
  Barlow: 'Barlow, var(--font-noto-sans-sc), sans-serif',
  Merriweather: 'Merriweather, Georgia, serif',
  "JetBrains Mono": 'var(--font-jetbrains-mono), "JetBrains Mono", monospace',
  "Fira Code": '"Fira Code", var(--font-jetbrains-mono), monospace',
  "Source Code Pro": '"Source Code Pro", var(--font-jetbrains-mono), monospace',
} as const

const BASE_COLOR_OVERRIDES: Record<ThemeBaseColorId, ThemeStyles> = {
  neutral: cloneThemeStyles(DEFAULT_THEME_STYLES),
  zinc: mergeThemeStyles({
    light: {
      background: "oklch(1 0 0)",
      foreground: "oklch(0.141 0.005 285.823)",
      muted: "oklch(0.967 0.001 286.375)",
      "muted-foreground": "oklch(0.552 0.016 285.938)",
      border: "oklch(0.92 0.004 286.32)",
      input: "oklch(0.92 0.004 286.32)",
    },
    dark: {
      background: "oklch(0.141 0.005 285.823)",
      foreground: "oklch(0.985 0 0)",
      muted: "oklch(0.274 0.006 286.033)",
      "muted-foreground": "oklch(0.705 0.015 286.067)",
      border: "oklch(1 0 0 / 10%)",
      input: "oklch(1 0 0 / 15%)",
    },
  }),
  slate: mergeThemeStyles({
    light: {
      background: "oklch(0.984 0.003 247.858)",
      foreground: "oklch(0.129 0.042 264.695)",
      muted: "oklch(0.968 0.007 247.896)",
      "muted-foreground": "oklch(0.554 0.046 257.417)",
      border: "oklch(0.929 0.013 255.508)",
      input: "oklch(0.929 0.013 255.508)",
    },
    dark: {
      background: "oklch(0.129 0.042 264.695)",
      foreground: "oklch(0.984 0.003 247.858)",
      muted: "oklch(0.279 0.041 260.031)",
      "muted-foreground": "oklch(0.704 0.04 256.788)",
      border: "oklch(1 0 0 / 10%)",
      input: "oklch(1 0 0 / 15%)",
    },
  }),
  stone: mergeThemeStyles({
    light: {
      background: "oklch(0.985 0.001 106.423)",
      foreground: "oklch(0.147 0.004 49.25)",
      muted: "oklch(0.97 0.001 106.424)",
      "muted-foreground": "oklch(0.553 0.013 58.071)",
      border: "oklch(0.923 0.003 48.717)",
      input: "oklch(0.923 0.003 48.717)",
    },
    dark: {
      background: "oklch(0.147 0.004 49.25)",
      foreground: "oklch(0.985 0.001 106.423)",
      muted: "oklch(0.268 0.007 34.298)",
      "muted-foreground": "oklch(0.709 0.01 56.259)",
      border: "oklch(1 0 0 / 10%)",
      input: "oklch(1 0 0 / 15%)",
    },
  }),
}

const VISUAL_STYLE_OVERRIDES: Record<ThemeVisualStyleId, Partial<ThemeStyleProps>> = {
  mira: {
    radius: "0.625rem",
    "shadow-opacity": "0.10",
    "shadow-blur": "3px",
    "shadow-spread": "0px",
    "shadow-offset-x": "0px",
    "shadow-offset-y": "1px",
  },
  clean: {
    radius: "0.375rem",
    "shadow-opacity": "0.04",
    "shadow-blur": "2px",
    "shadow-spread": "0px",
    "shadow-offset-x": "0px",
    "shadow-offset-y": "1px",
  },
  compact: {
    radius: "0.25rem",
    "shadow-opacity": "0.06",
    "shadow-blur": "1px",
    "shadow-spread": "0px",
    "shadow-offset-x": "0px",
    "shadow-offset-y": "1px",
    spacing: "0.2rem",
  },
  expressive: {
    radius: "1rem",
    "shadow-opacity": "0.14",
    "shadow-blur": "16px",
    "shadow-spread": "-4px",
    "shadow-offset-x": "0px",
    "shadow-offset-y": "8px",
  },
}

export const DEFAULT_THEME_GENERATOR_STATE: ThemeGeneratorState = {
  mode: "light",
  preset: "default",
  baseColor: "neutral",
  style: "mira",
  iconLibrary: "lucide",
  menuColor: "solid",
  menuAccent: "subtle",
  styles: cloneThemeStyles(DEFAULT_THEME_STYLES),
}

export function cloneThemeStyles(styles: ThemeStyles): ThemeStyles {
  return {
    light: { ...styles.light },
    dark: { ...styles.dark },
  }
}

export function cloneThemeState(state: ThemeGeneratorState): ThemeGeneratorState {
  return {
    ...state,
    styles: cloneThemeStyles(state.styles),
  }
}

export function mergeThemeStyles(overrides: {
  light?: Partial<ThemeStyleProps>
  dark?: Partial<ThemeStyleProps>
}): ThemeStyles {
  return {
    light: { ...DEFAULT_LIGHT_THEME_STYLES, ...overrides.light },
    dark: { ...DEFAULT_DARK_THEME_STYLES, ...overrides.dark },
  }
}

export function getThemePreset(presetId: string): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === presetId) ?? THEME_PRESETS[0]
}

export function createThemeGeneratorState(): ThemeGeneratorState {
  return cloneThemeState(DEFAULT_THEME_GENERATOR_STATE)
}

export function isDefaultThemeState(state: ThemeGeneratorState): boolean {
  return state.preset === "default" && JSON.stringify(state.styles) === JSON.stringify(DEFAULT_THEME_STYLES)
}

export function loadThemeGeneratorState(): ThemeGeneratorState {
  if (typeof window === "undefined") {
    return createThemeGeneratorState()
  }

  try {
    const raw = window.localStorage.getItem(THEME_GENERATOR_STORAGE_KEY)
    if (!raw) {
      return createThemeGeneratorState()
    }

    const stored = JSON.parse(raw) as Partial<StoredThemeGeneratorState>
    if (!isPartialThemeStyles(stored.styles)) {
      return createThemeGeneratorState()
    }

    const defaultState = createThemeGeneratorState()
    const storedPreset =
      typeof stored.preset === "string" && THEME_PRESETS.some((preset) => preset.id === stored.preset)
        ? stored.preset
        : null

    return {
      ...defaultState,
      ...stored,
      mode: stored.mode === "dark" ? "dark" : "light",
      preset: storedPreset,
      baseColor: isOneOf(stored.baseColor, BASE_COLOR_IDS) ? stored.baseColor : defaultState.baseColor,
      style: isOneOf(stored.style, VISUAL_STYLE_IDS) ? stored.style : defaultState.style,
      iconLibrary: stored.iconLibrary === "lucide" ? stored.iconLibrary : defaultState.iconLibrary,
      menuColor: isOneOf(stored.menuColor, MENU_COLOR_IDS) ? stored.menuColor : defaultState.menuColor,
      menuAccent: isOneOf(stored.menuAccent, MENU_ACCENT_IDS) ? stored.menuAccent : defaultState.menuAccent,
      styles: mergeLoadedThemeStyles(stored.styles),
    }
  } catch (error) {
    console.warn("Failed to read theme generator state:", error)
    return createThemeGeneratorState()
  }
}

export function persistThemeGeneratorState(state: ThemeGeneratorState) {
  if (typeof window === "undefined") {
    return
  }

  try {
    if (isDefaultThemeState(state)) {
      window.localStorage.removeItem(THEME_GENERATOR_STORAGE_KEY)
      return
    }

    const stored: StoredThemeGeneratorState = {
      ...state,
      styles: cloneThemeStyles(state.styles),
      css: generateRuntimeThemeCSS(state.styles, true),
    }

    window.localStorage.setItem(THEME_GENERATOR_STORAGE_KEY, JSON.stringify(stored))
  } catch (error) {
    console.warn("Failed to persist theme generator state:", error)
  }
}

export function clearThemeGeneratorState() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(THEME_GENERATOR_STORAGE_KEY)
    } catch (error) {
      console.warn("Failed to clear theme generator state:", error)
    }
  }

  if (typeof document !== "undefined") {
    document.getElementById(THEME_GENERATOR_STYLE_ID)?.remove()
  }
}

export function applyThemeGeneratorState(
  state: ThemeGeneratorState,
  options: { notify?: boolean } = {},
) {
  if (typeof document === "undefined") {
    return
  }

  if (isDefaultThemeState(state)) {
    document.getElementById(THEME_GENERATOR_STYLE_ID)?.remove()
    if (options.notify !== false) {
      dispatchThemeGeneratorChange()
    }
    return
  }

  let styleElement = document.getElementById(THEME_GENERATOR_STYLE_ID) as HTMLStyleElement | null
  if (!styleElement) {
    styleElement = document.createElement("style")
    styleElement.id = THEME_GENERATOR_STYLE_ID
    document.head.appendChild(styleElement)
  }

  styleElement.textContent = generateRuntimeThemeCSS(state.styles, true)
  if (options.notify !== false) {
    dispatchThemeGeneratorChange()
  }
}

export function generateRuntimeThemeCSS(styles: ThemeStyles, important = false): string {
  return [
    generateVariableBlock(":root", buildRuntimeVariables(styles.light), important),
    generateVariableBlock(".dark", buildRuntimeVariables(styles.dark), important),
  ].join("\n\n")
}

export function generateThemeCode(styles: ThemeStyles): string {
  return `${generateRuntimeThemeCSS(styles, false)}\n\n@theme inline {\n${themeInlineVariables()
    .map((line) => `  ${line}`)
    .join("\n")}\n}`
}

export function getShadowMap(styles: ThemeStyleProps): Record<string, string> {
  const shadowColor = styles["shadow-color"] || "oklch(0 0 0)"
  const offsetX = styles["shadow-offset-x"] || "0px"
  const offsetY = styles["shadow-offset-y"] || "1px"
  const blur = styles["shadow-blur"] || "3px"
  const spread = styles["shadow-spread"] || "0px"
  const opacity = Number.parseFloat(styles["shadow-opacity"] || "0.1")
  const safeOpacity = Number.isFinite(opacity) ? opacity : 0.1

  const color = (multiplier: number) => colorWithOpacity(shadowColor, clamp(safeOpacity * multiplier, 0, 1))
  const secondLayer = (fixedOffsetY: string, fixedBlur: string) => {
    const spreadValue = Number.parseFloat(spread.replace("px", ""))
    const secondSpread = `${(Number.isFinite(spreadValue) ? spreadValue : 0) - 1}px`

    return `${offsetX} ${fixedOffsetY} ${fixedBlur} ${secondSpread} ${color(1)}`
  }

  return {
    "shadow-2xs": `${offsetX} ${offsetY} ${blur} ${spread} ${color(0.5)}`,
    "shadow-xs": `${offsetX} ${offsetY} ${blur} ${spread} ${color(0.5)}`,
    "shadow-sm": `${offsetX} ${offsetY} ${blur} ${spread} ${color(1)}, ${secondLayer("1px", "2px")}`,
    shadow: `${offsetX} ${offsetY} ${blur} ${spread} ${color(1)}, ${secondLayer("1px", "2px")}`,
    "shadow-md": `${offsetX} ${offsetY} ${blur} ${spread} ${color(1)}, ${secondLayer("2px", "4px")}`,
    "shadow-lg": `${offsetX} ${offsetY} ${blur} ${spread} ${color(1)}, ${secondLayer("4px", "6px")}`,
    "shadow-xl": `${offsetX} ${offsetY} ${blur} ${spread} ${color(1)}, ${secondLayer("8px", "10px")}`,
    "shadow-2xl": `${offsetX} ${offsetY} ${blur} ${spread} ${color(2.5)}`,
  }
}

export function applyThemePresetToState(state: ThemeGeneratorState, presetId: string): ThemeGeneratorState {
  const preset = getThemePreset(presetId)

  return {
    ...state,
    preset: preset.id,
    baseColor: "neutral",
    style: "mira",
    menuColor: "solid",
    menuAccent: "subtle",
    styles: cloneThemeStyles(preset.styles),
  }
}

export function applyBaseColorToState(state: ThemeGeneratorState, baseColor: ThemeBaseColorId): ThemeGeneratorState {
  const baseStyles = BASE_COLOR_OVERRIDES[baseColor]
  const nextStyles = cloneThemeStyles(state.styles)
  const keys: ThemeColorKey[] = [
    "background",
    "foreground",
    "card",
    "card-foreground",
    "popover",
    "popover-foreground",
    "muted",
    "muted-foreground",
    "border",
    "input",
    "sidebar",
    "sidebar-foreground",
    "sidebar-border",
  ]

  for (const key of keys) {
    nextStyles.light[key] = baseStyles.light[key]
    nextStyles.dark[key] = baseStyles.dark[key]
  }

  return {
    ...state,
    baseColor,
    preset: null,
    styles: nextStyles,
  }
}

export function applyVisualStyleToState(state: ThemeGeneratorState, style: ThemeVisualStyleId): ThemeGeneratorState {
  const overrides = VISUAL_STYLE_OVERRIDES[style]

  return {
    ...state,
    style,
    preset: null,
    styles: {
      light: { ...state.styles.light, ...overrides },
      dark: { ...state.styles.dark, ...overrides },
    },
  }
}

export function applyMenuColorToState(state: ThemeGeneratorState, menuColor: ThemeMenuColorId): ThemeGeneratorState {
  const styles = cloneThemeStyles(state.styles)

  if (menuColor === "solid") {
    styles.light.sidebar = styles.light.card
    styles.dark.sidebar = styles.dark.card
  } else if (menuColor === "soft") {
    styles.light.sidebar = styles.light.muted
    styles.dark.sidebar = styles.dark.muted
  } else {
    styles.light.sidebar = styles.light.background
    styles.dark.sidebar = styles.dark.background
  }

  return {
    ...state,
    menuColor,
    preset: null,
    styles,
  }
}

export function applyMenuAccentToState(state: ThemeGeneratorState, menuAccent: ThemeMenuAccentId): ThemeGeneratorState {
  const styles = cloneThemeStyles(state.styles)

  if (menuAccent === "bold") {
    styles.light["sidebar-accent"] = styles.light.primary
    styles.light["sidebar-accent-foreground"] = styles.light["primary-foreground"]
    styles.dark["sidebar-accent"] = styles.dark.primary
    styles.dark["sidebar-accent-foreground"] = styles.dark["primary-foreground"]
  } else {
    styles.light["sidebar-accent"] = styles.light.accent
    styles.light["sidebar-accent-foreground"] = styles.light["accent-foreground"]
    styles.dark["sidebar-accent"] = styles.dark.accent
    styles.dark["sidebar-accent-foreground"] = styles.dark["accent-foreground"]
  }

  return {
    ...state,
    menuAccent,
    preset: null,
    styles,
  }
}

export function updateBothThemes(
  state: ThemeGeneratorState,
  updates: Partial<ThemeStyleProps>,
): ThemeGeneratorState {
  return {
    ...state,
    preset: null,
    styles: {
      light: { ...state.styles.light, ...updates },
      dark: { ...state.styles.dark, ...updates },
    },
  }
}

export function updateThemeValue(
  state: ThemeGeneratorState,
  mode: ThemeMode,
  key: keyof ThemeStyleProps,
  value: string,
): ThemeGeneratorState {
  return {
    ...state,
    preset: null,
    styles: {
      ...state.styles,
      [mode]: {
        ...state.styles[mode],
        [key]: value,
      },
    },
  }
}

export function parseThemeCSS(css: string, fallback: ThemeStyles): ThemeStyles {
  const rootContent = extractCssBlockContent(css, ":root")
  const darkContent = extractCssBlockContent(css, ".dark")

  return {
    light: { ...fallback.light, ...parseThemeBlock(rootContent) },
    dark: { ...fallback.dark, ...parseThemeBlock(darkContent) },
  }
}

export function getThemeSwatches(styles: ThemeStyles): string[] {
  return [styles.light.primary, styles.light.destructive, styles.light.secondary, styles.light.accent]
}

function buildRuntimeVariables(styles: ThemeStyleProps): Record<string, string> {
  const variables: Record<string, string> = {}

  for (const key of THEME_STYLE_KEYS) {
    variables[key] = styles[key]
  }

  Object.assign(variables, getShadowMap(styles))

  return variables
}

function generateVariableBlock(selector: string, variables: Record<string, string>, important: boolean): string {
  const suffix = important ? " !important" : ""
  const body = Object.entries(variables)
    .map(([name, value]) => `  --${name}: ${value}${suffix};`)
    .join("\n")

  return `${selector} {\n${body}\n}`
}

function themeInlineVariables(): string[] {
  return [
    "--color-background: var(--background);",
    "--color-foreground: var(--foreground);",
    "--color-card: var(--card);",
    "--color-card-foreground: var(--card-foreground);",
    "--color-popover: var(--popover);",
    "--color-popover-foreground: var(--popover-foreground);",
    "--color-primary: var(--primary);",
    "--color-primary-foreground: var(--primary-foreground);",
    "--color-secondary: var(--secondary);",
    "--color-secondary-foreground: var(--secondary-foreground);",
    "--color-muted: var(--muted);",
    "--color-muted-foreground: var(--muted-foreground);",
    "--color-accent: var(--accent);",
    "--color-accent-foreground: var(--accent-foreground);",
    "--color-destructive: var(--destructive);",
    "--color-border: var(--border);",
    "--color-input: var(--input);",
    "--color-ring: var(--ring);",
    "--color-chart-1: var(--chart-1);",
    "--color-chart-2: var(--chart-2);",
    "--color-chart-3: var(--chart-3);",
    "--color-chart-4: var(--chart-4);",
    "--color-chart-5: var(--chart-5);",
    "--color-sidebar: var(--sidebar);",
    "--color-sidebar-foreground: var(--sidebar-foreground);",
    "--color-sidebar-primary: var(--sidebar-primary);",
    "--color-sidebar-primary-foreground: var(--sidebar-primary-foreground);",
    "--color-sidebar-accent: var(--sidebar-accent);",
    "--color-sidebar-accent-foreground: var(--sidebar-accent-foreground);",
    "--color-sidebar-border: var(--sidebar-border);",
    "--color-sidebar-ring: var(--sidebar-ring);",
    "--font-sans: var(--font-sans);",
    "--font-mono: var(--font-mono);",
    "--font-serif: var(--font-serif);",
    "--radius-sm: calc(var(--radius) - 4px);",
    "--radius-md: calc(var(--radius) - 2px);",
    "--radius-lg: var(--radius);",
    "--radius-xl: calc(var(--radius) + 4px);",
    "--shadow-2xs: var(--shadow-2xs);",
    "--shadow-xs: var(--shadow-xs);",
    "--shadow-sm: var(--shadow-sm);",
    "--shadow: var(--shadow);",
    "--shadow-md: var(--shadow-md);",
    "--shadow-lg: var(--shadow-lg);",
    "--shadow-xl: var(--shadow-xl);",
    "--shadow-2xl: var(--shadow-2xl);",
  ]
}

function isPartialThemeStyles(value: unknown): value is Partial<ThemeStyles> {
  if (!value || typeof value !== "object") {
    return false
  }

  const styles = value as Partial<ThemeStyles>
  return !!styles.light && typeof styles.light === "object" && !!styles.dark && typeof styles.dark === "object"
}

function mergeLoadedThemeStyles(styles: Partial<ThemeStyles>): ThemeStyles {
  return {
    light: { ...DEFAULT_LIGHT_THEME_STYLES, ...(styles.light ?? {}) },
    dark: { ...DEFAULT_DARK_THEME_STYLES, ...(styles.dark ?? {}) },
  }
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T)
}

function extractCssBlockContent(input: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`${escaped}\\s*{([^}]+)}`)

  return input.match(regex)?.[1]?.trim() ?? null
}

function parseThemeBlock(content: string | null): Partial<ThemeStyleProps> {
  const parsed: Partial<ThemeStyleProps> = {}

  if (!content) {
    return parsed
  }

  const declarations = content.match(/--[^:]+:\s*[^;]+/g) ?? []
  for (const declaration of declarations) {
    const index = declaration.indexOf(":")
    const name = declaration.slice(0, index).trim().replace(/^--/, "") as keyof ThemeStyleProps
    const value = declaration.slice(index + 1).trim().replace(/\s*!important$/, "")

    if (THEME_STYLE_KEYS.includes(name)) {
      parsed[name] = normalizeCssValue(value)
    }
  }

  return parsed
}

function normalizeCssValue(value: string): string {
  const trimmed = value.trim()
  if (/^[\d.]+\s+[\d.]+%?\s+[\d.]+%?(\s*\/\s*[\d.]+%?)?$/.test(trimmed)) {
    return `hsl(${trimmed})`
  }

  return trimmed.replace(/\s+/g, " ")
}

function colorWithOpacity(color: string, opacity: number): string {
  const cleaned = color.trim().replace(/\s*\/\s*[^)]+(?=\))/, "")

  if (cleaned.startsWith("#")) {
    const rgb = hexToRgb(cleaned) ?? [0, 0, 0]
    return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]} / ${opacity.toFixed(2)})`
  }

  if (cleaned.startsWith("oklch(")) {
    return cleaned.replace(/\)$/, ` / ${opacity.toFixed(2)})`)
  }

  if (cleaned.startsWith("hsl(") || cleaned.startsWith("rgb(")) {
    return cleaned.replace(/\)$/, ` / ${opacity.toFixed(2)})`)
  }

  return `rgb(0 0 0 / ${opacity.toFixed(2)})`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
