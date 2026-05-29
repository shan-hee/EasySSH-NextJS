"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import {
  Check,
  Github,
  Languages,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/contexts/system-config-context"
import { authApi } from "@/lib/api/auth"
import { cn } from "@/lib/utils"
import { getEffectiveLocale, saveLocaleToStorage } from "@/utils/datetime"

type SupportedLocale = "zh-CN" | "en-US"
type ThemeMode = "light" | "dark" | "system"
type ThemePresetId = "default" | "nature" | "ocean" | "rose"

const THEME_PRESET_STORAGE_KEY = "easyssh-theme-preset"

const localeOptions: Array<{ value: SupportedLocale; labelKey: "languageZhCN" | "languageEnUS" }> = [
  { value: "zh-CN", labelKey: "languageZhCN" },
  { value: "en-US", labelKey: "languageEnUS" },
]

const themePresets: Array<{
  id: ThemePresetId
  labelKey: "themePresetDefault" | "themePresetNature" | "themePresetOcean" | "themePresetRose"
  colors: [string, string, string]
}> = [
  { id: "default", labelKey: "themePresetDefault", colors: ["#18181b", "#71717a", "#e4e4e7"] },
  { id: "nature", labelKey: "themePresetNature", colors: ["#307b34", "#d7ead8", "#111f18"] },
  { id: "ocean", labelKey: "themePresetOcean", colors: ["#2563eb", "#a7f3d0", "#0f172a"] },
  { id: "rose", labelKey: "themePresetRose", colors: ["#be123c", "#fbcfe8", "#1f2937"] },
]

const themeModes: Array<{ id: ThemeMode; labelKey: "modeLight" | "modeDark" | "modeSystem"; icon: typeof Sun }> = [
  { id: "light", labelKey: "modeLight", icon: Sun },
  { id: "dark", labelKey: "modeDark", icon: Moon },
  { id: "system", labelKey: "modeSystem", icon: Monitor },
]

export function DashboardHeaderActions() {
  const t = useTranslations("headerActions")
  const { user, refreshUser } = useClientAuth()
  const { config } = useSystemConfig()
  const { theme, setTheme } = useTheme()
  const [languageSaving, setLanguageSaving] = React.useState<SupportedLocale | null>(null)
  const [themePreset, setThemePreset] = React.useState<ThemePresetId>("default")

  const locale = React.useMemo(() => getEffectiveLocale(user, config), [user, config])
  const selectedMode: ThemeMode = theme === "light" || theme === "dark" || theme === "system" ? theme : "system"

  React.useEffect(() => {
    const savedPreset = readStoredThemePreset()
    setThemePreset(savedPreset)
    applyThemePreset(savedPreset)
  }, [])

  const handleLanguageChange = React.useCallback(
    async (nextLocale: SupportedLocale) => {
      if (nextLocale === locale || languageSaving) {
        return
      }

      const previousLocale = locale
      setLanguageSaving(nextLocale)
      saveLocaleToStorage(nextLocale)

      try {
        await authApi.updateProfile({ language: nextLocale })
        await refreshUser()
        toast.success(t("languageSaved"))
      } catch (error: unknown) {
        saveLocaleToStorage(previousLocale)
        toast.error(getErrorMessage(error, t("languageSaveFailed")))
      } finally {
        setLanguageSaving(null)
      }
    },
    [languageSaving, locale, refreshUser, t],
  )

  const handlePresetChange = React.useCallback((preset: ThemePresetId) => {
    setThemePreset(preset)
    applyThemePreset(preset)
    try {
      window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, preset)
    } catch (error) {
      console.warn("Failed to save theme preset:", error)
    }
  }, [])

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" aria-label={t("githubTooltip")}>
            <a href="https://github.com/shan-hee/EasySSH-NextJS" target="_blank" rel="noopener noreferrer">
              <Github />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("githubTooltip")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" aria-label={t("settingsTooltip")}>
            <Link href="/dashboard/settings">
              <SettingsIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("settingsTooltip")}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("languageTooltip")}>
                <Languages />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("languageTooltip")}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{t("languageTitle")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {localeOptions.map((option) => {
            const isSelected = option.value === locale
            const isSaving = languageSaving === option.value

            return (
              <DropdownMenuItem
                key={option.value}
                disabled={!!languageSaving}
                onSelect={() => {
                  void handleLanguageChange(option.value)
                }}
              >
                <span className="flex-1">{t(option.labelKey)}</span>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isSelected ? (
                  <Check className="size-4" />
                ) : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("themeTooltip")}>
                <Palette />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("themeTooltip")}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-[calc(100vw-2rem)] p-0 sm:w-80">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold">{t("themeTitle")}</div>
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{t("modeLabel")}</div>
              <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                {themeModes.map((mode) => {
                  const ModeIcon = mode.icon
                  const isSelected = selectedMode === mode.id

                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setTheme(mode.id)}
                      className={cn(
                        "inline-flex h-8 items-center justify-center gap-1.5 rounded-sm text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <ModeIcon className="size-3.5" />
                      {t(mode.labelKey)}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{t("presetLabel")}</div>
              <div className="space-y-1">
                {themePresets.map((preset) => {
                  const isSelected = themePreset === preset.id

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(preset.id)}
                      className={cn(
                        "flex h-10 w-full items-center gap-3 rounded-md border px-3 text-left text-sm transition-colors",
                        isSelected
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-background hover:bg-accent/70",
                      )}
                    >
                      <span className="flex items-center -space-x-1">
                        {preset.colors.map((color) => (
                          <span
                            key={color}
                            className="size-4 rounded-full border border-background shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                      <span className="flex-1 font-medium">{t(preset.labelKey)}</span>
                      {isSelected && <Check className="size-4" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function readStoredThemePreset(): ThemePresetId {
  if (typeof window === "undefined") {
    return "default"
  }

  try {
    const storedPreset = window.localStorage.getItem(THEME_PRESET_STORAGE_KEY)
    return isThemePresetId(storedPreset) ? storedPreset : "default"
  } catch (error) {
    console.warn("Failed to read theme preset:", error)
    return "default"
  }
}

function isThemePresetId(value: string | null): value is ThemePresetId {
  return value === "default" || value === "nature" || value === "ocean" || value === "rose"
}

function applyThemePreset(preset: ThemePresetId) {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement
  if (preset === "default") {
    root.removeAttribute("data-theme-preset")
    return
  }

  root.setAttribute("data-theme-preset", preset)
}

function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error && typeof error === "object") {
    if ("detail" in error) {
      const detail = error.detail
      if (typeof detail === "string") {
        return detail
      }
      if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") {
        return detail.message
      }
    }
    if ("message" in error && typeof error.message === "string") {
      return error.message
    }
  }

  return defaultMessage
}
