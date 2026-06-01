"use client"

import type { ReactNode } from "react"
import { Database, FileArchive, FileAudio, FileCode, FileImage, FileText, FileVideo, FolderOpen } from "lucide-react"

export interface SftpFileIconItem {
  name: string
  type: "file" | "directory"
}

export interface SftpFileTypeInfo {
  color: string
  label: string
  icon: ReactNode
}

const FILE_TYPE_GROUPS = [
  { extensions: ["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "go", "rs", "sh", "bash"], color: "var(--chart-4)", iconClassName: "text-chart-4", icon: FileCode },
  { extensions: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico"], color: "var(--chart-5)", iconClassName: "text-chart-5", icon: FileImage },
  { extensions: ["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"], color: "var(--status-danger)", iconClassName: "text-status-danger", icon: FileVideo },
  { extensions: ["mp3", "wav", "flac", "aac", "ogg", "m4a"], color: "var(--chart-3)", iconClassName: "text-chart-3", icon: FileAudio },
  { extensions: ["zip", "tar", "gz", "rar", "7z", "bz2", "xz"], color: "var(--status-warning)", iconClassName: "text-status-warning", icon: FileArchive },
  { extensions: ["sql", "db", "sqlite", "mdb"], color: "var(--status-connected)", iconClassName: "text-status-connected", icon: Database },
  { extensions: ["txt", "md", "json", "xml", "yaml", "yml", "csv", "log"], color: "var(--chart-1)", iconClassName: "text-chart-1", icon: FileText },
]

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || ""
}

function getFileTypeGroup(fileName: string) {
  const extension = getExtension(fileName)
  return FILE_TYPE_GROUPS.find((group) => group.extensions.includes(extension))
}

export function getSftpFileTypeInfo(fileName: string): SftpFileTypeInfo {
  const extension = getExtension(fileName)
  const group = getFileTypeGroup(fileName)
  const Icon = group?.icon ?? FileText

  return {
    color: group?.color ?? "var(--muted-foreground)",
    label: extension.toUpperCase() || "FILE",
    icon: <Icon className="h-4 w-4" />,
  }
}

export function renderSftpFileListIcon(file: SftpFileIconItem) {
  if (file.type === "directory") {
    return <FolderOpen className="h-4 w-4 text-chart-1" />
  }

  const group = getFileTypeGroup(file.name)
  const Icon = group?.icon ?? FileText
  const iconClassName = group?.iconClassName ?? "text-muted-foreground"

  return <Icon className={`h-4 w-4 ${iconClassName}`} />
}
