"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Check, Palette } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useThemeGeneratorVersion } from "@/hooks/use-theme-generator-version"
import {
  THEME_PRESETS,
  applyThemeGeneratorState,
  applyThemePresetToState,
  createThemeGeneratorState,
  loadThemeGeneratorState,
  persistThemeGeneratorState,
} from "@/lib/theme-generator"
import { cn } from "@/lib/utils"

type ThemePreference = "light" | "dark" | "system"

const themeModeOptions: Array<{
  value: ThemePreference
  labelKey: "themeLight" | "themeDark" | "themeSystem"
}> = [
  { value: "light", labelKey: "themeLight" },
  { value: "dark", labelKey: "themeDark" },
  { value: "system", labelKey: "themeSystem" },
]

function getThemePreference(value: string | undefined): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value
  }

  return "system"
}

function getCurrentPresetId(): string | null {
  return loadThemeGeneratorState().preset
}

function getPresetLabel(id: string, label: string, defaultLabel: string) {
  return id === "default" ? defaultLabel : label
}

export function ThemeMenu() {
  const t = useTranslations("headerActions")
  const { theme, setTheme } = useTheme()
  const themeGeneratorVersion = useThemeGeneratorVersion()
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(() => getCurrentPresetId())
  const selectedMode = getThemePreference(theme)

  React.useEffect(() => {
    applyThemeGeneratorState(loadThemeGeneratorState())
  }, [])

  React.useEffect(() => {
    setSelectedPreset(getCurrentPresetId())
  }, [themeGeneratorVersion])

  const selectThemeMode = React.useCallback(
    (mode: ThemePreference) => {
      setTheme(mode)
    },
    [setTheme],
  )

  const selectPreset = React.useCallback((presetId: string) => {
    const nextState = applyThemePresetToState(createThemeGeneratorState(), presetId)

    persistThemeGeneratorState(nextState)
    applyThemeGeneratorState(nextState)
    setSelectedPreset(nextState.preset)
  }, [])

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("themeTooltip")}>
              <Palette />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("themeTooltip")}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-44">
        {themeModeOptions.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => selectThemeMode(option.value)}>
            <span className="flex-1">{t(option.labelKey)}</span>
            {selectedMode === option.value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SchemeDot presetId={selectedPreset} />
            <span className="flex-1">{t("themeScheme")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[min(24rem,calc(100vh-2rem))] w-44 overflow-y-auto scrollbar-custom">
            {THEME_PRESETS.map((preset) => (
              <DropdownMenuItem key={preset.id} onSelect={() => selectPreset(preset.id)}>
                <SchemeDot presetId={preset.id} />
                <span className="min-w-0 flex-1 truncate">
                  {getPresetLabel(preset.id, preset.label, t("themeSchemeDefault"))}
                </span>
                {selectedPreset === preset.id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SchemeDot({ presetId }: { presetId: string | null }) {
  const preset = THEME_PRESETS.find((item) => item.id === presetId) ?? THEME_PRESETS[0]
  const color = preset.styles.light.primary

  return (
    <span
      aria-hidden="true"
      className={cn("size-3 shrink-0 rounded-full border border-border", preset.id === "default" && "bg-primary")}
      style={{ backgroundColor: color }}
    />
  )
}
