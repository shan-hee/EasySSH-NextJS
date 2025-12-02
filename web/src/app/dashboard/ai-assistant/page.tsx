"use client"

import { useState, useRef, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
 Bot,
 Send,
 Plus,
 Trash2,
 Clock,
 Sparkles,
 Terminal,
 Code,
 FileText,
 Zap,
 User,
 MessageSquare,
 Download,
 Copy,
 Check
} from "lucide-react"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"

interface Message {
 id: string
 role: "user" | "assistant"
 content: string
 timestamp: number // 使用时间戳而不是 Date 对象
}

interface Conversation {
 id: string
 title: string
 messages: Message[]
 createdAt: number // 使用时间戳而不是 Date 对象
 updatedAt: number // 使用时间戳而不是 Date 对象
}

// 快捷模板（文案从 i18n 获取）
const quickTemplateIcons = [Terminal, Code, FileText, Zap] as const

export default function AIAssistantPage() {
 const t = useTranslations("aiAssistant")
 const [conversations, setConversations] = useState<Conversation[]>([])
 const [currentConversationId, setCurrentConversationId] = useState("")
 const [inputMessage, setInputMessage] = useState("")
 const [isLoading, setIsLoading] = useState(false)
 const [copiedId, setCopiedId] = useState<string | null>(null)
 const [mounted, setMounted] = useState(false)
 const { ready } = useAuthReady()
 const messagesEndRef = useRef<HTMLDivElement>(null)
 const textareaRef = useRef<HTMLTextAreaElement>(null)

 // 在客户端挂载后初始化对话
useEffect(() => {
 setMounted(true)
 const initialConv: Conversation = {
 id: "1",
 title: t("newConversation"),
 messages: [],
 createdAt: Date.now(),
 updatedAt: Date.now(),
 }
 setConversations([initialConv])
 setCurrentConversationId("1")
 }, [])

 const currentConversation = conversations.find(c => c.id === currentConversationId)

 // 自动滚动到底部
 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
 }, [currentConversation?.messages])

 // 自动调整文本框高度
 useEffect(() => {
 if (textareaRef.current) {
 textareaRef.current.style.height = "auto"
 textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
 }
 }, [inputMessage])

 const handleSendMessage = async () => {
 if (!inputMessage.trim() || !currentConversation) return

 const userMessage: Message = {
 id: Date.now().toString(),
 role: "user",
 content: inputMessage,
 timestamp: Date.now(),
 }

 // 添加用户消息
 setConversations(prev => prev.map(conv =>
 conv.id === currentConversationId
 ? {
 ...conv,
 messages: [...conv.messages, userMessage],
 title: conv.messages.length === 0 ? inputMessage.slice(0, 30) + "..." : conv.title,
 updatedAt: Date.now()
 }
 : conv
 ))

 setInputMessage("")
 setIsLoading(true)

 // 模拟AI响应
 setTimeout(() => {
 const assistantMessage: Message = {
 id: (Date.now() + 1).toString(),
 role: "assistant",
 content: generateMockResponse(inputMessage),
 timestamp: Date.now(),
 }

 setConversations(prev => prev.map(conv =>
 conv.id === currentConversationId
 ? {
 ...conv,
 messages: [...conv.messages, assistantMessage],
 updatedAt: Date.now()
 }
 : conv
 ))
 setIsLoading(false)
 }, 1000 + Math.random() * 1000)
 }

