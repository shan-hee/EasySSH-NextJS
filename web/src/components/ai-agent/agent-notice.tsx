"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type NoticeTone = "muted" | "warning" | "error"
type NoticeSize = "sm" | "md"

const toneClassNames: Record<NoticeTone, string> = {
  muted: "border-dashed border-border/60 bg-muted/20 text-muted-foreground",
  warning: "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-200",
  error: "border-destructive/20 bg-destructive/5 text-destructive",
}

const sizeClassNames: Record<NoticeSize, string> = {
  sm: "rounded-lg px-3 py-2 text-xs",
  md: "rounded-xl px-4 py-3 text-sm",
}

interface AgentNoticeCardProps {
  tone?: NoticeTone
  size?: NoticeSize
  title?: ReactNode
  children?: ReactNode
  className?: string
}

export function AgentNoticeCard({
  tone = "muted",
  size = "sm",
  title,
  children,
  className,
}: AgentNoticeCardProps) {
  return (
    <div className={cn("border", toneClassNames[tone], sizeClassNames[size], className)}>
      {title && <div className="font-medium">{title}</div>}
      {children && <div className={cn(title && "mt-1")}>{children}</div>}
    </div>
  )
}

interface AgentEmptyStateProps {
  children: ReactNode
  className?: string
}

export function AgentEmptyState({ children, className }: AgentEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}
