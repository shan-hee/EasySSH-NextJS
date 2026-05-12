"use client"

import { useTranslations } from "next-intl"
import {
  Download,
  Trash2,
  Eye,
  Edit,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface FileItem {
  name: string
  type: "file" | "directory"
  size: string
  modified: string
  permissions: string
}

export type FileAction =
  | "open"
  | "download"
  | "rename"
  | "chmod"
  | "delete"

interface FileActionMenuProps {
  file: FileItem
  mode: "dropdown" | "context"
  selectedFilesCount?: number
  onAction: (action: FileAction) => void
}

type FileActionMenuItemProps = {
  mode: "dropdown" | "context"
  className: string
  onClick: () => void
  children: React.ReactNode
}

function FileActionMenuItem({
  mode,
  className,
  onClick,
  children,
}: FileActionMenuItemProps) {
  return mode === "dropdown" ? (
    <DropdownMenuItem className={className} onClick={onClick}>
      {children}
    </DropdownMenuItem>
  ) : (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  )
}

function FileActionMenuSeparator({ mode, className }: { mode: "dropdown" | "context"; className: string }) {
  return mode === "dropdown" ? (
    <DropdownMenuSeparator className={className} />
  ) : (
    <div className={className} />
  )
}

function KeyboardShortcut({ children }: { children: string }) {
  return (
    <kbd className={cn(
      "text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    )}>
      {children}
    </kbd>
  )
}

/**
 * 统一的文件操作菜单组件
 * 支持两种渲染模式：dropdown（行操作列）和 context（右键菜单）
 */
export function FileActionMenu({
  file,
  mode,
  selectedFilesCount = 0,
  onAction,
}: FileActionMenuProps) {
  const t = useTranslations("sftp")
  const isMultiSelect = selectedFilesCount > 1
  const isSingleSelect = selectedFilesCount === 1

  // 通用样式
  const itemClassName = mode === "dropdown"
    ? cn("focus:bg-blue-500 focus:text-white dark:focus:bg-blue-600")
    : cn("w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm")

  const separatorClassName = mode === "dropdown"
    ? cn("bg-zinc-200 dark:bg-zinc-700/50")
    : cn("h-px mx-2 my-1 bg-zinc-200 dark:bg-zinc-700/50")

  const deleteClassName = mode === "dropdown"
    ? cn("focus:bg-red-500 focus:text-white text-red-600 dark:text-red-400")
    : cn("w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 hover:text-destructive rounded-sm")

  return (
    <>
      {/* 打开/编辑 */}
      <FileActionMenuItem
        mode={mode}
        className={itemClassName}
        onClick={() => onAction("open")}
      >
        <Eye className="h-4 w-4 mr-2" />
        <span className="flex-1">
          {file.type === "directory" ? t("contextOpen") : t("contextEdit")}
        </span>
        <KeyboardShortcut>⏎</KeyboardShortcut>
      </FileActionMenuItem>

      {/* 下载：文件管理器只保留推荐下载路径，其他方案移动到传输任务页 */}
      {file.type === "file" || file.type === "directory" ? (
        <FileActionMenuItem
          mode={mode}
          className={itemClassName}
          onClick={() => onAction("download")}
        >
          <Download className="h-4 w-4 mr-2" />
          <span className="flex-1">{t("actionDownload")}</span>
          <KeyboardShortcut>⌘D</KeyboardShortcut>
        </FileActionMenuItem>
      ) : (
        null
      )}

      <FileActionMenuSeparator mode={mode} className={separatorClassName} />

      {/* 重命名 - 右键菜单仅单选时显示 */}
      {(mode === "dropdown" || isSingleSelect || selectedFilesCount === 0) && (
        <FileActionMenuItem
          mode={mode}
          className={itemClassName}
          onClick={() => onAction("rename")}
        >
          <Edit className="h-4 w-4 mr-2" />
          <span className="flex-1">{t("actionRename")}</span>
          <KeyboardShortcut>F2</KeyboardShortcut>
        </FileActionMenuItem>
      )}

      {/* 修改权限 - 右键菜单仅单选时显示 */}
      {(mode === "dropdown" || isSingleSelect || selectedFilesCount === 0) && (
        <FileActionMenuItem
          mode={mode}
          className={itemClassName}
          onClick={() => onAction("chmod")}
        >
          <FileText className="h-4 w-4 mr-2" />
          <span className="flex-1">{t("actionChangePermissions")}</span>
        </FileActionMenuItem>
      )}

      <FileActionMenuSeparator mode={mode} className={separatorClassName} />

      {/* 删除 */}
      <FileActionMenuItem
        mode={mode}
        className={deleteClassName}
        onClick={() => onAction("delete")}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        <span className="flex-1">
          {isMultiSelect
            ? t("actionDeleteMulti", { count: selectedFilesCount })
            : t("actionDeleteSingle")}
        </span>
        <KeyboardShortcut>⌫</KeyboardShortcut>
      </FileActionMenuItem>
    </>
  )
}
