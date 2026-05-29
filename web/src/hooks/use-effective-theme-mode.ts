"use client"

import { useEffect, useState } from "react"

import { useThemeGeneratorVersion } from "@/hooks/use-theme-generator-version"

export type EffectiveThemeMode = "light" | "dark"

function getDocumentThemeMode(): EffectiveThemeMode {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark"
  }

  return "light"
}

function getEffectiveThemeMode(): EffectiveThemeMode {
  return getDocumentThemeMode()
}

export function useEffectiveThemeMode() {
  const version = useThemeGeneratorVersion()
  const [mode, setMode] = useState<EffectiveThemeMode>(() => getEffectiveThemeMode())

  useEffect(() => {
    const updateMode = () => setMode(getEffectiveThemeMode())

    updateMode()

    const observer = new MutationObserver(updateMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setMode(getEffectiveThemeMode())
  }, [version])

  return { mode, version }
}
