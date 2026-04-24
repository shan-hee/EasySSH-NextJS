export const MAX_COMPOSER_ATTACHMENTS = 5
export const ATTACHMENT_TEXT_READ_LIMIT = 64 * 1024
export const ATTACHMENT_TEXT_PREVIEW_LIMIT = 12_000

export type ComposerAttachment = {
  id: string
  name: string
  size: number
  type: string
  source: "text" | "metadata"
  content?: string
  truncated: boolean
}

const textExtensions = [
  ".txt",
  ".log",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".xml",
  ".csv",
  ".conf",
  ".ini",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".go",
  ".rs",
  ".java",
  ".sql",
  ".env",
]

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isTextLikeFile(file: File) {
  const lowerName = file.name.toLowerCase()

  return (
    file.type.startsWith("text/") ||
    file.type.includes("json") ||
    file.type.includes("xml") ||
    file.type.includes("yaml") ||
    file.type.includes("javascript") ||
    file.type.includes("typescript") ||
    textExtensions.some((extension) => lowerName.endsWith(extension))
  )
}

export async function createComposerAttachment(file: File): Promise<ComposerAttachment> {
  const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`

  if (!isTextLikeFile(file)) {
    return {
      id,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      source: "metadata",
      truncated: false,
    }
  }

  const rawText = await file.slice(0, ATTACHMENT_TEXT_READ_LIMIT).text()
  const sanitizedText = rawText.replace(/\u0000/g, "")
  const content = sanitizedText.slice(0, ATTACHMENT_TEXT_PREVIEW_LIMIT)
  const truncated =
    file.size > ATTACHMENT_TEXT_READ_LIMIT ||
    sanitizedText.length > ATTACHMENT_TEXT_PREVIEW_LIMIT

  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type || "text/plain",
    source: "text",
    content,
    truncated,
  }
}
