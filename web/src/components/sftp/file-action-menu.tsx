"use client"

import {
  Download,
  Trash2,
  Eye,
  Edit,
  FileText,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  | "download-fast"
  | "download-compatible"
  | "rename"
  | "chmod"
  | "delete"

interface FileActionMenuProps {
  file: FileItem
  mode: "dropdown" | "context"
  selectedFilesCount?: number
  onAction: (action: FileAction) => void
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
  const isContext = mode === "context"
  const isMultiSelect = selectedFilesCount > 1
  const isSingleSelect = selectedFilesCount === 1

  // 根据模式选择不同的组件类型
  const MenuItem = mode === "dropdown" ? DropdownMenuItem : "button"
  const Separator = mode === "dropdown" ? DropdownMenuSeparator : "div"

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

  // 快捷键组件 - 两个菜单都显示
  const KeyboardShortcut = ({ children }: { children: string }) => {
    return (
      <kbd className={cn(
        "text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
      )}>
        {children}
      </kbd>
    )
  }

  // 推荐标签 - 两个菜单都显示
  const RecommendedBadge = () => {
    return (
      <span className={cn(
        "text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary",
      )}>
        推荐
      </span>
    )
  }

  // 下载选项的 Tooltip 包装器 - 两个菜单都显示
  const DownloadTooltip = ({
    children,
    content
  }: {
    children: React.ReactNode
    content: string
  }) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="max-w-[280px]">
          {content}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      {/* 打开/编辑 */}
      <MenuItem
        className={itemClassName}
        onClick={() => onAction("open")}
      >
        <Eye className="h-4 w-4 mr-2" />
        <span className="flex-1">{file.type === "directory" ? "打开" : "编辑"}</span>
        <KeyboardShortcut>⏎</KeyboardShortcut>
      </MenuItem>

      {/* 下载 */}
      {file.type === "file" ? (
        /* 单文件下载 */
        <MenuItem
          className={itemClassName}
          onClick={() => onAction("download")}
        >
          <Download className="h-4 w-4 mr-2" />
          <span className="flex-1">下载</span>
          <KeyboardShortcut>⌘D</KeyboardShortcut>
        </MenuItem>
      ) : (
        /* 文件夹下载 - 双选项 */
        <>
          {/* 快速下载 */}
          <DownloadTooltip content="远程 tar/zip 压缩，智能排除常见大目录，速度快 10-50 倍（需服务器支持 tar）">
            <MenuItem
              className={itemClassName}
              onClick={() => onAction("download-fast")}
            >
              <Zap className="h-4 w-4 mr-2 text-yellow-500" />
              <span className="flex-1">快速下载</span>
              <RecommendedBadge />
            </MenuItem>
          </DownloadTooltip>

          {/* 兼容下载 */}
          <DownloadTooltip content="SFTP 逐文件传输，兼容所有服务器，自动跳过排除目录">
            <MenuItem
              className={itemClassName}
              onClick={() => onAction("download-compatible")}
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="flex-1">兼容下载</span>
              <KeyboardShortcut>⌘D</KeyboardShortcut>
            </MenuItem>
          </DownloadTooltip>
        </>
      )}

      <Separator className={separatorClassName} />

      {/* 重命名 - 右键菜单仅单选时显示 */}
      {(mode === "dropdown" || isSingleSelect || selectedFilesCount === 0) && (
        <MenuItem
          className={itemClassName}
          onClick={() => onAction("rename")}
        >
          <Edit className="h-4 w-4 mr-2" />
          <span className="flex-1">重命名</span>
          <KeyboardShortcut>F2</KeyboardShortcut>
        </MenuItem>
      )}

      {/* 修改权限 - 右键菜单仅单选时显示 */}
      {(mode === "dropdown" || isSingleSelect || selectedFilesCount === 0) && (
        <MenuItem
          className={itemClassName}
          onClick={() => onAction("chmod")}
        >
          <FileText className="h-4 w-4 mr-2" />
          <span className="flex-1">修改权限</span>
        </MenuItem>
      )}

      <Separator className={separatorClassName} />

      {/* 删除 */}
      <MenuItem
        className={deleteClassName}
        onClick={() => onAction("delete")}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        <span className="flex-1">
          {isMultiSelect ? `删除 ${selectedFilesCount} 项` : "删除"}
        </span>
        <KeyboardShortcut>⌫</KeyboardShortcut>
      </MenuItem>
    </>
  )
}
