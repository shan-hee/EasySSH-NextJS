"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useTranslations } from "next-intl"

type ConfirmDialogVariant = "default" | "destructive"

interface ConfirmOptions {
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmDialogVariant
}

type PendingResolver = (confirmed: boolean) => void

export function useConfirmDialog(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  confirmDialog: ReactNode
} {
  const tCommon = useTranslations("common")
  const resolverRef = useRef<PendingResolver | null>(null)
  const [dialogState, setDialogState] = useState<(ConfirmOptions & { open: boolean }) | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => (
    new Promise<boolean>((resolve) => {
      resolverRef.current?.(false)
      resolverRef.current = resolve
      setDialogState({ ...options, open: true })
    })
  ), [])

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true)
    resolverRef.current = null
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setDialogState((current) => current ? { ...current, open } : current)
      return
    }

    resolverRef.current?.(false)
    resolverRef.current = null
    setDialogState(null)
  }, [])

  useEffect(() => () => {
    resolverRef.current?.(false)
    resolverRef.current = null
  }, [])

  const confirmDialog = dialogState ? (
    <ConfirmDialog
      open={dialogState.open}
      onOpenChange={handleOpenChange}
      title={dialogState.title ?? tCommon("confirm")}
      description={dialogState.description}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      variant={dialogState.variant}
      onConfirm={handleConfirm}
    />
  ) : null

  return { confirm, confirmDialog }
}
