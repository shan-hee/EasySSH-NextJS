import type { Server } from "@/lib/api"

/**
 * 获取服务器显示名称
 * 如果 name 为空，返回 username@host:port 格式
 */
export function getServerDisplayName(server: Server): string {
  if (server.name && server.name.trim()) {
    return server.name
  }
  return `${server.username}@${server.host}:${server.port}`
}

/**
 * 获取服务器简短显示名称
 * 如果 name 为空，返回 host
 */
export function getServerShortName(server: Server): string {
  if (server.name && server.name.trim()) {
    return server.name
  }
  return server.host
}
