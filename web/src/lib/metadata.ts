import type { Metadata } from "next"

/**
 * 页面元数据配置
 * 统一管理各页面的 SEO 元数据
 */

export const pageMetadata = {
  dashboard: {
    title: "仪表盘",
    description: "查看服务器状态、连接统计和系统概览",
  },
  servers: {
    title: "服务器管理",
    description: "管理 SSH 服务器配置、查看服务器状态和连接信息",
  },
  serversHistory: {
    title: "历史连接",
    description: "查看 SSH 服务器历史连接记录和会话详情",
  },
  terminal: {
    title: "终端",
    description: "Web SSH 终端 - 在浏览器中直接连接服务器",
  },
  terminalSessions: {
    title: "终端会话",
    description: "管理活跃的 SSH 终端会话",
  },
  transfers: {
    title: "文件传输",
    description: "SFTP 文件传输 - 上传下载服务器文件",
  },
  transfersHistory: {
    title: "传输记录",
    description: "查看文件传输历史记录和传输状态",
  },
  logs: {
    title: "操作日志",
    description: "查看系统操作审计日志和用户行为记录",
  },
  logsLogin: {
    title: "登录日志",
    description: "查看用户登录记录、IP 地址和登录状态",
  },
  settings: {
    title: "系统设置",
    description: "配置系统参数、用户管理和安全设置",
  },
} as const

/**
 * 生成页面元数据
 */
export function generatePageMetadata(
  key: keyof typeof pageMetadata,
  overrides?: Partial<Metadata>
): Metadata {
  const config = pageMetadata[key]
  return {
    title: config.title,
    description: config.description,
    ...overrides,
  }
}
