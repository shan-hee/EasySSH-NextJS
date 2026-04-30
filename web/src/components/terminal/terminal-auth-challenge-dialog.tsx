"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { createPortal } from "react-dom"
import { KeyRound, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TerminalAuthPrompt } from "@/lib/websocket-terminal"

interface TerminalAuthChallengeDialogProps {
  prompt: TerminalAuthPrompt | null
  serverName: string
  onSubmit: (answers: string[]) => void
  onCancel: () => void
}

function getAutocomplete(promptText: string, echo: boolean) {
  if (echo) {
    return "off"
  }

  const normalized = promptText.toLowerCase()
  if (
    normalized.includes("otp") ||
    normalized.includes("code") ||
    normalized.includes("验证码") ||
    normalized.includes("动态码") ||
    normalized.includes("passcode")
  ) {
    return "one-time-code"
  }

  return "current-password"
}

export function TerminalAuthChallengeDialog({
  prompt,
  serverName,
  onSubmit,
  onCancel,
}: TerminalAuthChallengeDialogProps) {
  const tTerminal = useTranslations("terminal")
  const [answers, setAnswers] = useState<string[]>([])
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  const prompts = useMemo(() => prompt?.prompts ?? [], [prompt])

  useEffect(() => {
    if (!prompt) {
      setAnswers([])
      return
    }

    setAnswers(new Array(prompt.prompts.length).fill(""))
    const timer = window.setTimeout(() => {
      firstInputRef.current?.focus()
      firstInputRef.current?.select()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [prompt])

  useEffect(() => {
    if (!prompt) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onCancel, prompt])

  if (!prompt || typeof document === "undefined") {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(answers)
  }

  const updateAnswer = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {tTerminal("authChallengeTitle")}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {tTerminal("authChallengeServer", { server: serverName })}
            </p>
          </div>
        </div>

        {(prompt.name || prompt.instruction) && (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
            {prompt.name && <div className="font-medium">{prompt.name}</div>}
            {prompt.instruction && (
              <div className={prompt.name ? "mt-1 whitespace-pre-wrap" : "whitespace-pre-wrap"}>
                {prompt.instruction}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {prompts.map((item, index) => {
            const inputId = `terminal-auth-${prompt.request_id}-${index}`

            return (
              <div key={`${prompt.request_id}-${index}`} className="space-y-2">
                <Label htmlFor={inputId} className="text-zinc-800 dark:text-zinc-200">
                  {item.text || tTerminal("authChallengePromptFallback", { index: index + 1 })}
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    ref={index === 0 ? firstInputRef : undefined}
                    id={inputId}
                    type={item.echo ? "text" : "password"}
                    value={answers[index] ?? ""}
                    onChange={(event) => updateAnswer(index, event.target.value)}
                    autoComplete={getAutocomplete(item.text, item.echo)}
                    className="pl-10"
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            {tTerminal("authChallengeCancel")}
          </Button>
          <Button type="submit">
            {tTerminal("authChallengeSubmit")}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  )
}
