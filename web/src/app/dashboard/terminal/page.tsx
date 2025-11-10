"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"
import { TerminalComponent } from "@/components/terminal/terminal-component"
import { TerminalSession } from "@/components/terminal/types"
import type { QuickServer } from "@/components/terminal/quick-connect"
import { useRouter, useSearchParams } from "next/navigation"
import { serversApi, type Server } from "@/lib/api"
import { useTerminalStore } from "@/stores/terminal-store"
import { useTabUIStore } from "@/stores/tab-ui-store"

export default function TerminalPage() {
 const router = useRouter()
 const searchParams = useSearchParams()
 const [servers, setServers] = useState<QuickServer[]>([])
 const [loading, setLoading] = useState(true)

 // 根据 URL 参数决定初始会话类型
 const [sessions, setSessions] = useState<TerminalSession[]>(() => {
 const now = Date.now()
 const serverId = searchParams.get("server")
 const serverName = searchParams.get("name") || "" // 从 URL 获取服务器名称

 // 如果有 server 参数，创建终端会话（等待服务器信息加载）
 if (serverId) {
 return [
 {
 id: `auto-${serverId}-${now}`,
 serverId: serverId, // 暂时使用字符串，稍后 useEffect 会填充完整信息
 serverName: serverName, // 使用 URL 传递的服务器名称
 host: "",
 port: undefined,
 username: "",
 isConnected: false,
 status: "reconnecting", // 黄色状态指示器
 lastActivity: now,
 type: "terminal",
 pinned: false,
 },
 ]
 }

 // 否则创建快速连接会话
 return [
 {
 id: "quick-initial",
 serverId: 0,
 serverName: "快速连接",
 host: "",
 port: undefined,
 username: "",
 isConnected: false,
 status: "disconnected",
 lastActivity: now,
 type: "quick",
 pinned: false,
 },
 ]
 })

 const [maxTabs, setMaxTabs] = useState(50)
 const [inactiveMinutes, setInactiveMinutes] = useState(60)
 const inactivityNotifiedRef = useRef<Set<string>>(new Set())
 const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
 const initializedRef = useRef(false)

 // 处理 URL 参数中的服务器 ID（在 servers 加载完成后）
 useEffect(() => {
 if (!initializedRef.current && !loading && servers.length > 0) {
 initializedRef.current = true

 const serverId = searchParams.get("server")
 if (serverId) {
 // 查找服务器信息
 const server = servers.find(s => s.id.toString() === serverId)

 if (server && server.status === "online") {
 // 服务器在线，更新会话信息
 setSessions(prev => {
 const updated = prev.map(s => {
 // 只更新我们初始创建的 auto- 会话
 if (s.id.startsWith(`auto-${serverId}-`)) {
 return {
 ...s,
 serverId: server.id,
 serverName: server.name || `${server.username}@${server.host}:${server.port}`,
 host: server.host,
 port: server.port,
 username: server.username,
 isConnected: true,
 status: "connected" as const,
 group: server.group,
 tags: server.tags,
 }
 }
 return s
 })

 // 设置激活的会话
 const activeSession = updated.find(s => s.id.startsWith(`auto-${serverId}-`))
 if (activeSession) {
 setActiveSessionId(activeSession.id)
 }

 return updated
 })

 // 清除 URL 参数
 router.replace("/dashboard/terminal", { scroll: false })
 } else {
 // 服务器不存在或离线，回退到快速连接
 if (!server) {
 toast.error("服务器不存在")
 } else {
 toast.error("服务器离线，无法连接")
 }

 const now = Date.now()
 setSessions([{
 id: "quick-initial",
 serverId: 0,
 serverName: "快速连接",
 host: "",
 port: undefined,
 username: "",
 isConnected: false,
 status: "disconnected",
 lastActivity: now,
 type: "quick",
 pinned: false,
 }])
 router.replace("/dashboard/terminal", { scroll: false })
 }
 }
 }
 }, [loading, servers, searchParams, router])

 // 加载服务器列表
 useEffect(() => {
 loadServers()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 // 读取通用设置（仅使用本地存储集成）
 useEffect(() => {
 try {
 const mt = Number(localStorage.getItem("tab.maxTabs") || "50")
 if (!isNaN(mt)) setMaxTabs(mt)
 const im = Number(localStorage.getItem("tab.inactiveMinutes") || "60")
 if (!isNaN(im)) setInactiveMinutes(im)
 } catch {}
 }, [])

 // 加载服务器列表
 async function loadServers() {
  try {
  setLoading(true)

  const response = await serversApi.list({
  page: 1,
  limit: 100, // 加载所有服务器
 })

 // 防御性检查：处理apiFetch自动解包导致的数据结构不一致
 const servers = Array.isArray(response)
 ? response
 : (response?.data || [])

 // 将Server类型转换为QuickServer类型，保留 UUID
 const quickServers: QuickServer[] = servers.map((server: Server) => ({
 id: server.id, // 保留 UUID 字符串
 name: server.name || `${server.username}@${server.host}:${server.port}`,
 host: server.host,
 port: server.port,
 username: server.username,
 status: server.status === "online" ? "online" : "offline",
 group: server.group,
 tags: server.tags,
 last_connected: server.last_connected, // 传递最后连接时间
 }))

 setServers(quickServers)
 } catch (error: unknown) {
 console.error("Failed to load servers:", error)
 toast.error(getErrorMessage(error, "加载服务器列表失败"))
 } finally {
 setLoading(false)
 }
 }

 // 创建"快速连接"页签
 const handleNewSession = (): string | void => {
 // 最大页签数限制
 if (sessions.length >= maxTabs) {
 toast.error(`已达到最大页签数限制 (${maxTabs})`)
 return
 }

 const now = Date.now()
 const id = `quick-${now}`
 const newTab: TerminalSession = {
 id,
 serverId: 0,
 serverName: "快速连接",
 host: "",
 username: "",
 isConnected: false,
 status: "disconnected",
 lastActivity: now,
 type: "quick",
 pinned: false,
 }
 setSessions(prev => [...prev, newTab])
 return id
 }

 // 从"快速连接"页签内选择服务器，升级为终端会话
 const handleStartConnectionFromQuick = (sessionId: string, server: QuickServer) => {
 const now = Date.now()
 const newSessionId = `auto-${server.id}-${now}`

 // 获取 Store 实例
 const terminalStore = useTerminalStore.getState()
 const tabUIStore = useTabUIStore.getState()

 // 迁移终端实例（如果存在）
 const terminalInstance = terminalStore.getTerminal(sessionId)
 if (terminalInstance) {
 terminalStore.setTerminal(newSessionId, {
 ...terminalInstance,
 serverId: String(server.id)
 })
 terminalStore.destroySession(sessionId)
 }

 // 迁移 UI 状态
 const tabState = tabUIStore.getTabState(sessionId)
 tabUIStore.setTabState(newSessionId, tabState)
 tabUIStore.deleteTabState(sessionId)

 // 更新会话列表
 setSessions(prev => prev.map(s => s.id === sessionId ? {
 id: newSessionId, // 使用新的 auto- 格式 ID
 serverId: server.id,
 serverName: server.name || `${server.username}@${server.host}:${server.port}`,
 host: server.host,
 port: server.port,
 username: server.username,
 isConnected: server.status === "online",
 status: server.status === "online" ? "connected" : "disconnected",
 lastActivity: now,
 group: server.group,
 tags: server.tags,
 pinned: false,
 type: "terminal",
 } : s))

 // 更新激活状态
 if (activeSessionId === sessionId) {
 setActiveSessionId(newSessionId)
 }

 // 连接建立后，稍后重新加载服务器列表以获取更新的 last_connected
 setTimeout(() => {
 loadServers()
 }, 1000)
 }

 // 关闭会话
 const handleCloseSession = useCallback((sessionId: string) => {
 // 若这次关闭会导致页签为空，则立刻跳转上一级，避免出现"无页签"中间态
 if (sessions.length <= 1) {
 router.replace("/dashboard")
 return
 }

 // 如果关闭的是当前激活的标签，需要先切换到其他标签再关闭
 const currentIndex = sessions.findIndex(s => s.id === sessionId)
 const isClosingActive = activeSessionId === sessionId

 // 如果关闭的是当前激活的标签，先切换到相邻的标签
 if (isClosingActive && currentIndex !== -1) {
 // 优先选择右边的标签，如果没有则选择左边的
 const nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : currentIndex - 1
 if (nextIndex >= 0 && sessions[nextIndex]) {
 setActiveSessionId(sessions[nextIndex].id)
 }
 }

 // 然后过滤掉要关闭的会话
 setSessions(prev => prev.filter(s => s.id !== sessionId))
 }, [sessions, activeSessionId, router])

 const handleDuplicateSession = (sessionId: string) => {
 const src = sessions.find(s => s.id === sessionId)
 if (!src) return
 if (sessions.length >= maxTabs) {
 toast.error(`已达到最大页签数限制 (${maxTabs})`)
 return
 }
 const now = Date.now()
 const dup: TerminalSession = { ...src, id: `session-${now}`, lastActivity: now, pinned: false }
 setSessions(prev => [...prev, dup])
 }

 const handleCloseOthers = (sessionId: string) => {
 setSessions(prev => prev.filter(s => s.id === sessionId || s.pinned))
 }

 const handleCloseAll = () => {
 const next = sessions.filter(s => s.pinned)
 if (next.length === 0) {
 router.replace("/dashboard")
 return
 }
 setSessions(next)
 }

 const handleTogglePin = (sessionId: string) => {
 setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, pinned: !s.pinned } : s))
 }

 const handleReorder = (newOrderIds: string[]) => {
 const map = new Map(sessions.map(s => [s.id, s]))
 const newList = newOrderIds.map(id => map.get(id)!).filter(Boolean)
 if (newList.length === sessions.length) setSessions(newList)
 }

 // 发送命令
 const handleSendCommand = (sessionId: string, command: string) => {
 // 移除频繁的日志输出，只在开发模式下且命令非空时输出
 if (process.env.NODE_ENV === 'development' && command.trim()) {
 // console.log(`Session ${sessionId}: ${command}`)
 }
 // 这里应该处理实际的命令发送逻辑

 // 更新最后活动时间
 const now = Date.now()
 setSessions(prev => prev.map(session => session.id === sessionId ? { ...session, lastActivity: now } : session))
 // 清除已提醒标记
 inactivityNotifiedRef.current.delete(sessionId)
 }

 // 未活动断开提醒
 useEffect(() => {
 const t = setInterval(() => {
 const now = Date.now()
 const threshold = inactiveMinutes * 60 * 1000
 sessions.forEach(s => {
 if (!s) return
 if (now - s.lastActivity >= threshold && !inactivityNotifiedRef.current.has(s.id)) {
 inactivityNotifiedRef.current.add(s.id)
 toast(`会话"${s.serverName}"长时间未活动`, {
 description: `已超过 ${inactiveMinutes} 分钟未活动，是否断开？`,
 action: { label: "断开", onClick: () => handleCloseSession(s.id) },
 })
 }
 })
 }, 60 * 1000)
 return () => clearInterval(t)
 }, [sessions, inactiveMinutes, handleCloseSession])

 // 会话初始化中（等待 sessions 被设置）
 // 现在始终有初始会话，不需要这个检查了
 // if (sessions.length === 0) { ... }

 return (
 <div className="flex flex-1 flex-col gap-4 p-4 pt-0 min-w-0 overflow-hidden">
 <TerminalComponent
 sessions={sessions}
 onNewSession={handleNewSession}
 onCloseSession={handleCloseSession}
 onSendCommand={handleSendCommand}
 onDuplicateSession={handleDuplicateSession}
 onCloseOthers={handleCloseOthers}
 onCloseAll={handleCloseAll}
 onTogglePin={handleTogglePin}
 onReorderSessions={handleReorder}
 onStartConnectionFromQuick={handleStartConnectionFromQuick}
 servers={servers}
 serversLoading={loading}
 externalActiveSessionId={activeSessionId}
 />
 </div>
 )
}
