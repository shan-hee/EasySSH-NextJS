"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import {
  ChevronDown,
  Copy,
  Dices,
  FileCode2,
  Moon,
  Palette,
  Redo2,
  RotateCcw,
  Sun,
  Undo2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  FONT_OPTIONS,
  THEME_GENERATOR_STORAGE_KEY,
  THEME_PRESETS,
  applyBaseColorToState,
  applyMenuAccentToState,
  applyMenuColorToState,
  applyThemeGeneratorState,
  applyThemePresetToState,
  applyVisualStyleToState,
  clearThemeGeneratorState,
  cloneThemeState,
  colorToHex,
  createThemeGeneratorState,
  generateThemeCode,
  getThemeSwatches,
  loadThemeGeneratorState,
  parseThemeCSS,
  persistThemeGeneratorState,
  updateBothThemes,
  updateThemeValue,
  type ThemeBaseColorId,
  type ThemeColorKey,
  type ThemeGeneratorState,
  type ThemeMenuAccentId,
  type ThemeMenuColorId,
  type ThemeVisualStyleId,
} from "@/lib/theme-generator"

const MAX_HISTORY = 40
const LIVE_COMMIT_IDLE_MS = 220

function areThemeStatesEqual(a: ThemeGeneratorState, b: ThemeGeneratorState) {
  return JSON.stringify(a) === JSON.stringify(b)
}

const styleOptions: Array<{ value: ThemeVisualStyleId; labelKey: string }> = [
  { value: "mira", labelKey: "styleMira" },
  { value: "clean", labelKey: "styleClean" },
  { value: "compact", labelKey: "styleCompact" },
  { value: "expressive", labelKey: "styleExpressive" },
]

const baseColorOptions: Array<{ value: ThemeBaseColorId; labelKey: string; color: string }> = [
  { value: "neutral", labelKey: "baseNeutral", color: "oklch(0.205 0 0)" },
  { value: "zinc", labelKey: "baseZinc", color: "oklch(0.21 0.006 285.885)" },
  { value: "slate", labelKey: "baseSlate", color: "oklch(0.279 0.041 260.031)" },
  { value: "stone", labelKey: "baseStone", color: "oklch(0.268 0.007 34.298)" },
]

const menuColorOptions: Array<{ value: ThemeMenuColorId; labelKey: string }> = [
  { value: "solid", labelKey: "menuSolid" },
  { value: "soft", labelKey: "menuSoft" },
  { value: "transparent", labelKey: "menuTransparent" },
]

const menuAccentOptions: Array<{ value: ThemeMenuAccentId; labelKey: string }> = [
  { value: "subtle", labelKey: "accentSubtle" },
  { value: "bold", labelKey: "accentBold" },
]

const colorGroups: Array<{
  value: string
  labelKey: string
  keys: Array<{ key: ThemeColorKey; labelKey: string }>
}> = [
  {
    value: "brand",
    labelKey: "groupBrand",
    keys: [
      { key: "primary", labelKey: "colorPrimary" },
      { key: "primary-foreground", labelKey: "colorPrimaryForeground" },
      { key: "secondary", labelKey: "colorSecondary" },
      { key: "secondary-foreground", labelKey: "colorSecondaryForeground" },
      { key: "destructive", labelKey: "colorDestructive" },
    ],
  },
  {
    value: "base",
    labelKey: "groupBase",
    keys: [
      { key: "background", labelKey: "colorBackground" },
      { key: "foreground", labelKey: "colorForeground" },
      { key: "card", labelKey: "colorCard" },
      { key: "card-foreground", labelKey: "colorCardForeground" },
      { key: "popover", labelKey: "colorPopover" },
      { key: "popover-foreground", labelKey: "colorPopoverForeground" },
    ],
  },
  {
    value: "other",
    labelKey: "groupOtherColors",
    keys: [
      { key: "muted", labelKey: "colorMuted" },
      { key: "muted-foreground", labelKey: "colorMutedForeground" },
      { key: "accent", labelKey: "colorAccent" },
      { key: "accent-foreground", labelKey: "colorAccentForeground" },
      { key: "border", labelKey: "colorBorder" },
      { key: "input", labelKey: "colorInput" },
      { key: "ring", labelKey: "colorRing" },
    ],
  },
  {
    value: "sidebar",
    labelKey: "groupSidebar",
    keys: [
      { key: "sidebar", labelKey: "colorSidebar" },
      { key: "sidebar-foreground", labelKey: "colorSidebarForeground" },
      { key: "sidebar-primary", labelKey: "colorSidebarPrimary" },
      { key: "sidebar-primary-foreground", labelKey: "colorSidebarPrimaryForeground" },
      { key: "sidebar-accent", labelKey: "colorSidebarAccent" },
      { key: "sidebar-accent-foreground", labelKey: "colorSidebarAccentForeground" },
      { key: "sidebar-border", labelKey: "colorSidebarBorder" },
      { key: "sidebar-ring", labelKey: "colorSidebarRing" },
    ],
  },
  {
    value: "charts",
    labelKey: "groupCharts",
    keys: [
      { key: "chart-1", labelKey: "colorChart1" },
      { key: "chart-2", labelKey: "colorChart2" },
      { key: "chart-3", labelKey: "colorChart3" },
      { key: "chart-4", labelKey: "colorChart4" },
      { key: "chart-5", labelKey: "colorChart5" },
    ],
  },
]

