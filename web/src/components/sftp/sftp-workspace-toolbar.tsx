"use client"

import React, { startTransition, type HTMLAttributes } from "react"
import { GripVertical, Home, LayoutGrid, List, Maximize2, Minimize2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { TransferTaskPanel } from "@/components/sftp/transfer-task-panel"
import { ActivityLogPane } from "@/components/ssh-workspace/activity-log-pane"
import { useWorkspaceSftpTranslator } from "@/components/ssh-workspace/use-workspace-translator"
import type { WorkspaceTransferTask } from "@/lib/session/workspace"

export interface SftpWorkspaceToolbarProps {
  sessionLabel: string
  sessionColor?: string
  editingSessionLabel: boolean
  tempSessionLabel: string
  sessionLabelInputRef: React.RefObject<HTMLInputElement | null>
  dragHandleListeners?: HTMLAttributes<HTMLDivElement>
  dragHandleAttributes?: HTMLAttributes<HTMLDivElement>
  onTempSessionLabelChange: (value: string) => void
  onStartEditSessionLabel: () => void
  onFinishEditSessionLabel: () => void
  onCancelEditSessionLabel: () => void

  displayPath: string
  pathInputValue: string
  pathSegments: string[]
  isEditingPath: boolean
  isEditorOpen: boolean
  onPathInputValueChange: (value: string) => void
  onEditingPathChange: (value: boolean) => void
  onNavigate: (path: string) => void

  viewMode: "grid" | "list"
  onViewModeChange: (mode: "grid" | "list") => void
  showTransferTasks: boolean
  transferTasks: WorkspaceTransferTask[]
  onClearCompletedTransfers?: () => void
  onCancelTransfer?: (taskId: string) => void
  isFullscreen: boolean
  onToggleFullscreen?: () => void
  onDisconnect: () => void
}

export function SftpWorkspaceToolbar({
  sessionLabel,
  sessionColor,
  editingSessionLabel,
  tempSessionLabel,
  sessionLabelInputRef,
  dragHandleListeners,
  dragHandleAttributes,
  onTempSessionLabelChange,
  onStartEditSessionLabel,
  onFinishEditSessionLabel,
  onCancelEditSessionLabel,
  displayPath,
  pathInputValue,
  pathSegments,
  isEditingPath,
  isEditorOpen,
  onPathInputValueChange,
  onEditingPathChange,
  onNavigate,
  viewMode,
  onViewModeChange,
  showTransferTasks,
  transferTasks,
  onClearCompletedTransfers,
  onCancelTransfer,
  isFullscreen,
  onToggleFullscreen,
  onDisconnect,
}: SftpWorkspaceToolbarProps) {
  const tSftp = useWorkspaceSftpTranslator()

  const navigateHome = () => {
    startTransition(() => {
      onNavigate("/")
    })
  }

  const finishPathEdit = (nextPath: string) => {
    onEditingPathChange(false)
    const normalized = nextPath.trim()
    if (normalized && normalized !== displayPath) {
      onNavigate(normalized)
    } else {
      onPathInputValueChange(displayPath)
    }
  }

  return (
    <div className="border-b text-sm flex items-center justify-between px-3 py-1.5">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 px-1.5 py-0.5 -ml-1.5 rounded transition-colors"
          {...dragHandleListeners}
          {...dragHandleAttributes}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
          {sessionColor && (
            <div
              className="w-1 h-5 rounded-full"
              style={{ backgroundColor: sessionColor }}
            />
          )}
        </div>

        {editingSessionLabel ? (
          <Input
            ref={sessionLabelInputRef}
            value={tempSessionLabel}
            onChange={(event) => onTempSessionLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onFinishEditSessionLabel()
              } else if (event.key === "Escape") {
                onCancelEditSessionLabel()
              }
            }}
            onBlur={onFinishEditSessionLabel}
            className="h-6 text-xs font-semibold px-2 max-w-[150px] bg-background text-foreground"
          />
        ) : (
          <button
            onClick={onStartEditSessionLabel}
            onDoubleClick={onStartEditSessionLabel}
            className="text-xs font-semibold px-2 py-1 rounded transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
            title={tSftp("sessionEditTitle")}
          >
            {sessionLabel}
          </button>
        )}

        <div className="h-4 w-px mx-1 bg-border" />

        <div className="flex items-center gap-2 ml-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            {isEditingPath ? (
              <>
                <button
                  onClick={navigateHome}
                  className={cn(
                    "absolute left-2 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-md",
                    "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    "transition-all duration-200",
                  )}
                  title={tSftp("pathRootTooltip")}
                >
                  <Home className="h-3.5 w-3.5" />
                </button>
                <Input
                  value={pathInputValue}
                  onChange={(event) => onPathInputValueChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur()
                      finishPathEdit(event.currentTarget.value)
                    } else if (event.key === "Escape") {
                      onPathInputValueChange(displayPath)
                      onEditingPathChange(false)
                      event.currentTarget.blur()
                    }
                  }}
                  onBlur={(event) => finishPathEdit(event.target.value)}
                  autoFocus
                  placeholder={tSftp("pathInputPlaceholder")}
                  className="h-7 text-xs font-mono pl-8 pr-3 py-1 border-0 bg-muted placeholder:text-muted-foreground"
                />
              </>
            ) : (
              <div
                onClick={() => {
                  onPathInputValueChange(displayPath)
                  onEditingPathChange(true)
                }}
                className={cn(
                  "h-7 flex items-center gap-1 pl-8 pr-3 py-1 border-0 bg-muted",
                  "text-xs font-mono cursor-text rounded-md overflow-x-auto scrollbar-custom",
                  "hover:bg-accent transition-colors",
                )}
                title={tSftp("pathClickToEdit")}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    navigateHome()
                  }}
                  className={cn(
                    "absolute left-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md",
                    "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    "transition-all duration-200",
                  )}
                  title={tSftp("pathRootTooltip")}
                >
                  <Home className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    navigateHome()
                  }}
                  className="px-1.5 py-0.5 rounded-md whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                >
                  /
                </button>
                {pathSegments.map((segment, index) => {
                  const segmentPath = `/${pathSegments.slice(0, index + 1).join("/")}`
                  const isLastSegment = index === pathSegments.length - 1
                  const isFileName = isEditorOpen && isLastSegment

                  return (
                    <div key={index} className="flex items-center gap-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          if (isFileName) {
                            return
                          }
                          startTransition(() => {
                            onNavigate(segmentPath)
                          })
                        }}
                        className={cn(
                          "px-1.5 py-0.5 rounded-md whitespace-nowrap transition-all duration-200",
                          isFileName
                            ? "font-semibold text-primary cursor-default"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        {segment}
                      </button>
                      {index < pathSegments.length - 1 && <span className="text-muted-foreground/70">/</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-md transition-all duration-200",
            viewMode === "grid"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
          onClick={() => {
            startTransition(() => {
              onViewModeChange("grid")
            })
          }}
          title={tSftp("viewGridTooltip")}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-md transition-all duration-200",
            viewMode === "list"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
          onClick={() => {
            startTransition(() => {
              onViewModeChange("list")
            })
          }}
          title={tSftp("viewListTooltip")}
        >
          <List className="h-3.5 w-3.5" />
        </Button>

        {showTransferTasks && (
          <TransferTaskPanel
            transferTasks={transferTasks}
            onClearCompletedTransfers={onClearCompletedTransfers}
            onCancelTransfer={onCancelTransfer}
          />
        )}

        <ActivityLogPane compact />

        {onToggleFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md transition-all duration-200 text-muted-foreground hover:scale-105 hover:bg-accent hover:text-accent-foreground"
            onClick={onToggleFullscreen}
            title={isFullscreen ? tSftp("fullscreenExit") : tSftp("fullscreen")}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md transition-all duration-200 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={onDisconnect}
          title={tSftp("close")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
