/**
 * 统一的环境配置管理
 *
 * 只需要配置一个变量: NEXT_PUBLIC_API_BASE
 * 例如:
 * - 开发环境: http://localhost:8521
 * - 生产环境: https://api.yourdomain.com
 */

/**
 * 获取后端基础地址
 * 支持客户端和服务端使用
 *
 * @returns 后端基础地址，例如: http://localhost:8521
 * @note 默认值仅用于开发环境，生产环境必须配置 NEXT_PUBLIC_API_BASE
 */
export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8521'
}

/**
 * 获取 API URL (带 /api/v1 路径)
 *
 * 客户端和服务端行为不同:
 * - 客户端: 返回相对路径 /api，由 Next.js rewrites 代理到后端
 * - 服务端: 返回完整 URL http://backend:8521/api/v1，直接访问后端
 *
 * 这样设计的原因:
 * - 客户端使用相对路径避免浏览器尝试访问 Docker 内部服务名
 * - 服务端使用完整 URL 在 Docker 网络中直接通信
 */
export function getApiUrl(): string {
  // 客户端: 使用相对路径，让 Next.js rewrites 处理
  if (typeof window !== 'undefined') {
    return '/api'
  }

  // 服务端: 使用完整 URL，直接访问后端
  return `${getApiBase()}/api/v1`
}

/**
 * 获取 WebSocket Host（仅浏览器端）
 * 优先使用 NEXT_PUBLIC_WS_HOST；否则使用当前页面的 host。
 * 不再从 NEXT_PUBLIC_API_BASE 推导，避免把 Docker 内部服务名泄露到浏览器（如 backend）。
 */
export function getWsHost(): string {
  if (typeof window === 'undefined') {
    throw new Error('getWsHost() can only be called on client side')
  }

  const envWsHost = process.env.NEXT_PUBLIC_WS_HOST
  if (envWsHost && envWsHost.trim() !== '') {
    return envWsHost.trim()
  }
  return window.location.host
}

/**
 * 获取 WebSocket URL
 * 自动根据当前协议选择 ws:// 或 wss://
 */
export function getWsUrl(path: string): string {
  if (typeof window === 'undefined') {
    throw new Error('getWsUrl() can only be called on client side')
  }

  // 使用当前页面协议决定 ws/wss，避免与 API_BASE 的协议不一致
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsHost = getWsHost()

  // 标准化路径：将 /api/v1/* 统一改写为 /api/*，以命中 Next.js rewrites
  const normalizedPath = path.replace(/^\/api\/v1(?=\/|$)/, '/api')

  return `${protocol}//${wsHost}${normalizedPath}`
}

/**
 * 环境配置对象
 */
export const config = {
  // 后端基础地址 (不带路径)
  apiBase: getApiBase(),

  // API URL (带 /api/v1)
  apiUrl: getApiUrl(),

  // 客户端方法
  get wsHost() {
    return getWsHost()
  },

  getWsUrl,
}
