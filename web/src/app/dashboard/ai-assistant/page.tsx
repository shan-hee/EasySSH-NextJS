"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { Check, History, Loader2, Pencil, Plus, RefreshCw, Search, Send, Server as ServerIcon, Shield, Square, SquarePen, Trash2, X } from "lucide-react"

import { DashboardAgentTimeline } from "@/components/ai-agent/dashboard-agent-timeline"
import {
  ComposerReferenceChips,
  MAX_COMPOSER_ATTACHMENTS,
  PromptTemplateGrid,
  buildAgentMessageContext,
  createComposerAttachment,
  sortReferencedServers,
  type ComposerAttachment,
} from "@/components/ai-agent/composer"
import { PageHeader } from "@/components/page-header"
import { toast } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/shadcn-io/ai/conversation"
import { AgentNoticeCard } from "@/components/ai-agent/agent-notice"
import { useAgentSession } from "@/hooks/use-agent-session"
import { useAIConfig } from "@/hooks/use-ai-config"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { serversApi, type Server as ManagedServer } from "@/lib/api"
import { deleteAISession, listAISessions, renameAISession, type CreateSessionResponse, type PermissionMode, type SessionListItem } from "@/lib/api/ai-agent"
import { getLatestRemoteOutputKindAfterLatestUserMessage } from "@/lib/ai-agent/timeline-utils"
import { getServerDisplayName } from "@/lib/server-utils"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

const SESSION_LIST_LIMIT = 30

