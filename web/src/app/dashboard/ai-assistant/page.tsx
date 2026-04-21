"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { Bot, Check, ChevronRight, Code2, FileText, Loader2, Plus, RefreshCw, Send, Server as ServerIcon, Shield, Terminal, X, Zap } from "lucide-react"

import { DashboardAgentTimeline } from "@/components/ai-agent/dashboard-agent-timeline"
import { PageHeader } from "@/components/page-header"
import { toast } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { serversApi, type Server as ManagedServer } from "@/lib/api"
import type { PermissionMode } from "@/lib/api/ai-agent"
import { getServerDisplayName, getServerShortName } from "@/lib/server-utils"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

type Translate = ReturnType<typeof useTranslations>

const MAX_ATTACHMENTS = 5
const ATTACHMENT_TEXT_READ_LIMIT = 64 * 1024
const ATTACHMENT_TEXT_PREVIEW_LIMIT = 12_000

type ComposerAttachment = {
  id: string
  name: string
  size: number
  type: string
  source: "text" | "metadata"
  content?: string
  truncated: boolean
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sortServers(servers: ManagedServer[]) {
  return [...servers].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "online" ? -1 : 1
    }

    return getServerDisplayName(left).localeCompare(getServerDisplayName(right))
  })
}

function isTextLikeFile(file: File) {
  const lowerName = file.name.toLowerCase()
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

async function createComposerAttachment(file: File): Promise<ComposerAttachment> {
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

function WelcomePanel({
  onUseTemplate,
  tText,
}: {
  onUseTemplate: (prompt: string) => void
  tText: Translate
}) {
  const templates = useMemo(
    () => [
      {
        icon: Terminal,
        titleKey: "templateRunCommandTitle" as const,
        descKey: "templateRunCommandDesc" as const,
        promptKey: "templateRunCommandPrompt" as const,
      },
      {
        icon: Code2,
        titleKey: "templateScriptTitle" as const,
        descKey: "templateScriptDesc" as const,
        promptKey: "templateScriptPrompt" as const,
      },
      {
        icon: FileText,
        titleKey: "templateLogsTitle" as const,
        descKey: "templateLogsDesc" as const,
        promptKey: "templateLogsPrompt" as const,
      },
      {
        icon: Zap,
        titleKey: "templatePerfTitle" as const,
        descKey: "templatePerfDesc" as const,
        promptKey: "templatePerfPrompt" as const,
      },
    ],
    []
  )

  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Bot className="h-8 w-8 text-foreground" />
        </div>

        <h2 className="text-center text-2xl font-semibold">{tText("cardTitle")}</h2>
        <p className="mt-3 max-w-2xl text-center text-muted-foreground">
          {tText("emptyDescriptionIntro")}
        </p>

        <div className="mt-10 grid w-full max-w-3xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => {
            const Icon = template.icon
            return (
              <button
                key={template.titleKey}
                type="button"
                className={cn(
                  "group relative rounded-xl border border-border/60 bg-card/70 p-4 text-left shadow-sm transition-all duration-200",
                  "hover:border-primary/20 hover:bg-accent/30"
                )}
                onClick={() => onUseTemplate(tText(template.promptKey))}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
                    <Icon className="h-5 w-5 text-foreground/80 group-hover:text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{tText(template.titleKey)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{tText(template.descKey)}</div>
                  </div>
                </div>
                <ChevronRight className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function AIAssistantPage() {
  const t = useTranslations("aiAssistant")
  const { ready } = useAuthReady()
  const { isLoading, isConfigured, models } = useAIConfig()
  const agentSession = useAgentSession()
  const { session, sessionId, pendingConfirmationTasks, error, startNewSession, sendMessage, confirmTask } = agentSession

  const [draft, setDraft] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("balanced")
  const [availableServers, setAvailableServers] = useState<ManagedServer[]>([])
  const [serversLoading, setServersLoading] = useState(false)
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([])
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setAvailableServers(sortServers(response.data))
    } catch {
      toast.error(t("toastLoadServersFailed"))
    } finally {
      setServersLoading(false)
    }
  }, [ready, t])

  useEffect(() => {
    void loadServers()
  }, [loadServers])

  const permissionOptions = useMemo(
    () =>
      [
        {
          value: "readonly" as const,
          label: t("permissionModeReadonly"),
          description: t("permissionModeReadonlyDesc"),
        },
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
  const hasComposerReferences = selectedServers.length > 0 || attachments.length > 0
  const isConfigChecking = !ready || isLoading
  const showConfigAction = ready && !isLoading && !isConfigured
  const modelSelectDisabled = isConfigChecking || !isConfigured || models.length === 0
  const serverReferenceDisabled = !ready || isLoading || !isConfigured
  const attachmentDisabled = attachmentsLoading || attachments.length >= MAX_ATTACHMENTS || !ready || isLoading || !isConfigured

  const hasTimeline = visibleTimeline.length > 0
  const canSubmit =
    Boolean(draft.trim()) &&
    ready &&
    !isLoading &&
    !attachmentsLoading &&
    isConfigured &&
    (!session || session.status === "idle" || session.status === "closed")

  const buildMessageContext = useCallback(() => {
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
  }, [attachments, selectedServers, t])

  const submit = async () => {
    const normalizedDraft = draft.trim()
    if (!normalizedDraft || !ready || isLoading || !isConfigured || attachmentsLoading) {
      return
    }

    if (session && session.status !== "idle" && session.status !== "closed") {
      return
    }

    if (!sessionId || session?.status === "closed") {
      await startNewSession({
        model: selectedModel || undefined,
        permissionMode,
      })
    }

    const contextText = buildMessageContext()
    const sent = await sendMessage(normalizedDraft, contextText)
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
    await startNewSession({
      model: selectedModel || undefined,
      permissionMode,
    })
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
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
    const remainingSlots = MAX_ATTACHMENTS - attachments.length

    if (remainingSlots <= 0) {
      toast.info(t("attachmentLimitHint", { count: MAX_ATTACHMENTS }))
      event.target.value = ""
      return
    }

    if (files.length > remainingSlots) {
      toast.info(t("attachmentLimitHint", { count: MAX_ATTACHMENTS }))
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
      <PageHeader title={t("pageTitle")}>
        <Button
          variant="outline"
          size="sm"
          disabled={!ready || isLoading || !isConfigured}
          onClick={() => void handleCreateNewSession()}
        >
          <RefreshCw className="size-4" />
          {t("newSession")}
        </Button>
      </PageHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6 lg:overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            {hasTimeline ? (
              <Conversation className="mx-auto h-full w-full max-w-5xl">
                <ConversationContent
                  className="mx-auto w-full max-w-4xl space-y-4 px-0 py-6"
                  scrollClassName="h-full w-full overflow-y-auto px-1 scrollbar-custom"
                >
                  <DashboardAgentTimeline entries={visibleTimeline} tText={t} />
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            ) : (
              <WelcomePanel onUseTemplate={handleUseTemplate} tText={t} />
            )}
          </div>

          <div className="shrink-0 pt-4">
            {ready && isConfigured && pendingConfirmationTasks.length > 0 && (
              <div className="mx-auto mb-3 w-full max-w-4xl rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 shadow-sm">
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
              <AgentNoticeCard tone="error" size="md" className="mx-auto mb-3 w-full max-w-4xl shadow-sm">
                {error}
              </AgentNoticeCard>
            )}

            <div className="mx-auto w-full max-w-4xl">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => void handleAttachmentSelection(event)}
                />

                {hasComposerReferences && (
                  <div className="mb-2 flex flex-col gap-2 px-1">
                    {selectedServers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("referencedServersLabel")}
                        </span>
                        {selectedServers.map((server) => (
                          <span
                            key={server.id}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground"
                            title={getServerDisplayName(server)}
                          >
                            <ServerIcon className="size-3.5 text-muted-foreground" />
                            <span className="max-w-[10rem] truncate">{getServerShortName(server)}</span>
                            <button
                              type="button"
                              className="text-muted-foreground transition-colors hover:text-foreground"
                              onClick={() => toggleServerSelection(server.id)}
                            >
                              <X className="size-3.5" />
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => setSelectedServerIds([])}
                        >
                          {t("referenceServerClear")}
                        </button>
                      </div>
                    )}

                    {attachments.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("attachedFilesLabel")}
                        </span>
                        {attachments.map((attachment) => (
                          <span
                            key={attachment.id}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground"
                            title={`${attachment.name} · ${formatFileSize(attachment.size)}`}
                          >
                            <FileText className="size-3.5 text-muted-foreground" />
                            <span className="max-w-[12rem] truncate">{attachment.name}</span>
                            <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
                            {attachment.truncated && (
                              <span className="text-muted-foreground">{t("attachmentInlineTruncated")}</span>
                            )}
                            <button
                              type="button"
                              className="text-muted-foreground transition-colors hover:text-foreground"
                              onClick={() => removeAttachment(attachment.id)}
                            >
                              <X className="size-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                    minHeight={76}
                    maxHeight={220}
                    className="px-4 pt-4"
                  />

                  <PromptInputToolbar className="flex-wrap gap-3 border-t border-border/60 px-2 py-2">
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
                      <PromptInputSubmit
                        disabled={!canSubmit}
                        size="icon"
                        className="h-10 w-10"
                        aria-label={t("send")}
                        title={t("send")}
                      >
                        <Send className="size-4" />
                      </PromptInputSubmit>
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
  )
}