export function ThemeGeneratorPanel() {
  const t = useTranslations("themeGenerator")
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = React.useState(false)
  const [state, setState] = React.useState<ThemeGeneratorState>(() => createThemeGeneratorState())
  const [history, setHistory] = React.useState<{
    past: ThemeGeneratorState[]
    future: ThemeGeneratorState[]
  }>({ past: [], future: [] })
  const [importOpen, setImportOpen] = React.useState(false)
  const [cssText, setCssText] = React.useState("")
  const [cssError, setCssError] = React.useState<string | null>(null)
  const [variablesOpen, setVariablesOpen] = React.useState(false)
  const initializedRef = React.useRef(false)
  const stateRef = React.useRef(state)
  const liveCommitRef = React.useRef<{
    previous: ThemeGeneratorState
    timer: number | null
  } | null>(null)
  const previewFrameRef = React.useRef<number | null>(null)
  const pendingPreviewStateRef = React.useRef<ThemeGeneratorState | null>(null)

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  const syncThemeState = React.useCallback(
    (nextState: ThemeGeneratorState, options: { persist?: boolean; notify?: boolean } = {}) => {
      if (theme !== nextState.mode) {
        setTheme(nextState.mode)
      }
      applyThemeGeneratorState(nextState, { notify: options.notify })
      if (options.persist !== false) {
        persistThemeGeneratorState(nextState)
      }
    },
    [setTheme, theme],
  )

  const flushLivePreview = React.useCallback(() => {
    const pendingState = pendingPreviewStateRef.current
    if (!pendingState) {
      return
    }

    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current)
      previewFrameRef.current = null
    }

    pendingPreviewStateRef.current = null
    setState(pendingState)
    syncThemeState(pendingState, { persist: false, notify: false })
  }, [syncThemeState])

  const scheduleLivePreview = React.useCallback(
    (nextState: ThemeGeneratorState) => {
      pendingPreviewStateRef.current = nextState

      if (previewFrameRef.current !== null) {
        return
      }

      previewFrameRef.current = window.requestAnimationFrame(() => {
        previewFrameRef.current = null
        flushLivePreview()
      })
    },
    [flushLivePreview],
  )

  const finishLiveCommit = React.useCallback(() => {
    const liveCommit = liveCommitRef.current
    if (!liveCommit) {
      return
    }

    if (liveCommit.timer) {
      window.clearTimeout(liveCommit.timer)
    }
    liveCommitRef.current = null
    flushLivePreview()

    const nextState = cloneThemeState(stateRef.current)
    if (areThemeStatesEqual(liveCommit.previous, nextState)) {
      return
    }

    setHistory((currentHistory) => ({
      past: [...currentHistory.past.slice(-(MAX_HISTORY - 1)), liveCommit.previous],
      future: [],
    }))
    syncThemeState(nextState)
  }, [flushLivePreview, syncThemeState])

  const liveCommit = React.useCallback(
    (producer: (current: ThemeGeneratorState) => ThemeGeneratorState) => {
      if (!liveCommitRef.current) {
        liveCommitRef.current = {
          previous: cloneThemeState(stateRef.current),
          timer: null,
        }
      }

      const nextState = cloneThemeState(producer(cloneThemeState(stateRef.current)))
      stateRef.current = nextState
      scheduleLivePreview(nextState)

      if (liveCommitRef.current.timer) {
        window.clearTimeout(liveCommitRef.current.timer)
      }

      liveCommitRef.current.timer = window.setTimeout(finishLiveCommit, LIVE_COMMIT_IDLE_MS)
    },
    [finishLiveCommit, scheduleLivePreview],
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        finishLiveCommit()
      }
      setOpen(nextOpen)
    },
    [finishLiveCommit],
  )

  React.useEffect(() => {
    return () => {
      const liveCommit = liveCommitRef.current
      const pendingState = pendingPreviewStateRef.current

      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current)
      }

      if (liveCommit?.timer) {
        window.clearTimeout(liveCommit.timer)
      }

      if (liveCommit) {
        const latestState = cloneThemeState(pendingState ?? stateRef.current)
        if (!areThemeStatesEqual(liveCommit.previous, latestState)) {
          persistThemeGeneratorState(latestState)
        }
      }
    }
  }, [])

  React.useEffect(() => {
    if (initializedRef.current) {
      return
    }
    initializedRef.current = true

    const hasStoredTheme = window.localStorage.getItem(THEME_GENERATOR_STORAGE_KEY) !== null
    const loadedState = loadThemeGeneratorState()
    const initialState = hasStoredTheme ? loadedState : { ...loadedState, mode: getCurrentThemeMode() }

    stateRef.current = initialState
    setState(initialState)
    if (hasStoredTheme) {
      syncThemeState(initialState)
    }
  }, [syncThemeState])

  const commit = React.useCallback((producer: (current: ThemeGeneratorState) => ThemeGeneratorState) => {
    finishLiveCommit()

    const previous = cloneThemeState(stateRef.current)
    const next = cloneThemeState(producer(previous))

    stateRef.current = next
    setHistory((currentHistory) => ({
      past: [...currentHistory.past.slice(-(MAX_HISTORY - 1)), previous],
      future: [],
    }))
    setState(next)
    syncThemeState(next)
  }, [finishLiveCommit, syncThemeState])

  const undo = React.useCallback(() => {
    finishLiveCommit()

    const previous = history.past[history.past.length - 1]
    if (!previous) {
      return
    }

    setHistory({
      past: history.past.slice(0, -1),
      future: [cloneThemeState(state), ...history.future].slice(0, MAX_HISTORY),
    })
    stateRef.current = cloneThemeState(previous)
    setState(cloneThemeState(previous))
    syncThemeState(previous)
  }, [finishLiveCommit, history, state, syncThemeState])

  const redo = React.useCallback(() => {
    finishLiveCommit()

    const next = history.future[0]
    if (!next) {
      return
    }

    setHistory({
      past: [...history.past, cloneThemeState(state)].slice(-MAX_HISTORY),
      future: history.future.slice(1),
    })
    stateRef.current = cloneThemeState(next)
    setState(cloneThemeState(next))
    syncThemeState(next)
  }, [finishLiveCommit, history, state, syncThemeState])

  const reset = React.useCallback(() => {
    finishLiveCommit()

    const nextState = { ...createThemeGeneratorState(), mode: state.mode }

    clearThemeGeneratorState()
    setHistory({ past: [], future: [] })
    stateRef.current = nextState
    setState(nextState)
    syncThemeState(nextState)
    toast.success(t("toastReset"))
  }, [finishLiveCommit, state.mode, syncThemeState, t])

  const copyThemeCSS = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateThemeCode(state.styles))
      toast.success(t("toastCopied"))
    } catch (error) {
      console.warn("Failed to copy theme CSS:", error)
      toast.error(t("toastCopyFailed"))
    }
  }, [state.styles, t])

  const handleImport = React.useCallback(() => {
    const trimmed = cssText.trim()
    if (!trimmed) {
      setCssError(t("importErrorEmpty"))
      return
    }

    if (!trimmed.includes("--") || !trimmed.includes(":")) {
      setCssError(t("importErrorInvalid"))
      return
    }

    commit((current) => ({
      ...current,
      preset: null,
      styles: parseThemeCSS(trimmed, current.styles),
    }))
    setCssText("")
    setCssError(null)
    setImportOpen(false)
    toast.success(t("toastImported"))
  }, [commit, cssText, t])

  const randomizePreset = React.useCallback(() => {
    const presets = THEME_PRESETS.filter((preset) => preset.id !== state.preset)
    const randomPreset = presets[Math.floor(Math.random() * presets.length)] ?? THEME_PRESETS[0]

    commit((current) => applyThemePresetToState(current, randomPreset.id))
  }, [commit, state.preset])

  const selectPreset = React.useCallback(
    (presetId: string) => {
      if (presetId === "custom") {
        return
      }

      commit((current) => applyThemePresetToState(current, presetId))
    },
    [commit],
  )

  const activeStyles = state.styles[state.mode]
  const themeCSS = React.useMemo(() => (variablesOpen ? generateThemeCode(state.styles) : ""), [state.styles, variablesOpen])
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("title")}>
                <Palette />
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("title")}</TooltipContent>
        </Tooltip>

        <SheetContent
          side="right"
          showOverlay={false}
          showCloseButton={false}
          className="w-[min(100vw,28rem)] gap-0 border-l bg-background p-0 shadow-2xl sm:max-w-[28rem]"
        >
          <SheetHeader className="flex h-14 min-h-14 flex-row items-center justify-between border-b px-5 py-0">
            <SheetTitle className="text-sm font-semibold">{t("title")}</SheetTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={t("undo")} disabled={!canUndo} onClick={undo}>
                <Undo2 className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={t("redo")} disabled={!canRedo} onClick={redo}>
                <Redo2 className="size-4" />
              </Button>
              <SheetClose asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("close")}>
                  <X className="size-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <div className="space-y-6 p-5">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2" onClick={() => setVariablesOpen(true)}>
                  <Copy className="size-4" />
                  {t("copy")}
                </Button>
                <Button variant="outline" className="gap-2" onClick={reset}>
                  <RotateCcw className="size-4" />
                  {t("reset")}
                </Button>
              </div>

              <section className="space-y-3">
                <h3 className="text-lg font-medium">{t("mode")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <ModeButton
                    active={state.mode === "light"}
                    icon={Sun}
                    label={t("light")}
                    onClick={() => commit((current) => ({ ...current, mode: "light" }))}
                  />
                  <ModeButton
                    active={state.mode === "dark"}
                    icon={Moon}
                    label={t("dark")}
                    onClick={() => commit((current) => ({ ...current, mode: "dark" }))}
                  />
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <SelectControl label={t("style")} value={state.style} onValueChange={(value) => commit((current) => applyVisualStyleToState(current, value as ThemeVisualStyleId))}>
                  {styleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectControl>

                <SelectControl label={t("iconLibrary")} value={state.iconLibrary} onValueChange={() => undefined}>
                  <SelectItem value="lucide">{t("lucideIcons")}</SelectItem>
                </SelectControl>

                <SelectControl label={t("baseColor")} value={state.baseColor} onValueChange={(value) => commit((current) => applyBaseColorToState(current, value as ThemeBaseColorId))}>
                  {baseColorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <span className="size-3 rounded-full border" style={{ backgroundColor: option.color }} />
                        {t(option.labelKey)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectControl>

                <SelectControl label={t("theme")} value={state.preset ?? "custom"} onValueChange={selectPreset}>
                  {state.preset === null && <SelectItem value="custom">{t("custom")}</SelectItem>}
                  {THEME_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <span className="flex items-center gap-2">
                        <ThemeSwatch colors={getThemeSwatches(preset.styles)} />
                        {preset.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectControl>

                <SelectControl label={t("menuColor")} value={state.menuColor} onValueChange={(value) => commit((current) => applyMenuColorToState(current, value as ThemeMenuColorId))}>
                  {menuColorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectControl>

                <SelectControl label={t("menuAccent")} value={state.menuAccent} onValueChange={(value) => commit((current) => applyMenuAccentToState(current, value as ThemeMenuAccentId))}>
                  {menuAccentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectControl>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-medium">{t("presets")}</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
                      <FileCode2 className="size-4" />
                      {t("import")}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={randomizePreset}>
                      <Dices className="size-4" />
                      {t("random")}
                    </Button>
                  </div>
                </div>
                <Select value={state.preset ?? "custom"} onValueChange={selectPreset}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder={t("chooseTheme")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{t("preBuiltThemes")}</SelectLabel>
                      {state.preset === null && <SelectItem value="custom">{t("custom")}</SelectItem>}
                      {THEME_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          <span className="flex items-center gap-2">
                            <ThemeSwatch colors={getThemeSwatches(preset.styles)} />
                            <span>{preset.label}</span>
                            {preset.badge && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {preset.badge}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </section>

              <Tabs defaultValue="colors" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="colors">{t("colors")}</TabsTrigger>
                  <TabsTrigger value="typography">{t("typography")}</TabsTrigger>
                  <TabsTrigger value="other">{t("other")}</TabsTrigger>
                </TabsList>

                <TabsContent value="colors" className="mt-4 space-y-3">
                  {colorGroups.map((group) => (
                    <CollapsibleSection key={group.value} title={t(group.labelKey)} defaultOpen={group.value === "brand"}>
                      <div className="space-y-4 pt-1">
                        {group.keys.map((item) => (
                          <ColorControl
                            key={item.key}
                            label={t(item.labelKey)}
                            value={activeStyles[item.key]}
                            onChange={(value) => liveCommit((current) => updateThemeValue(current, current.mode, item.key, value))}
                          />
                        ))}
                      </div>
                    </CollapsibleSection>
                  ))}
                </TabsContent>

                <TabsContent value="typography" className="mt-4 space-y-4">
                  <FontControl
                    label={t("fontSans")}
                    customLabel={t("custom")}
                    value={activeStyles["font-sans"]}
                    onChange={(value) => commit((current) => updateBothThemes(current, { "font-sans": value }))}
                  />
                  <FontControl
                    label={t("fontSerif")}
                    customLabel={t("custom")}
                    value={activeStyles["font-serif"]}
                    onChange={(value) => commit((current) => updateBothThemes(current, { "font-serif": value }))}
                  />
                  <FontControl
                    label={t("fontMono")}
                    customLabel={t("custom")}
                    value={activeStyles["font-mono"]}
                    onChange={(value) => commit((current) => updateBothThemes(current, { "font-mono": value }))}
                  />
                </TabsContent>

                <TabsContent value="other" className="mt-4 space-y-5">
                  <SliderControl
                    label={t("radius")}
                    value={toNumber(activeStyles.radius, 0.625)}
                    min={0}
                    max={2}
                    step={0.025}
                    unit="rem"
                    onChange={(value) => commit((current) => updateBothThemes(current, { radius: `${value}rem` }))}
                  />
                  <SliderControl
                    label={t("spacing")}
                    value={toNumber(activeStyles.spacing, 0.25)}
                    min={0.15}
                    max={0.35}
                    step={0.01}
                    unit="rem"
                    onChange={(value) => commit((current) => updateBothThemes(current, { spacing: `${value}rem` }))}
                  />

                  <CollapsibleSection title={t("shadow")} defaultOpen>
                    <div className="space-y-5 pt-1">
                      <ColorControl
                        label={t("shadowColor")}
                        value={activeStyles["shadow-color"]}
                        onChange={(value) => liveCommit((current) => updateThemeValue(current, current.mode, "shadow-color", value))}
                      />
                      <SliderControl
                        label={t("shadowOpacity")}
                        value={toNumber(activeStyles["shadow-opacity"], 0.1)}
                        min={0}
                        max={1}
                        step={0.01}
                        unit=""
                        onChange={(value) => commit((current) => updateThemeValue(current, state.mode, "shadow-opacity", `${value}`))}
                      />
                      <SliderControl
                        label={t("shadowBlur")}
                        value={toNumber(activeStyles["shadow-blur"], 3)}
                        min={0}
                        max={50}
                        step={0.5}
                        unit="px"
                        onChange={(value) => commit((current) => updateThemeValue(current, state.mode, "shadow-blur", `${value}px`))}
                      />
                      <SliderControl
                        label={t("shadowSpread")}
                        value={toNumber(activeStyles["shadow-spread"], 0)}
                        min={-50}
                        max={50}
                        step={0.5}
                        unit="px"
                        onChange={(value) => commit((current) => updateThemeValue(current, state.mode, "shadow-spread", `${value}px`))}
                      />
                      <SliderControl
                        label={t("shadowOffsetX")}
                        value={toNumber(activeStyles["shadow-offset-x"], 0)}
                        min={-50}
                        max={50}
                        step={0.5}
                        unit="px"
                        onChange={(value) => commit((current) => updateThemeValue(current, state.mode, "shadow-offset-x", `${value}px`))}
                      />
                      <SliderControl
                        label={t("shadowOffsetY")}
                        value={toNumber(activeStyles["shadow-offset-y"], 1)}
                        min={-50}
                        max={50}
                        step={0.5}
                        unit="px"
                        onChange={(value) => commit((current) => updateThemeValue(current, state.mode, "shadow-offset-y", `${value}px`))}
                      />
                    </div>
                  </CollapsibleSection>
                </TabsContent>
              </Tabs>

            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ImportDialog
        open={importOpen}
        error={cssError}
        value={cssText}
        onChange={(value) => {
          setCssText(value)
          setCssError(null)
        }}
        labels={{
          title: t("importTitle"),
          description: t("importDescription"),
          cancel: t("cancel"),
          import: t("import"),
        }}
        onCancel={() => {
          setImportOpen(false)
          setCssError(null)
          setCssText("")
        }}
        onImport={handleImport}
      />

      <VariablesDialog
        open={variablesOpen}
        css={themeCSS}
        labels={{
          title: t("variablesTitle"),
          description: t("variablesDescription"),
          copy: t("copyCss"),
        }}
        onOpenChange={setVariablesOpen}
        onCopy={copyThemeCSS}
      />
    </>
  )
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Sun
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
        active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background hover:bg-accent/60",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function SelectControl({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

function ThemeSwatch({ colors }: { colors: string[] }) {
  return (
    <span className="grid size-6 shrink-0 grid-cols-2 gap-px rounded border bg-background p-0.5">
      {colors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className={cn("rounded-[2px]", index === 3 && "rounded-full")}
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <section className="rounded-md border bg-background px-4 py-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left text-base font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pt-4">{children}</div>}
    </section>
  )
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const hexValue = colorToHex(value)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">{hexValue}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="relative flex size-9 shrink-0 overflow-hidden rounded-md border" style={{ backgroundColor: value }}>
          <input
            type="color"
            aria-label={label}
            value={hexValue}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-9 font-mono text-xs" />
      </div>
    </div>
  )
}

function FontControl({
  label,
  customLabel,
  value,
  onChange,
}: {
  label: string
  customLabel: string
  value: string
  onChange: (value: string) => void
}) {
  const currentOption = getFontOption(value)

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select
        value={currentOption ?? "custom"}
        onValueChange={(option) => {
          if (option === "custom") {
            return
          }
          onChange(FONT_OPTIONS[option as keyof typeof FONT_OPTIONS])
        }}
      >
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!currentOption && <SelectItem value="custom">{customLabel}</SelectItem>}
          {Object.entries(FONT_OPTIONS).map(([name, fontValue]) => (
            <SelectItem key={name} value={name}>
              <span style={{ fontFamily: fontValue }}>{name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-9 font-mono text-xs" />
    </div>
  )
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
            className="h-7 w-20 px-2 text-xs"
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => onChange(values[0] ?? value)}
        className="py-1"
      />
    </div>
  )
}

function ImportDialog({
  open,
  value,
  error,
  labels,
  onChange,
  onCancel,
  onImport,
}: {
  open: boolean
  value: string
  error: string | null
  labels: {
    title: string
    description: string
    cancel: string
    import: string
  }
  onChange: (value: string) => void
  onCancel: () => void
  onImport: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription className="sr-only">{labels.description}</DialogDescription>
        </DialogHeader>
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field-sizing-fixed min-h-72 max-h-[calc(90vh-12rem)] flex-1 resize-none overflow-auto font-mono text-xs"
          placeholder={`:root {
  --background: oklch(1 0 0);
  --primary: oklch(0.62 0.14 39.04);
}

.dark {
  --background: oklch(0.145 0 0);
  --primary: oklch(0.922 0 0);
}`}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {labels.cancel}
          </Button>
          <Button onClick={onImport}>{labels.import}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VariablesDialog({
  open,
  css,
  labels,
  onOpenChange,
  onCopy,
}: {
  open: boolean
  css: string
  labels: {
    title: string
    description: string
    copy: string
  }
  onOpenChange: (open: boolean) => void
  onCopy: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription className="sr-only">{labels.description}</DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-md border bg-muted/30">
          <Button size="sm" className="absolute right-3 top-3 z-10 gap-1.5" onClick={onCopy}>
            <Copy className="size-4" />
            {labels.copy}
          </Button>
          <ScrollArea className="max-h-[55vh]">
            <pre className="overflow-x-auto p-4 pr-28 text-xs leading-relaxed">
              <code>{css}</code>
            </pre>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getFontOption(value: string): string | null {
  const entry = Object.entries(FONT_OPTIONS).find(([, fontValue]) => fontValue === value)

  return entry?.[0] ?? null
}

function getCurrentThemeMode(): "light" | "dark" {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark"
  }

  return "light"
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}
