"use client"

import { useState, useRef, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Settings,
  Download,
  Copy,
  Check
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

// 快捷模板
const quickTemplates = [
  {
    icon: Terminal,
    title: "执行Shell命令",
    description: "帮我在服务器上执行命令",
    prompt: "请帮我在服务器上执行以下命令并解释结果：",
  },
  {
    icon: Code,
    title: "编写脚本",
    description: "生成自动化脚本",
    prompt: "请帮我编写一个脚本来实现以下功能：",
  },
  {
    icon: FileText,
    title: "日志分析",
    description: "分析日志文件",
    prompt: "请帮我分析以下日志内容，找出潜在问题：",
  },
  {
    icon: Zap,
    title: "性能优化",
    description: "优化服务器性能",
    prompt: "我的服务器性能遇到问题，请帮我分析并提供优化建议：",
  },
]

export default function AIAssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState("")
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 在客户端挂载后初始化对话
  useEffect(() => {
    setMounted(true)
    const initialConv: Conversation = {
      id: "1",
      title: "新对话",
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
      `我理解你的需求："${prompt.slice(0, 50)}..."。\n\n这是一个很好的问题。让我为你提供详细的解答：\n\n1. 首先，我建议检查当前系统状态\n2. 然后执行相应的操作\n3. 最后验证结果\n\n需要我进一步解释吗？`,
      `关于"${prompt.slice(0, 50)}..."，我可以帮你：\n\n\`\`\`bash\n# 这是一个示例脚本\n#!/bin/bash\necho "执行操作"\nsystemctl status nginx\n\`\`\`\n\n这个脚本会帮你完成任务。是否需要我解释每个步骤？`,
      `好的，让我分析一下你的问题。\n\n根据我的理解，你需要：\n- 配置服务器环境\n- 优化性能参数\n- 监控系统状态\n\n我建议采用以下方案...`,
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "新对话",
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
      .map(msg => `${msg.role === "user" ? "用户" : "AI助手"} (${new Date(msg.timestamp).toLocaleString()}):\n${msg.content}\n`)
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

  // 避免 hydration 错误
  if (!mounted) {
    return null
  }

  return (
    <>
      <PageHeader
        title="AI 助手"
        breadcrumbs={[
          { title: "工作台", href: "/dashboard" },
          { title: "AI 助手" }
        ]}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportConversation}>
            <Download className="mr-2 h-4 w-4" />
            导出对话
          </Button>
          <Button size="sm" onClick={handleNewConversation}>
            <Plus className="mr-2 h-4 w-4" />
            新建对话
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-1 gap-4 p-4 pt-0 overflow-hidden">
        {/* 对话历史侧边栏 */}
        <Card className="w-80 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              对话历史
            </CardTitle>
            <CardDescription>
              共 {conversations.length} 个对话
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
                          {conv.messages.length} 条消息
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
                  快捷模板
                </CardTitle>
                <CardDescription>
                  选择一个模板快速开始对话
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {quickTemplates.map((template, index) => (
                    <button
                      key={index}
                      className="p-4 rounded-lg border hover:border-primary hover:bg-accent transition-colors text-left"
                      onClick={() => handleUseTemplate(template.prompt)}
                    >
                      <template.icon className="h-8 w-8 mb-2 text-primary" />
                      <h4 className="font-medium text-sm mb-1">{template.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    </button>
                  ))}
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
                    <CardTitle className="text-lg">AI 智能助手</CardTitle>
                    <CardDescription>
                      我可以帮助你管理服务器、编写脚本和分析问题
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  在线
                </Badge>
              </div>
            </CardHeader>

            <Separator />

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 pb-4">
                {currentConversation?.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Bot className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">开始新的对话</h3>
                    <p className="text-muted-foreground max-w-md">
                      你好！我是AI助手，可以帮助你管理服务器、编写脚本、分析日志等。
                      请在下方输入你的问题或选择快捷模板开始。
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
                  placeholder="输入你的问题... (Shift+Enter 换行, Enter 发送)"
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
                AI助手可能会产生错误，请谨慎使用生成的命令和脚本
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
