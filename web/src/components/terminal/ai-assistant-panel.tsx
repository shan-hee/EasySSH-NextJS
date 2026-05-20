"use client"

import { useState, useRef, useEffect, useCallback, type CSSProperties, type PointerEvent } from "react"
import Link from "next/link"
import {
  Check,
  History,
  Loader2,
  Pencil,
  Search,
  Settings2,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  X,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { DashboardAgentTimeline } from "@/components/ai-agent/dashboard-agent-timeline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/shadcn-io/ai/conversation"
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ui/shadcn-io/ai/prompt-input"
import { useAIConfig } from "@/hooks/use-ai-config"
import { useAgentSession } from "@/hooks/use-agent-session"
import {
  deleteAISession,
  listAISessions,
  renameAISession,
  type CreateSessionResponse,
  type SessionListItem,
} from "@/lib/api/ai-agent"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { cn } from "@/lib/utils"

const ANIMATION_DELAY = 160
const SESSION_LIST_LIMIT = 30
const PANEL_WIDTH_STORAGE_KEY = "easyssh:terminal-ai-assistant:panel-width"
const DEFAULT_PANEL_WIDTH = 420
const MIN_PANEL_WIDTH = 320
const MAX_PANEL_WIDTH = 720

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
}

function createSessionListItem(
  response: CreateSessionResponse,
  title: string
): SessionListItem {
  return {
    id: response.session_id,
    model: response.session.model,
    permission_mode: response.session.permission_mode,
    status: response.session.status,
    title,
    custom_title: false,
    message_count: response.session.messages.length,
    task_count: response.session.tasks.length,
    created_at: response.session.created_at,
    updated_at: response.session.updated_at,
  }
}

function formatSessionTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AiAssistantPanel({ isOpen, onClose }: AiAssistantPanelProps) {
  const tAI = useTranslations("aiAssistant")
  const { confirm: requestConfirm, confirmDialog } = useConfirmDialog()
  const { isConfigured, isLoading: isConfigLoading, models, model: defaultModel } = useAIConfig()
  const {
    session,
    sessionId,
    transport,
    timeline,
    tasks,
    error,
    canSend: canSendToSession,
    restoreLatestSession,
    restoreSession,
    startNewSession,
    sendMessage,
    confirmTask,
    cancelSession,
    closeSession,
  } = useAgentSession()

  const [input, setInput] = useState("")
  const [model, setModel] = useState("auto")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sessionSearch, setSessionSearch] = useState("")
  const [sessionList, setSessionList] = useState<SessionListItem[]>([])
  const [sessionListLoading, setSessionListLoading] = useState(false)
  const [sessionListError, setSessionListError] = useState("")
  const [sessionCreating, setSessionCreating] = useState(false)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [sessionActionLoadingId, setSessionActionLoadingId] = useState<string | null>(null)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [isResizing, setIsResizing] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const sessionCreatingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(DEFAULT_PANEL_WIDTH)
  const panelWidthStorageReadyRef = useRef(false)
  const resizeFrameRef = useRef<number | null>(null)
  const pendingPanelWidthRef = useRef(DEFAULT_PANEL_WIDTH)

  const modelOptions = models.length > 0 ? models : ["auto"]
  const resolvedModel =
    model && modelOptions.includes(model)
      ? model
      : (
          defaultModel && modelOptions.includes(defaultModel)
            ? defaultModel
            : modelOptions[0]
        )
  const activeModel = resolvedModel === "auto" ? undefined : resolvedModel
  const messageCount = timeline.filter((entry) => entry.kind === "message" && entry.data).length
  const runningTasks = tasks.filter((task) => task.status === "running" || task.status === "queued")
  const pendingConfirmationTasks = tasks.filter((task) => task.status === "waiting_confirm")
  const hasPendingAssistantMessage = timeline.some(
    (entry) => entry.kind === "message" && entry.data?.role === "assistant" && Boolean(entry.data.pending)
  )
  const isSessionRunning = session?.status === "running"
  const shouldShowLoadingIndicator =
    isSessionRunning &&
    !hasPendingAssistantMessage &&
    runningTasks.length === 0 &&
    pendingConfirmationTasks.length === 0
  const canSend =
    !!input.trim() &&
    isConfigured &&
    !isConfigLoading &&
    !sessionCreating &&
    (canSendToSession || (!session && transport === "idle") || session?.status === "closed")
  const createSessionDisabled = !isConfigured || isConfigLoading || sessionCreating
  const isCurrentSessionBlank = Boolean(
    session &&
    session.status !== "closed" &&
    timeline.length === 0 &&
    tasks.length === 0
  )
  const configStatusText = isConfigLoading
    ? tAI("checkingConfig")
    : !isConfigured
      ? tAI("aiNotConfigured")
      : `${resolvedModel} · ${transport === "ws" ? tAI("transportWs") : transport === "sse" ? tAI("transportSse") : transport === "connecting_ws" ? tAI("transportConnecting") : tAI("transportIdle")}`

  useEffect(() => {
    if (!isOpen) {
      setHistoryOpen(false)
      return
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, ANIMATION_DELAY)

    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !isConfigured || isConfigLoading || session || transport !== "idle" || error) {
      return
    }

    void restoreLatestSession().then((restored) => {
      if (restored) {
        return
      }

      void startNewSession({
        model: activeModel,
        permissionMode: "balanced",
      })
    })
  }, [
    isOpen,
    isConfigured,
    isConfigLoading,
    session,
    transport,
    error,
    restoreLatestSession,
    startNewSession,
    activeModel,
  ])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleEscClose = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }

      onClose()
    }

    window.addEventListener("keydown", handleEscClose)
    return () => {
      window.removeEventListener("keydown", handleEscClose)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY)
      const nextWidth = storedValue ? Number(storedValue) : DEFAULT_PANEL_WIDTH

      if (Number.isFinite(nextWidth)) {
        setPanelWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, nextWidth)))
      }
    } catch {
      // ignore unavailable storage
    } finally {
      panelWidthStorageReadyRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!panelWidthStorageReadyRef.current) {
      return
    }
    if (isResizing) {
      return
    }

    try {
      window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidth))
    } catch {
      // ignore unavailable storage
    }
  }, [isResizing, panelWidth])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    return () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing])

  useEffect(() => {
    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
      }
    }
  }, [])

  const handleResizeStart = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!isOpen) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartXRef.current = event.clientX
    dragStartWidthRef.current = panelRef.current?.getBoundingClientRect().width || panelWidth
    pendingPanelWidthRef.current = dragStartWidthRef.current
    setIsResizing(true)
  }, [isOpen, panelWidth])

  const handleResizeMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!isResizing) {
      return
    }

    const deltaX = dragStartXRef.current - event.clientX
    const nextWidth = Math.min(
      MAX_PANEL_WIDTH,
      Math.max(MIN_PANEL_WIDTH, dragStartWidthRef.current + deltaX)
    )

    pendingPanelWidthRef.current = nextWidth

    if (resizeFrameRef.current !== null) {
      return
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      setPanelWidth(pendingPanelWidthRef.current)
      resizeFrameRef.current = null
    })
  }, [isResizing])

  const handleResizeEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!isResizing) {
      return
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore missing capture
    }
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = null
    }
    setPanelWidth(pendingPanelWidthRef.current)
    setIsResizing(false)
  }, [isResizing])

  const loadSessionList = useCallback(async () => {
    if (!isConfigured || isConfigLoading) {
      return
    }

    setSessionListLoading(true)
    setSessionListError("")

    try {
      const response = await listAISessions({
        limit: SESSION_LIST_LIMIT,
        q: sessionSearch,
      })
      setSessionList(response.items)
    } catch {
      setSessionListError(tAI("sessionListLoadFailed"))
    } finally {
      setSessionListLoading(false)
    }
  }, [isConfigured, isConfigLoading, sessionSearch, tAI])

  useEffect(() => {
    if (historyOpen) {
      void loadSessionList()
    }
  }, [historyOpen, loadSessionList])

  const prependSessionListItem = useCallback((response: CreateSessionResponse) => {
    if (sessionSearch.trim()) {
      return
    }

    setSessionList((current) => [
      createSessionListItem(response, tAI("newSession")),
      ...current.filter((item) => item.id !== response.session_id),
    ].slice(0, SESSION_LIST_LIMIT))
  }, [sessionSearch, tAI])

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const handleCreateNewSession = useCallback(async () => {
    setInput("")

    if (createSessionDisabled || sessionCreatingRef.current) {
      return
    }

    if (isCurrentSessionBlank) {
      setHistoryOpen(false)
      focusComposer()
      return
    }

    sessionCreatingRef.current = true
    setSessionCreating(true)

    try {
      const response = await startNewSession({
        model: activeModel,
        permissionMode: "balanced",
      })

      if (response) {
        prependSessionListItem(response)
      }
    } finally {
      sessionCreatingRef.current = false
      setSessionCreating(false)
    }

    setHistoryOpen(false)
    focusComposer()
  }, [
    activeModel,
    createSessionDisabled,
    focusComposer,
    isCurrentSessionBlank,
    prependSessionListItem,
    startNewSession,
  ])

  const handleRestoreSession = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId || sessionCreatingRef.current || renamingSessionId) {
      return
    }

    if (targetSessionId === sessionId) {
      setHistoryOpen(false)
      focusComposer()
      return
    }

    const restored = await restoreSession(targetSessionId)
    if (restored) {
      setHistoryOpen(false)
      focusComposer()
    }
  }, [focusComposer, renamingSessionId, restoreSession, sessionId])

  const beginRenameSession = useCallback((item: SessionListItem) => {
    setRenamingSessionId(item.id)
    setRenameDraft(item.title)
  }, [])

  const cancelRenameSession = useCallback(() => {
    setRenamingSessionId(null)
    setRenameDraft("")
  }, [])

  const submitRenameSession = useCallback(async (targetSessionId: string) => {
    const title = renameDraft.trim()
    if (!title || sessionActionLoadingId) {
      return
    }

    setSessionActionLoadingId(targetSessionId)
    try {
      await renameAISession(targetSessionId, title)
      setSessionList((current) => current.map((item) => (
        item.id === targetSessionId
          ? { ...item, title, custom_title: true, updated_at: new Date().toISOString() }
          : item
      )))
      cancelRenameSession()
    } catch {
      setSessionListError(tAI("renameSessionFailed"))
    } finally {
      setSessionActionLoadingId(null)
    }
  }, [cancelRenameSession, renameDraft, sessionActionLoadingId, tAI])

  const handleDeleteSession = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId || sessionActionLoadingId) {
      return
    }

    const confirmed = await requestConfirm({
      description: tAI("deleteSessionConfirm"),
      variant: "destructive",
    })
    if (!confirmed) {
      return
    }

    setSessionActionLoadingId(targetSessionId)
    try {
      await deleteAISession(targetSessionId)
      setSessionList((current) => current.filter((item) => item.id !== targetSessionId))
      if (targetSessionId === sessionId) {
        await closeSession()
      }
      if (renamingSessionId === targetSessionId) {
        cancelRenameSession()
      }
    } catch {
      setSessionListError(tAI("deleteSessionFailed"))
    } finally {
      setSessionActionLoadingId(null)
    }
  }, [
    cancelRenameSession,
    closeSession,
    renamingSessionId,
    requestConfirm,
    sessionActionLoadingId,
    sessionId,
    tAI,
  ])

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()

    const normalizedInput = input.trim()
    if (!normalizedInput || !isConfigured || isConfigLoading || sessionCreatingRef.current) {
      return
    }

    if (session && session.status !== "closed" && !canSendToSession) {
      return
    }

    if (!session || session.status === "closed") {
      sessionCreatingRef.current = true
      setSessionCreating(true)

      let response: CreateSessionResponse | null = null
      try {
        response = await startNewSession({
          model: activeModel,
          permissionMode: "balanced",
        })
      } finally {
        sessionCreatingRef.current = false
        setSessionCreating(false)
      }

      if (!response) {
        return
      }

      prependSessionListItem(response)
    }

    const sent = await sendMessage(normalizedInput, undefined, activeModel, "balanced")
    if (sent) {
      setInput("")
    }
  }, [
    activeModel,
    canSendToSession,
    input,
    isConfigLoading,
    isConfigured,
    prependSessionListItem,
    sendMessage,
    session,
    startNewSession,
  ])

  return (
    <aside
      ref={panelRef}
      role="complementary"
      aria-label={tAI("panelAriaPanelLabel")}
      className={cn(
        "absolute inset-y-0 right-0 z-40 h-full min-h-0 w-full shrink-0 overflow-hidden text-foreground",
        "md:relative md:inset-auto md:translate-x-0",
        isResizing ? "transition-none" : "transition-all duration-200 ease-out",
        isOpen
          ? "translate-x-0 md:w-[var(--terminal-ai-panel-width)] md:max-w-[55vw]"
          : "translate-x-full md:w-0 md:max-w-[0px] md:border-l-0 md:shadow-none"
      )}
      style={{
        pointerEvents: isOpen ? "auto" : "none",
        "--terminal-ai-panel-width": `${panelWidth}px`,
      } as CSSProperties}
    >
      {confirmDialog}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex h-full min-h-0 w-full flex-col overflow-hidden border-l shadow-2xl backdrop-blur-xl",
          "border-zinc-200/70 bg-white/96",
          "dark:border-zinc-800/70 dark:bg-zinc-950/96",
          "md:w-[var(--terminal-ai-panel-width)]",
          "transition-opacity ease-out",
          isOpen
            ? "opacity-100 delay-75 duration-100"
            : "opacity-0 delay-0 duration-0"
        )}
        aria-hidden={!isOpen}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={tAI("resizePanel")}
          title={tAI("resizePanel")}
          className={cn(
            "absolute inset-y-0 left-0 z-10 hidden w-2 -translate-x-1 cursor-col-resize touch-none md:block",
            "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors",
            "hover:after:bg-primary/50",
            isResizing && "after:bg-primary"
          )}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
        />

        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200/70 px-3 dark:border-zinc-800/70">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{tAI("pageTitle")}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                isConfigLoading
                  ? "bg-amber-500"
                  : isConfigured
                    ? "bg-emerald-500"
                    : "bg-zinc-500"
              )}
            />
            <span className="truncate">{configStatusText}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-zinc-900"
                aria-label={tAI("sidebarTitle")}
                title={tAI("sidebarTitle")}
              >
                <History className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[330px] overflow-hidden rounded-lg border-zinc-200/80 p-0 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="border-b border-border/60 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={sessionSearch}
                    onChange={(event) => setSessionSearch(event.target.value)}
                    placeholder={tAI("searchPlaceholder")}
                    className="h-8 border-transparent bg-muted/50 pl-8 pr-8 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {sessionSearch && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
                      onClick={() => setSessionSearch("")}
                      aria-label={tAI("cancel")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[360px]">
                <div className="p-2">
                  {sessionListLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span>{tAI("loading")}</span>
                    </div>
                  ) : sessionListError ? (
                    <div className="px-3 py-10 text-center text-sm text-destructive">
                      {sessionListError}
                    </div>
                  ) : sessionList.length === 0 ? (
                    <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                      {tAI("sessionListEmpty")}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {sessionList.map((item) => {
                        const isActive = item.id === sessionId
                        const isRenaming = renamingSessionId === item.id
                        const isActionLoading = sessionActionLoadingId === item.id

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "w-full rounded-md px-2 py-2 text-left transition-colors",
                              isActive
                                ? "bg-accent text-foreground dark:bg-zinc-900"
                                : "text-foreground hover:bg-accent dark:hover:bg-zinc-900"
                            )}
                            onClick={() => void handleRestoreSession(item.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (isRenaming) {
                                return
                              }
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                void handleRestoreSession(item.id)
                              }
                            }}
                          >
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                {isRenaming ? (
                                  <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                    <Input
                                      autoFocus
                                      value={renameDraft}
                                      onChange={(event) => setRenameDraft(event.target.value)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault()
                                          void submitRenameSession(item.id)
                                        }
                                        if (event.key === "Escape") {
                                          event.preventDefault()
                                          cancelRenameSession()
                                        }
                                      }}
                                      className="h-7 min-w-0 text-xs"
                                      disabled={isActionLoading}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                                      disabled={isActionLoading}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void submitRenameSession(item.id)
                                      }}
                                      aria-label={tAI("saveSessionTitle")}
                                      title={tAI("saveSessionTitle")}
                                    >
                                      {isActionLoading ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <Check className="size-3.5" />
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                                      disabled={isActionLoading}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        cancelRenameSession()
                                      }}
                                      aria-label={tAI("cancel")}
                                      title={tAI("cancel")}
                                    >
                                      <X className="size-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="truncate text-sm font-medium">
                                    {item.title}
                                  </div>
                                )}
                              </div>

                              {!isRenaming && (
                                <div
                                  className="flex shrink-0 items-center gap-0.5 opacity-80"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    disabled={Boolean(sessionActionLoadingId)}
                                    onClick={() => beginRenameSession(item)}
                                    aria-label={tAI("rename")}
                                    title={tAI("rename")}
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-destructive"
                                    disabled={Boolean(sessionActionLoadingId)}
                                    onClick={() => void handleDeleteSession(item.id)}
                                    aria-label={tAI("delete")}
                                    title={tAI("delete")}
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-3.5" />
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span>{tAI("sidebarMessageCount", { count: item.message_count })}</span>
                              <span className="shrink-0">{formatSessionTime(item.updated_at)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-900"
            disabled={createSessionDisabled}
            onClick={() => void handleCreateNewSession()}
            aria-label={tAI("newSession")}
            title={tAI("newSession")}
          >
            {sessionCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SquarePen className="size-4" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-zinc-900"
            onClick={onClose}
            aria-label={tAI("panelHintClose")}
            title={tAI("panelHintClose")}
          >
            <X className="size-4" />
          </Button>
        </div>
        </div>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent
            aria-label={tAI("panelAriaHistoryLabel")}
            className="min-h-full px-4 py-4"
            scrollClassName="h-full w-full overflow-y-auto scrollbar-custom"
          >
            <DashboardAgentTimeline
              entries={timeline}
              tText={tAI}
              onConfirmTask={confirmTask}
              isAssistantLoading={shouldShowLoadingIndicator}
            />
          </ConversationContent>
          <ConversationScrollButton className="bottom-3 size-8" />
        </Conversation>

        <div className="shrink-0 border-t border-zinc-200/70 p-3 dark:border-zinc-800/70">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          )}

        <PromptInput
          onSubmit={handleSubmit}
          className="rounded-xl border-zinc-200/80 bg-zinc-50/95 shadow-lg ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900/95 dark:ring-white/5"
        >
          <PromptInputTextarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              isConfigLoading
                ? tAI("checkingConfig")
                : !isConfigured
                  ? tAI("aiNotConfiguredPlaceholder")
                  : tAI("panelInputPlaceholder")
            }
            minHeight={74}
            maxHeight={176}
            className="px-3 py-3 text-sm"
            disabled={
              isConfigLoading ||
              !isConfigured ||
              sessionCreating ||
              transport === "connecting_ws" ||
              (Boolean(session) && !canSendToSession && session?.status !== "closed")
            }
          />

          <PromptInputToolbar className="gap-2 px-2 py-1.5">
            <PromptInputTools>
              {isConfigured ? (
                <PromptInputModelSelect
                  value={resolvedModel}
                  onValueChange={setModel}
                >
                  <PromptInputModelSelectTrigger className="h-8 max-w-[180px] gap-1.5 rounded-md px-2 text-xs">
                    <Sparkles className="size-3.5 shrink-0" />
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {modelOptions.map((option) => (
                      <PromptInputModelSelectItem key={option} value={option}>
                        {option}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              ) : isConfigLoading ? (
                <div className="flex h-8 items-center gap-1.5 px-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{tAI("checkingConfig")}</span>
                </div>
              ) : (
                <Button
                  asChild
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
                >
                  <Link href="/dashboard/settings?tab=ai">
                    <Settings2 className="size-3.5" />
                    <span>{tAI("configureAI")}</span>
                  </Link>
                </Button>
              )}
            </PromptInputTools>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {tAI("sidebarMessageCount", { count: messageCount })}
              </span>

              {isSessionRunning ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-md"
                  onClick={() => void cancelSession()}
                  aria-label={tAI("stopGenerating")}
                  title={tAI("stopGenerating")}
                >
                  <Square className="size-3.5" />
                </Button>
              ) : (
                <PromptInputSubmit
                  disabled={!canSend}
                  className="size-8 rounded-md"
                  aria-label={tAI("send")}
                />
              )}
            </div>
          </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </aside>
  )
}
