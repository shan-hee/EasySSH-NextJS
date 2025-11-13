/**
 * 统一的环境配置管理
 *
 * 纯 CSR 模式：前端静态文件由 Go 后端托管
 * 浏览器直接访问后端 API，无需代理
 */

/**
 * 获取后端基础地址
 * 纯 CSR 模式下不再需要此函数，保留用于兼容性
 *
 * @returns 后端基础地址
 * @deprecated 纯 CSR 模式下使用相对路径即可
 */
export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE || ''
}

/**
 * 获取 API URL (带 /api/v1 路径)
 *
 * 开发模式：使用完整 URL 指向后端服务器
 * 生产模式：使用相对路径（前端由后端托管，同域）
 */
export function getApiUrl(): string {
  // 开发环境：使用环境变量配置的后端地址
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return `${process.env.NEXT_PUBLIC_API_BASE}/api/v1`
  }

  // 生产环境：使用相对路径
  return '/api/v1'
}

/**
 * 获取 WebSocket Host（仅浏览器端）
 * 开发模式：使用后端服务器地址
 * 生产模式：使用当前页面的 host
 */
export function getWsHost(): string {
  if (typeof window === 'undefined') {
    throw new Error('getWsHost() can only be called on client side')
  }

  // 优先使用环境变量
  const envWsHost = process.env.NEXT_PUBLIC_WS_HOST
  if (envWsHost && envWsHost.trim() !== '') {
    return envWsHost.trim()
  }

  // 开发环境：如果配置了 API_BASE，从中提取 host
  const apiBase = process.env.NEXT_PUBLIC_API_BASE
  if (apiBase) {
    try {
      const url = new URL(apiBase)
      return url.host
    } catch {
      // 解析失败，继续使用默认逻辑
    }
  }

  // 生产环境：使用当前页面的 host
  return window.location.host
}

/**
 * 获取 WebSocket URL
 * 自动根据当前协议选择 ws:// 或 wss://
 * 纯 CSR 模式：直接使用原始路径，无需转换
 */
export function getWsUrl(path: string): string {
  if (typeof window === 'undefined') {
    throw new Error('getWsUrl() can only be called on client side')
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
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
