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
 */
export function getApiUrl(): string {
  return `${getApiBase()}/api/v1`
}

/**
 * 获取 WebSocket Host
 * 客户端使用,自动处理 protocol
 */
export function getWsHost(): string {
  if (typeof window === 'undefined') {
    throw new Error('getWsHost() can only be called on client side')
  }

  const apiBase = getApiBase()

  // 从完整 URL 中提取 host
  try {
    const url = new URL(apiBase)
    return url.host // 例如: localhost:8521 或 api.yourdomain.com
  } catch {
    // 如果不是完整 URL,尝试智能处理
    return apiBase.replace(/^https?:\/\//, '')
  }
}

/**
 * 获取 WebSocket URL
 * 自动根据当前协议选择 ws:// 或 wss://
 */
export function getWsUrl(path: string): string {
  if (typeof window === 'undefined') {
    throw new Error('getWsUrl() can only be called on client side')
  }

  const apiBase = getApiBase()
  const protocol = apiBase.startsWith('https') ? 'wss:' : 'ws:'
  const wsHost = getWsHost()

  return `${protocol}//${wsHost}${path}`
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
