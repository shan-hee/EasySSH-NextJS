"use client"

import { createPortal } from "react-dom"
import { Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TerminalHostKeyPrompt } from "@/lib/websocket-terminal"

export interface TerminalHostKeyDialogProps {
  prompt: TerminalHostKeyPrompt | null
  isTrusting: boolean
  labels: {
    title: string
    description: string
    expected: string
    received: string
    risk: string
    cancel: string
    trust: string
    trusting: string
  }
  onCancel: () => void
  onTrust: () => void
}

export function TerminalHostKeyDialog({
  prompt,
  isTrusting,
  labels,
  onCancel,
  onTrust,
}: TerminalHostKeyDialogProps) {
  if (!prompt || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
            <ShieldAlert className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">
              {labels.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {labels.description}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-md border border-border bg-muted/60 p-3">
            <div className="mb-3 font-medium text-foreground">
              {prompt.host}:{prompt.port}
            </div>
            <div className="grid gap-3">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {labels.expected}
                </div>
                <div className="break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
                  {prompt.expected_key}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {prompt.expected_key_type}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {labels.received}
                </div>
                <div className="break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
                  {prompt.received_key}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {prompt.received_key_type}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {labels.risk}
          </p>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isTrusting}
          >
            {labels.cancel}
          </Button>
          <Button
            type="button"
            onClick={onTrust}
            disabled={isTrusting}
          >
            {isTrusting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {labels.trusting}
              </>
            ) : (
              labels.trust
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
