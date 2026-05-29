export const THEME_GENERATOR_CHANGE_EVENT = "easyssh-theme-generator-change"

export function dispatchThemeGeneratorChange() {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(THEME_GENERATOR_CHANGE_EVENT))
}
