import type { useTranslations } from "next-intl"
import type { Server as ManagedServer } from "@/lib/api"
import { getServerDisplayName } from "@/lib/server-utils"
import {
  ATTACHMENT_TEXT_PREVIEW_LIMIT,
  formatFileSize,
  type ComposerAttachment,
} from "./attachments"

type ComposerTranslate = ReturnType<typeof useTranslations>

export function sortReferencedServers(servers: ManagedServer[]) {
  return [...servers].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "online" ? -1 : 1
    }

    return getServerDisplayName(left).localeCompare(getServerDisplayName(right))
  })
}

export function buildAgentMessageContext({
  attachments,
  selectedServers,
  t,
}: {
  attachments: ComposerAttachment[]
  selectedServers: ManagedServer[]
  t: ComposerTranslate
}) {
  const sections: string[] = []

  if (selectedServers.length > 0) {
    const serverLines = [
      t("referenceContextHeader"),
      ...selectedServers.map((server) => (
        `- ${getServerDisplayName(server)} | ${server.username}@${server.host}:${server.port} | status=${server.status}`
      )),
      t("referenceContextRule"),
    ]

    sections.push(serverLines.join("\n"))
  }

  if (attachments.length > 0) {
    const attachmentLines = [t("attachmentContextHeader")]

    attachments.forEach((attachment) => {
      attachmentLines.push(`- ${attachment.name} (${formatFileSize(attachment.size)}, ${attachment.type || "unknown"})`)

      if (attachment.source === "text" && attachment.content) {
        attachmentLines.push(attachment.content)
        if (attachment.truncated) {
          attachmentLines.push(t("attachmentContextTruncated", { count: ATTACHMENT_TEXT_PREVIEW_LIMIT }))
        }
      } else {
        attachmentLines.push(t("attachmentContextMetadataOnly"))
      }
    })

    sections.push(attachmentLines.join("\n"))
  }

  return sections.length > 0 ? sections.join("\n\n") : undefined
}
