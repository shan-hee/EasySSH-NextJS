import { useEffect, useState } from "react"

import { THEME_GENERATOR_CHANGE_EVENT } from "@/lib/theme-generator-events"

export function useThemeGeneratorVersion() {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const updateVersion = () => setVersion((current) => current + 1)

    window.addEventListener(THEME_GENERATOR_CHANGE_EVENT, updateVersion)
    return () => window.removeEventListener(THEME_GENERATOR_CHANGE_EVENT, updateVersion)
  }, [])

  return version
}