function createSessionListItem(response: CreateSessionResponse, title: string): SessionListItem {
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

export default function AIAssistantPage() {
  const t = useTranslations("aiAssistant")
  const { ready } = useAuthReady()
  const { confirm: requestConfirm, confirmDialog } = useConfirmDialog()
  const { isLoading, isConfigured, models } = useAIConfig()
  const agentSession = useAgentSession()
  const { session, sessionId, pendingConfirmationTasks, error, restoreLatestSession, restoreSession, startNewSession, sendMessage, confirmTask, cancelSession, closeSession } = agentSession

  const [draft, setDraft] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("balanced")
  const [availableServers, setAvailableServers] = useState<ManagedServer[]>([])
  const [serversLoading, setServersLoading] = useState(false)
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([])
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [sessionList, setSessionList] = useState<SessionListItem[]>([])
  const [sessionListLoading, setSessionListLoading] = useState(false)
  const [sessionListError, setSessionListError] = useState("")
  const [sessionSearch, setSessionSearch] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sessionCreating, setSessionCreating] = useState(false)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [sessionActionLoadingId, setSessionActionLoadingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sessionCreatingRef = useRef(false)

  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0])
    }
  }, [models, selectedModel])

  const loadServers = useCallback(async () => {
    if (!ready) {
      return
    }

    setServersLoading(true)

    try {
      const response = await serversApi.list({ limit: 1000 })
      setAvailableServers(sortReferencedServers(response.data))
    } catch {
      toast.error(t("toastLoadServersFailed"))
    } finally {
      setServersLoading(false)
    }
  }, [ready, t])

  useEffect(() => {
    void loadServers()
  }, [loadServers])

  useEffect(() => {
    if (!ready || isLoading || !isConfigured || session || agentSession.transport !== "idle") {
      return
    }

    void restoreLatestSession()
  }, [agentSession.transport, isConfigured, isLoading, ready, restoreLatestSession, session])

  const permissionOptions = useMemo(
    () =>
      [
        {
          value: "balanced" as const,
          label: t("permissionModeBalanced"),
          description: t("permissionModeBalancedDesc"),
        },
        {
          value: "privileged" as const,
          label: t("permissionModePrivileged"),
          description: t("permissionModePrivilegedDesc"),
        },
      ],
    [t]
  )

  const visibleTimeline = useMemo(
    () => agentSession.timeline.filter((entry) => entry.kind !== "confirmation"),
    [agentSession.timeline]
  )
  const selectedServers = useMemo(
    () => availableServers.filter((server) => selectedServerIds.includes(server.id)),
    [availableServers, selectedServerIds]
  )
  const isConfigChecking = !ready || isLoading
  const showConfigAction = ready && !isLoading && !isConfigured
  const modelSelectDisabled = isConfigChecking || !isConfigured || models.length === 0
  const serverReferenceDisabled = !ready || isLoading || !isConfigured
  const attachmentDisabled = attachmentsLoading || attachments.length >= MAX_COMPOSER_ATTACHMENTS || !ready || isLoading || !isConfigured

  const hasTimeline = visibleTimeline.length > 0
  const isSessionRunning = session?.status === "running"
  const runningTasks = agentSession.tasks.filter((task) => task.status === "running" || task.status === "queued")
  const hasPendingAssistantMessage = visibleTimeline.some(
    (entry) => entry.kind === "message" && entry.data?.role === "assistant" && Boolean(entry.data.pending)
  )
  const latestRemoteOutputKind = getLatestRemoteOutputKindAfterLatestUserMessage(visibleTimeline)
  const shouldShowLoadingIndicator =
    isSessionRunning &&
    !hasPendingAssistantMessage &&
    runningTasks.length === 0 &&
    pendingConfirmationTasks.length === 0
  const assistantLoadingState = shouldShowLoadingIndicator
    ? latestRemoteOutputKind && latestRemoteOutputKind !== "assistant"
      ? "thinking"
      : "waiting"
    : false
  const isCurrentSessionBlank = Boolean(
    session &&
    session.status !== "closed" &&
    visibleTimeline.length === 0 &&
    agentSession.tasks.length === 0
  )
  const createSessionDisabled = !ready || isLoading || !isConfigured || sessionCreating
  const canSubmit =
    Boolean(draft.trim()) &&
    ready &&
    !isLoading &&
    !attachmentsLoading &&
    isConfigured &&
    !sessionCreating &&
    (!session || session.status === "idle" || session.status === "closed")

  const buildMessageContext = useCallback(
    () => buildAgentMessageContext({ attachments, selectedServers, t }),
    [attachments, selectedServers, t]
  )

  const prependSessionListItem = useCallback((response: CreateSessionResponse) => {
    if (sessionSearch.trim()) {
      return
    }

    setSessionList((current) => [
      createSessionListItem(response, t("newSession")),
      ...current.filter((item) => item.id !== response.session_id),
    ].slice(0, SESSION_LIST_LIMIT))
  }, [sessionSearch, t])

  const submit = async () => {
    const normalizedDraft = draft.trim()
    if (!normalizedDraft || !ready || isLoading || !isConfigured || attachmentsLoading || sessionCreatingRef.current) {
      return
    }

    if (session && session.status !== "idle" && session.status !== "closed") {
      return
    }

    if (!sessionId || session?.status === "closed") {
      sessionCreatingRef.current = true
      setSessionCreating(true)

      let response: CreateSessionResponse | null = null
      try {
        response = await startNewSession({
          model: selectedModel || undefined,
          permissionMode,
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

    const contextText = buildMessageContext()
    const sent = await sendMessage(normalizedDraft, contextText, selectedModel || undefined, permissionMode)
    if (sent) {
      setDraft("")
      setAttachments([])
    }
  }

  const handleUseTemplate = (prompt: string) => {
    setDraft(prompt)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const handleCreateNewSession = async () => {
    setDraft("")
    setAttachments([])

    if (sessionCreatingRef.current) {
      return
    }

    if (isCurrentSessionBlank) {
      setHistoryOpen(false)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
      return
    }

    sessionCreatingRef.current = true
    setSessionCreating(true)

    try {
      const response = await startNewSession({
        model: selectedModel || undefined,
        permissionMode,
      })

      if (response) {
        prependSessionListItem(response)
      }
    } finally {
      sessionCreatingRef.current = false
      setSessionCreating(false)
    }

    setHistoryOpen(false)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const loadSessionList = useCallback(async () => {
    if (!ready || isLoading || !isConfigured) {
      return
    }

    setSessionListLoading(true)
    try {
      setSessionListError("")
      const response = await listAISessions({ limit: SESSION_LIST_LIMIT, q: sessionSearch })
      setSessionList(response.items)
    } catch {
      setSessionListError(t("sessionListLoadFailed"))
    } finally {
      setSessionListLoading(false)
    }
  }, [isConfigured, isLoading, ready, sessionSearch, t])

  useEffect(() => {
    if (historyOpen) {
      void loadSessionList()
    }
  }, [historyOpen, loadSessionList])

  const handleRestoreSession = async (targetSessionId: string) => {
    if (!targetSessionId || sessionCreatingRef.current || renamingSessionId) {
      return
    }

    if (targetSessionId === sessionId) {
      setHistoryOpen(false)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
      return
    }

    const restored = await restoreSession(targetSessionId)
    if (restored) {
      setHistoryOpen(false)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }

  const beginRenameSession = (item: SessionListItem) => {
    setRenamingSessionId(item.id)
    setRenameDraft(item.title)
  }

  const cancelRenameSession = () => {
    setRenamingSessionId(null)
    setRenameDraft("")
  }

  const submitRenameSession = async (targetSessionId: string) => {
    const title = renameDraft.trim()
    if (sessionActionLoadingId) {
      return
    }

    if (!title) {
      toast.error("会话名称不能为空")
      return
    }

    setSessionActionLoadingId(targetSessionId)
    try {
      await renameAISession(targetSessionId, title)
      cancelRenameSession()
      setSessionList((current) => current.map((item) => (
        item.id === targetSessionId
          ? { ...item, title, custom_title: true, updated_at: new Date().toISOString() }
          : item
      )))
      toast.success("会话已重命名")
    } catch {
      toast.error(t("renameSessionFailed"))
    } finally {
      setSessionActionLoadingId(null)
    }
  }

  const handleDeleteSession = async (targetSessionId: string) => {
    if (!targetSessionId || sessionActionLoadingId) {
      return
    }

    const confirmed = await requestConfirm({
      description: t("deleteSessionConfirm"),
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
      toast.success("会话已删除")
    } catch {
      toast.error(t("deleteSessionFailed"))
    } finally {
      setSessionActionLoadingId(null)
    }
  }

  const toggleServerSelection = useCallback((serverId: string) => {
    setSelectedServerIds((current) => (
      current.includes(serverId)
        ? current.filter((item) => item !== serverId)
        : [...current, serverId]
    ))
  }, [])

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  }, [])

  const handleAttachmentSelection = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files

    if (!fileList || fileList.length === 0) {
      return
    }

    const files = Array.from(fileList)
    const remainingSlots = MAX_COMPOSER_ATTACHMENTS - attachments.length

    if (remainingSlots <= 0) {
      toast.info(t("attachmentLimitHint", { count: MAX_COMPOSER_ATTACHMENTS }))
      event.target.value = ""
      return
    }

    if (files.length > remainingSlots) {
      toast.info(t("attachmentLimitHint", { count: MAX_COMPOSER_ATTACHMENTS }))
    }

    setAttachmentsLoading(true)

    try {
      const nextAttachments = await Promise.all(
        files.slice(0, remainingSlots).map(async (file) => {
          try {
            return await createComposerAttachment(file)
          } catch {
            toast.error(t("attachmentReadFailed", { file: file.name }))
            return null
          }
        })
      )

      setAttachments((current) => [
        ...current,
        ...nextAttachments.filter((attachment): attachment is ComposerAttachment => attachment !== null),
      ])
    } finally {
      setAttachmentsLoading(false)
      event.target.value = ""
    }
  }, [attachments.length, t])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {confirmDialog}
      <PageHeader title={t("pageTitle")}>
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-zinc-900"
              aria-label={t("sidebarTitle")}
              title={t("sidebarTitle")}
            >
              <History className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[330px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border-zinc-200/80 p-0 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="border-b border-border/60 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={sessionSearch}
                  onChange={(event) => setSessionSearch(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="h-8 border-transparent bg-muted/50 pl-8 pr-8 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {sessionSearch && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => setSessionSearch("")}
                    aria-label={t("cancel")}
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
                    <span>{t("loading")}</span>
                  </div>
                ) : sessionListError ? (
                  <div className="px-3 py-10 text-center text-sm text-destructive">
                    {sessionListError}
                  </div>
                ) : sessionList.length === 0 ? (
                  <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {t("sessionListEmpty")}
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
                                    aria-label={t("saveSessionTitle")}
                                    title={t("saveSessionTitle")}
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
                                    aria-label={t("cancel")}
                                    title={t("cancel")}
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
                                  aria-label={t("rename")}
                                  title={t("rename")}
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
                                  aria-label={t("delete")}
                                  title={t("delete")}
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
                            <span>{t("sidebarMessageCount", { count: item.message_count })}</span>
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
          aria-label={t("newSession")}
          title={t("newSession")}
        >
          {sessionCreating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SquarePen className="size-4" />
          )}
        </Button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full min-w-0 overflow-y-auto pb-4 md:pb-6 lg:overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              {hasTimeline ? (
                <Conversation className="h-full w-full">
                  <ConversationContent
                    className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-6"
                    scrollClassName="h-full w-full overflow-y-auto scrollbar-custom"
                  >
                    <DashboardAgentTimeline
                      entries={visibleTimeline}
                      tText={t}
                      onConfirmTask={confirmTask}
                      assistantLoadingState={assistantLoadingState}
                    />
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
              ) : (
                <PromptTemplateGrid onUseTemplate={handleUseTemplate} t={t} />
              )}
            </div>

            <div className="shrink-0 pt-4">
            {ready && isConfigured && pendingConfirmationTasks.length > 0 && (
              <div className="mx-auto mb-3 w-full max-w-[72rem] rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  <Shield className="size-4" />
                  {t("pendingConfirmationTitle")}
                </div>
                <div className="mt-1 text-sm text-amber-700/90 dark:text-amber-200/80">
                  {t("pendingConfirmationDesc")}
                </div>

                <div className="mt-3 space-y-2">
                  {pendingConfirmationTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-amber-500/20 bg-background/70 px-3 py-3">
                      <div className="text-sm font-medium">{task.tool_display_name || task.tool_name}</div>
                      {task.summary && <div className="mt-1 text-sm text-muted-foreground">{task.summary}</div>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => confirmTask(task.id, "confirm")}>
                          {t("confirmAction")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => confirmTask(task.id, "reject")}>
                          {t("rejectAction")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <AgentNoticeCard tone="error" size="md" className="mx-auto mb-3 w-full max-w-[72rem] shadow-sm">
                {error}
              </AgentNoticeCard>
            )}

            <div className="mx-auto w-full max-w-[72rem]">
              <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => void handleAttachmentSelection(event)}
                />

              <ComposerReferenceChips
                  attachments={attachments}
                  onClearServers={() => setSelectedServerIds([])}
                  onRemoveAttachment={removeAttachment}
                  onToggleServer={toggleServerSelection}
                  selectedServers={selectedServers}
                  t={t}
                />

              <PromptInput
                  className="border-border/60 bg-card/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-card/80"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submit()
                  }}
                >
                <PromptInputTextarea
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={hasTimeline ? t("composerPlaceholder") : t("inputPlaceholder")}
                    minHeight={56}
                    maxHeight={180}
                    className="px-4 pt-3 text-sm"
                  />

                <PromptInputToolbar className="flex-wrap gap-3 px-2 py-1.5">
                  <PromptInputTools className="flex flex-wrap items-center gap-2">
                    <PromptInputModelSelect
                        value={selectedModel}
                        onValueChange={setSelectedModel}
                        disabled={modelSelectDisabled}
                      >
                      <PromptInputModelSelectTrigger className="h-9 rounded-md border-none !bg-transparent px-2.5 text-xs font-normal text-muted-foreground !shadow-none hover:!bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:!bg-transparent dark:hover:!bg-transparent [aria-expanded='true']:!bg-transparent [aria-expanded='true']:text-foreground sm:text-sm">
                        <PromptInputModelSelectValue placeholder={t("modelPlaceholder")} />
                        </PromptInputModelSelectTrigger>
                      <PromptInputModelSelectContent>
                          {models.map((model) => (
                          <PromptInputModelSelectItem key={model} value={model}>
                              {model}
                            </PromptInputModelSelectItem>
                          ))}
                        </PromptInputModelSelectContent>
                      </PromptInputModelSelect>

                    <PromptInputModelSelect
                        value={permissionMode}
                        onValueChange={(value) => setPermissionMode(value as PermissionMode)}
                        disabled={isConfigChecking}
                      >
                      <PromptInputModelSelectTrigger className="h-9 rounded-md border-none !bg-transparent px-2.5 text-xs font-normal text-muted-foreground !shadow-none hover:!bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:!bg-transparent dark:hover:!bg-transparent [aria-expanded='true']:!bg-transparent [aria-expanded='true']:text-foreground sm:text-sm">
                        <PromptInputModelSelectValue />
                        </PromptInputModelSelectTrigger>
                      <PromptInputModelSelectContent>
                          {permissionOptions.map((option) => (
                          <PromptInputModelSelectItem key={option.value} value={option.value}>
                              {option.label}
                            </PromptInputModelSelectItem>
                          ))}
                        </PromptInputModelSelectContent>
                      </PromptInputModelSelect>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-2 bg-transparent px-2.5 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                            disabled={serverReferenceDisabled}
                          >
                            <ServerIcon className="size-3.5" />
                            <span className="hidden sm:inline">
                              {selectedServerIds.length > 0
                                ? t("referenceServerSelected", { count: selectedServerIds.length })
                                : t("referenceServer")}
                            </span>
                            <span className="sm:hidden">
                              {selectedServerIds.length > 0 ? selectedServerIds.length : t("referenceServer")}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[340px] p-0">
                          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                            <span>{t("referenceServerHint")}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => void loadServers()}
                                disabled={serversLoading}
                              >
                                <RefreshCw className={cn("size-3.5", serversLoading && "animate-spin")} />
                              </Button>
                              {selectedServerIds.length > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setSelectedServerIds([])}
                                >
                                  {t("referenceServerClear")}
                                </Button>
                              )}
                            </div>
                          </div>

                          <Command>
                            <CommandInput placeholder={t("referenceServer")} />
                            <CommandList>
                              <CommandEmpty>
                                {serversLoading ? t("referenceServerLoading") : t("referenceServerEmpty")}
                              </CommandEmpty>
                              <CommandGroup>
                                {availableServers.map((server) => {
                                  const isSelected = selectedServerIds.includes(server.id)

                                  return (
                                    <CommandItem
                                      key={server.id}
                                      value={`${getServerDisplayName(server)} ${server.host} ${server.username}`}
                                      onSelect={() => toggleServerSelection(server.id)}
                                    >
                                      <div
                                        className={cn(
                                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                          isSelected
                                            ? "bg-primary text-primary-foreground"
                                            : "opacity-50"
                                        )}
                                      >
                                        {isSelected && <Check className="size-3" />}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">{getServerDisplayName(server)}</div>
                                        <div className="truncate text-xs text-muted-foreground">
                                          {server.username}@{server.host}:{server.port}
                                        </div>
                                      </div>
                                      <span
                                        className={cn(
                                          "ml-2 shrink-0 text-[10px] uppercase tracking-wide",
                                          server.status === "online" ? "text-emerald-600" : "text-muted-foreground"
                                        )}
                                      >
                                        {server.status}
                                      </span>
                                    </CommandItem>
                                  )
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={attachmentDisabled}
                        aria-label={t("attachFile")}
                        title={t("attachFile")}
                      >
                        {attachmentsLoading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                      </Button>

                      {showConfigAction && (
                        <Button
                          asChild
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2.5 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground sm:text-sm"
                        >
                          <Link href="/dashboard/settings">{t("configureAI")}</Link>
                        </Button>
                      )}
                    </PromptInputTools>

                    <div className="ml-auto flex items-center gap-2">
                      {ready && isConfigured && pendingConfirmationTasks.length > 0 && (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <Shield className="size-3" />
                          {pendingConfirmationTasks.length}
                        </Badge>
                      )}
                      {isSessionRunning ? (
                        <PromptInputSubmit
                          type="button"
                          status="streaming"
                          size="icon"
                          className="h-9 w-9"
                          aria-label="中断回复"
                          title="中断回复"
                          onClick={() => void cancelSession()}
                        >
                          <Square className="size-4" />
                        </PromptInputSubmit>
                      ) : (
                        <PromptInputSubmit
                          disabled={!canSubmit}
                          size="icon"
                          className="h-9 w-9"
                          aria-label={t("send")}
                          title={t("send")}
                        >
                          <Send className="size-4" />
                        </PromptInputSubmit>
                      )}
                    </div>
                  </PromptInputToolbar>
                </PromptInput>

                <div className="mt-2 text-center text-xs text-muted-foreground">
                  {t("safetyNotice")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
