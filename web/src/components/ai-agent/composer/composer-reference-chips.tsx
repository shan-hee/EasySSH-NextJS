"use client"

import type { useTranslations } from "next-intl"

import { FileText, Server as ServerIcon, X } from "lucide-react"

import type { Server as ManagedServer } from "@/lib/api"
import { getServerDisplayName, getServerShortName } from "@/lib/server-utils"
import { formatFileSize, type ComposerAttachment } from "./attachments"

type ComposerTranslate = ReturnType<typeof useTranslations>

export function ComposerReferenceChips({
  attachments,
  onClearServers,
  onRemoveAttachment,
  onToggleServer,
  selectedServers,
  t,
}: {
  attachments: ComposerAttachment[]
  onClearServers: () => void
  onRemoveAttachment: (attachmentId: string) => void
  onToggleServer: (serverId: string) => void
  selectedServers: ManagedServer[]
  t: ComposerTranslate
}) {
  if (selectedServers.length === 0 && attachments.length === 0) {
    return null
  }

  return (
    <div className="mb-2 flex flex-col gap-2 px-1">
      {selectedServers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("referencedServersLabel")}
          </span>
          {selectedServers.map((server) => (
            <span
              key={server.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground"
              title={getServerDisplayName(server)}
            >
              <ServerIcon className="size-3.5 text-muted-foreground" />
              <span className="max-w-[10rem] truncate">{getServerShortName(server)}</span>
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onToggleServer(server.id)}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClearServers}
          >
            {t("referenceServerClear")}
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("attachedFilesLabel")}
          </span>
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground"
              title={`${attachment.name} · ${formatFileSize(attachment.size)}`}
            >
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="max-w-[12rem] truncate">{attachment.name}</span>
              <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
              {attachment.truncated && (
                <span className="text-muted-foreground">{t("attachmentInlineTruncated")}</span>
              )}
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onRemoveAttachment(attachment.id)}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