const generateMockResponse = (prompt: string): string => {
 const responses = [
 `I see your request: "${prompt.slice(0, 50)}...".\n\n这是一个示例回复占位符，实际环境中应由后端 AI 服务返回内容。`,
 `Here is a sample script based on "${prompt.slice(0, 50)}...":\n\n\`\`\`bash\n#!/bin/bash\necho "run something"\n\`\`\`\n\n请根据实际需要调整脚本。`,
 `Let me think about "${prompt.slice(0, 50)}...".\n\n下面是一个示意性的分析流程，真实逻辑请接入后端 AI。`,
 ]
 return responses[Math.floor(Math.random() * responses.length)]
 }

 const handleNewConversation = () => {
 const newConv: Conversation = {
 id: Date.now().toString(),
 title: t("newConversation"),
 messages: [],
 createdAt: Date.now(),
 updatedAt: Date.now(),
 }
 setConversations(prev => [newConv, ...prev])
 setCurrentConversationId(newConv.id)
 }

 const handleDeleteConversation = (id: string) => {
 setConversations(prev => {
 const filtered = prev.filter(c => c.id !== id)
 if (currentConversationId === id && filtered.length > 0) {
 setCurrentConversationId(filtered[0].id)
 }
 return filtered
 })
 }

 const handleUseTemplate = (prompt: string) => {
 setInputMessage(prompt)
 textareaRef.current?.focus()
 }

 const handleCopyMessage = (content: string, id: string) => {
 navigator.clipboard.writeText(content)
 setCopiedId(id)
 setTimeout(() => setCopiedId(null), 2000)
 }

 const handleExportConversation = () => {
 if (!currentConversation) return
 const content = currentConversation.messages
 .map(msg => `${msg.role === "user" ? t("exportRoleUser") : t("exportRoleAssistant")} (${new Date(msg.timestamp).toLocaleString()}):\n${msg.content}\n`)
 .join("\n---\n\n")

 const blob = new Blob([content], { type: "text/plain" })
 const url = URL.createObjectURL(blob)
 const a = document.createElement("a")
 a.href = url
 a.download = `conversation-${currentConversation.title}-${Date.now()}.txt`
 a.click()
 URL.revokeObjectURL(url)
 }

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === "Enter" && !e.shiftKey) {
 e.preventDefault()
 handleSendMessage()
 }
 }

 // 避免 hydration 错误；同时等待认证状态就绪
 if (!mounted || !ready) {
   return null
 }

 return (
 <>
 <PageHeader title={t("pageTitle")}>
 <div className="flex items-center gap-2">
 <Button variant="outline" size="sm" onClick={handleExportConversation}>
 <Download className="mr-2 h-4 w-4" />
 {t("exportConversation")}
 </Button>
 <Button size="sm" onClick={handleNewConversation}>
 <Plus className="mr-2 h-4 w-4" />
 {t("newConversation")}
 </Button>
 </div>
 </PageHeader>

 <div className="flex flex-1 gap-4 p-4 pt-0 overflow-hidden">
 {/* 对话历史侧边栏 */}
 <Card className="w-80 flex flex-col">
        <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        {t("sidebarTitle")}
        </CardTitle>
        <CardDescription>
        {t("sidebarDescription", { count: conversations.length })}
        </CardDescription>
        </CardHeader>
 <CardContent className="flex-1 p-0">
 <ScrollArea className="h-full px-4">
 <div className="space-y-2 pb-4">
 {conversations.map(conv => (
 <div
 key={conv.id}
 className={`
 group p-3 rounded-lg border cursor-pointer transition-colors
 ${conv.id === currentConversationId
 ? "bg-primary/10 border-primary"
 : "hover:bg-accent"
 }
 `}
 onClick={() => setCurrentConversationId(conv.id)}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="flex-1 min-w-0">
 <h4 className="font-medium text-sm truncate">
 {conv.title}
 </h4>
        <p className="text-xs text-muted-foreground mt-1">
        {t("sidebarMessageCount", { count: conv.messages.length })}
        </p>
 <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
 <Clock className="h-3 w-3" />
 {new Date(conv.updatedAt).toLocaleString()}
 </p>
 </div>
 {conversations.length > 1 && (
 <Button
 variant="ghost"
 size="sm"
 className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
 onClick={(e) => {
 e.stopPropagation()
 handleDeleteConversation(conv.id)
 }}
 >
 <Trash2 className="h-3 w-3" />
 </Button>
 )}
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 </CardContent>
 </Card>

 {/* 主聊天区域 */}
 <div className="flex-1 flex flex-col gap-4 min-w-0">
 {/* 快捷模板 */}
 {currentConversation?.messages.length === 0 && (
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Sparkles className="h-5 w-5" />
 {t("quickTemplatesTitle")}
 </CardTitle>
 <CardDescription>
 {t("quickTemplatesDescription")}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
 {quickTemplateIcons.map((Icon, index) => {
   const keyBase =
     index === 0
       ? "templateRunCommand"
       : index === 1
       ? "templateScript"
       : index === 2
       ? "templateLogs"
       : "templatePerf"
   const titleKey = `${keyBase}Title` as const
   const descKey = `${keyBase}Desc` as const
   const promptKey = `${keyBase}Prompt` as const
   return (
 <button
key={index}
className="p-4 rounded-lg border hover:border-primary hover:bg-accent transition-colors text-left"
 onClick={() => handleUseTemplate(t(promptKey))}
 >
 <Icon className="h-8 w-8 mb-2 text-primary" />
 <h4 className="font-medium text-sm mb-1">{t(titleKey)}</h4>
 <p className="text-xs text-muted-foreground">
 {t(descKey)}
 </p>
 </button>
 )
 })}
 </div>
 </CardContent>
 </Card>
 )}

 {/* 消息列表 */}
 <Card className="flex-1 flex flex-col min-h-0">
 <CardHeader className="flex-shrink-0">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Bot className="h-6 w-6 text-primary" />
 <div>
 <CardTitle className="text-lg">{t("cardTitle")}</CardTitle>
 <CardDescription>
 {t("cardDescription")}
 </CardDescription>
 </div>
 </div>
 <Badge variant="secondary" className="flex items-center gap-1">
 <div className="h-2 w-2 rounded-full bg-green-500" />
 {t("statusOnline")}
 </Badge>
 </div>
 </CardHeader>

 <Separator />

 <ScrollArea className="flex-1 p-4">
 <div className="space-y-4 pb-4">
 {currentConversation?.messages.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-center py-12">
 <Bot className="h-16 w-16 text-muted-foreground mb-4" />
 <h3 className="text-lg font-semibold mb-2">{t("emptyTitle")}</h3>
 <p className="text-muted-foreground max-w-md">
 {t("emptyDescriptionIntro")}
 <br />
 {t("emptyDescriptionGuide")}
 </p>
 </div>
 ) : (
 currentConversation?.messages.map((message) => (
 <div
 key={message.id}
 className={`flex gap-3 ${
 message.role === "user" ? "justify-end" : "justify-start"
 }`}
 >
 {message.role === "assistant" && (
 <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Bot className="h-5 w-5 text-primary" />
 </div>
 )}

 <div
 className={`
 group relative max-w-[80%] rounded-lg p-4
 ${message.role === "user"
 ? "bg-primary text-primary-foreground"
 : "bg-muted"
 }
 `}
 >
 <div className="whitespace-pre-wrap break-words">
 {message.content}
 </div>
 <div className={`
 text-xs mt-2 flex items-center justify-between gap-2
 ${message.role === "user"
 ? "text-primary-foreground/70"
 : "text-muted-foreground"
 }
 `}>
 <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
 <Button
 variant="ghost"
 size="sm"
 className="h-6 px-2 opacity-0 group-hover:opacity-100"
 onClick={() => handleCopyMessage(message.content, message.id)}
 >
 {copiedId === message.id ? (
 <Check className="h-3 w-3" />
 ) : (
 <Copy className="h-3 w-3" />
 )}
 </Button>
 </div>
 </div>

 {message.role === "user" && (
 <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
 <User className="h-5 w-5" />
 </div>
 )}
 </div>
 ))
 )}

 {isLoading && (
 <div className="flex gap-3">
 <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Bot className="h-5 w-5 text-primary animate-pulse" />
 </div>
 <div className="bg-muted rounded-lg p-4">
 <div className="flex gap-1">
 <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
 <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0.1s" }} />
 <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0.2s" }} />
 </div>
 </div>
 </div>
 )}

 <div ref={messagesEndRef} />
 </div>
 </ScrollArea>

 <Separator />

 {/* 输入区域 */}
 <div className="p-4 flex-shrink-0">
 <div className="flex gap-2">
 <Textarea
 ref={textareaRef}
 placeholder={t("inputPlaceholder")}
 value={inputMessage}
 onChange={(e) => setInputMessage(e.target.value)}
 onKeyDown={handleKeyDown}
 className="min-h-[44px] max-h-32 resize-none"
 rows={1}
 />
 <Button
 onClick={handleSendMessage}
 disabled={!inputMessage.trim() || isLoading}
 className="px-4"
 >
 <Send className="h-4 w-4" />
 </Button>
 </div>
 <p className="text-xs text-muted-foreground mt-2">
 {t("safetyNotice")}
 </p>
 </div>
 </Card>
 </div>
 </div>
 </>
 )
}
