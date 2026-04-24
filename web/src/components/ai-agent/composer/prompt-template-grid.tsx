"use client"

import type { useTranslations } from "next-intl"

import { useMemo } from "react"
import { Bot, ChevronRight, Code2, FileText, Terminal, Zap } from "lucide-react"

import { cn } from "@/lib/utils"

type ComposerTranslate = ReturnType<typeof useTranslations>

export function PromptTemplateGrid({
  onUseTemplate,
  t,
}: {
  onUseTemplate: (prompt: string) => void
  t: ComposerTranslate
}) {
  const templates = useMemo(
    () => [
      {
        icon: Terminal,
        titleKey: "templateRunCommandTitle",
        descKey: "templateRunCommandDesc",
        promptKey: "templateRunCommandPrompt",
      },
      {
        icon: Code2,
        titleKey: "templateScriptTitle",
        descKey: "templateScriptDesc",
        promptKey: "templateScriptPrompt",
      },
      {
        icon: FileText,
        titleKey: "templateLogsTitle",
        descKey: "templateLogsDesc",
        promptKey: "templateLogsPrompt",
      },
      {
        icon: Zap,
        titleKey: "templatePerfTitle",
        descKey: "templatePerfDesc",
        promptKey: "templatePerfPrompt",
      },
    ],
    []
  )

  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Bot className="h-8 w-8 text-foreground" />
        </div>

        <h2 className="text-center text-2xl font-semibold">{t("cardTitle")}</h2>
        <p className="mt-3 max-w-2xl text-center text-muted-foreground">
          {t("emptyDescriptionIntro")}
        </p>

        <div className="mt-10 grid w-full max-w-3xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => {
            const Icon = template.icon
            return (
              <button
                key={template.titleKey}
                type="button"
                className={cn(
                  "group relative rounded-xl border border-border/60 bg-card/70 p-4 text-left shadow-sm transition-all duration-200",
                  "hover:border-primary/20 hover:bg-accent/30"
                )}
                onClick={() => onUseTemplate(t(template.promptKey))}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
                    <Icon className="h-5 w-5 text-foreground/80 group-hover:text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t(template.titleKey)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t(template.descKey)}</div>
                  </div>
                </div>
                <ChevronRight className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
