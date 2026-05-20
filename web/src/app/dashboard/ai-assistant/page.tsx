"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { Check, History, Loader2, MoreHorizontal, PanelRightClose, PanelRightOpen, Pencil, Plus, RefreshCw, Search, Send, Server as ServerIcon, Shield, Square, SquarePen, Trash2, X } from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { getServerDisplayName } from "@/lib/server-utils"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

const SESSION_SIDEBAR_COLLAPSED_STORAGE_KEY = "easyssh:ai-assistant:session-sidebar-collapsed"

function createSessionListItem(response: CreateSessionResponse): SessionListItem {
  return {
    id: response.session_id,
    model: response.session.model,
    permission_mode: response.session.permission_mode,
    status: response.session.status,
    title: "新会话",
    custom_title: false,
    message_count: response.session.messages.length,
    task_count: response.session.tasks.length,
    created_at: response.session.created_at,
    updated_at: response.session.updated_at,
  }
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
  const [sessionSearch, setSessionSearch] = useState("")
  const [sessionSidebarCollapsed, setSessionSidebarCollapsed] = useState(true)
  const [sessionCreating, setSessionCreating] = useState(false)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sessionSidebarStorageReadyRef = useRef(false)
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
    try {
      const storedValue = window.localStorage.getItem(SESSION_SIDEBAR_COLLAPSED_STORAGE_KEY)
      if (storedValue !== null) {
        setSessionSidebarCollapsed(storedValue === "true")
      }
    } catch {
      // ignore unavailable storage
    } finally {
      sessionSidebarStorageReadyRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!sessionSidebarStorageReadyRef.current) {
      return
    }

    try {
      window.localStorage.setItem(
        SESSION_SIDEBAR_COLLAPSED_STORAGE_KEY,
        String(sessionSidebarCollapsed)
      )
    } catch {
      // ignore unavailable storage
    }
  }, [sessionSidebarCollapsed])

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
      createSessionListItem(response),
      ...current.filter((item) => item.id !== response.session_id),
    ].slice(0, 30))
  }, [sessionSearch])

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
      const response = await listAISessions({ limit: 30, q: sessionSearch })
      setSessionList(response.items)
    } catch {
      toast.error("加载会话列表失败")
    } finally {
      setSessionListLoading(false)
    }
  }, [isConfigured, isLoading, ready, sessionSearch])

  useEffect(() => {
    void loadSessionList()
  }, [loadSessionList])

  const handleRestoreSession = async (targetSessionId: string) => {
    if (renamingSessionId) {
      return
    }

    const restored = await restoreSession(targetSessionId)
    if (restored) {
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
    if (!title) {
      toast.error("会话名称不能为空")
      return
    }

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
      toast.error("重命名会话失败")
    }
  }

  const handleDeleteSession = async (targetSessionId: string) => {
    const confirmed = await requestConfirm({
      description: t("deleteSessionConfirm"),
      variant: "destructive",
    })
    if (!confirmed) {
      return
    }

    try {
      await deleteAISession(targetSessionId)
      setSessionList((current) => current.filter((item) => item.id !== targetSessionId))
      if (targetSessionId === sessionId) {
        await closeSession()
      }
      toast.success("会话已删除")
    } catch {
      toast.error("删除会话失败")
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
      <PageHeader title={t("pageTitle")} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside
          className={cn(
            "relative order-2 flex shrink-0 flex-col text-foreground transition-[width] duration-200 md:max-h-none",
            sessionSidebarCollapsed ? "max-h-[280px] w-full md:w-14" : "max-h-[280px] w-full md:w-[320px]"
          )}
        >
          {sessionSidebarCollapsed ? (
            <div className="flex min-h-0 flex-1 flex-row items-center gap-2 overflow-x-auto px-3 py-2 md:flex-col md:overflow-x-visible md:overflow-y-auto md:px-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-accent/50"
                onClick={() => setSessionSidebarCollapsed(false)}
                aria-label="展开会话列表"
                title="展开会话列表"
              >
                <PanelRightOpen className="size-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-accent/50"
                disabled={createSessionDisabled}
                onClick={() => void handleCreateNewSession()}
                aria-label={t("newSession")}
                title={t("newSession")}
              >
                <SquarePen className="size-4" />
              </Button>

              {sessionListLoading ? (
                <div className="flex size-9 shrink-0 items-center justify-center text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : (
                sessionList.slice(0, 12).map((item) => {
                  const isActive = item.id === sessionId

                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-9 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-accent/50",
                        isActive && "bg-accent text-foreground dark:bg-accent/50"
                      )}
                      onClick={() => void handleRestoreSession(item.id)}
                      aria-label={`恢复会话：${item.title}`}
                      title={item.title}
                    >
                      <History className="size-4" />
                    </Button>
                  )
                })
              )}
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-3 top-3 z-10 size-9 text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-accent/50"
                onClick={() => setSessionSidebarCollapsed(true)}
                aria-label="折叠会话列表"
                title="折叠会话列表"
              >
                <PanelRightClose className="size-4" />
              </Button>

              <div className="space-y-2 px-3 pb-3 pt-16">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-full justify-start gap-2 rounded-md px-2 text-sm font-medium text-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-accent/50"
                  disabled={createSessionDisabled}
                  onClick={() => void handleCreateNewSession()}
                >
                  <SquarePen className="size-4" />
                  {t("newSession")}
                </Button>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={sessionSearch}
                    onChange={(event) => setSessionSearch(event.target.value)}
                    placeholder="搜索会话标题或消息"
                    className="h-8 border-transparent bg-transparent pl-9 pr-9 text-sm text-foreground shadow-none placeholder:text-muted-foreground dark:bg-transparent focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  {sessionSearch && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-accent/50"
                      onClick={() => setSessionSearch("")}
                      aria-label="清空搜索"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 scrollbar-custom">
                {sessionListLoading ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    加载中
                  </div>
                ) : sessionList.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    暂无会话
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessionList.map((item) => {
                      const isActive = item.id === sessionId
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "w-full rounded-md px-2 py-2 text-left transition-colors",
                            isActive
                              ? "bg-accent text-foreground dark:bg-accent/50"
                              : "text-foreground hover:bg-accent dark:hover:bg-accent/50"
                          )}
                          onClick={() => void handleRestoreSession(item.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              void handleRestoreSession(item.id)
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {renamingSessionId === item.id ? (
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
                                    className="h-8"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 shrink-0"
                                    onClick={() => void submitRenameSession(item.id)}
                                    aria-label="保存会话名称"
                                  >
                                    <Check className="size-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 shrink-0"
                                    onClick={cancelRenameSession}
                                    aria-label="取消重命名"
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="truncate text-sm font-medium">{item.title}</div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Badge variant="outline" className="border-0 bg-transparent px-1 text-[10px] text-muted-foreground shadow-none">
                                {item.status}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-accent/50"
                                    onClick={(event) => event.stopPropagation()}
                                    aria-label="会话操作"
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      beginRenameSession(item)
                                    }}
                                  >
                                    <Pencil className="size-4" />
                                    重命名
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void handleDeleteSession(item.id)
                                    }}
                                  >
                                    <Trash2 className="size-4" />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        <div className="order-1 min-w-0 flex-1 overflow-y-auto pb-4 md:pb-6 lg:overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              {hasTimeline ? (
                <Conversation className="h-full w-full">
                  <ConversationContent
                    className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-6"
                    scrollClassName="h-full w-full overflow-y-auto scrollbar-custom"
                  >
                    <DashboardAgentTimeline entries={visibleTimeline} tText={t} />
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
