/**
 * 统一的环境配置管理
 *
 * 纯 CSR 模式：前端静态文件由 Go 后端托管
 * 浏览器直接访问后端 API，无需代理
 */

/**
 * 开发环境默认后端地址（不包含 /api/v1）
 * - 开发脚本 scripts/dev.sh 会根据 .env 中的 PORT 自动更新此常量
 * - 如需手动修改端口或主机名，可直接编辑这里
 */
const DEV_BACKEND_BASE_URL = "http://localhost:2580"

/**
 * 获取 API URL (带 /api/v1 路径)
 *
 * 开发模式：使用完整 URL 指向后端服务器
 * 生产模式：使用相对路径（前端由后端托管，同域）
 */
export function getApiUrl(): string {
  if (process.env.NODE_ENV !== 'production') {
    return `${DEV_BACKEND_BASE_URL}/api/v1`
  }
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

  // 开发环境：优先使用 DEV_BACKEND_BASE_URL 的 host（scripts/dev.sh 会自动更新）
  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(DEV_BACKEND_BASE_URL)
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
  // API URL (带 /api/v1)
  apiUrl: getApiUrl(),

  // 客户端方法
  get wsHost() {
    return getWsHost()
  },

  getWsUrl,
}
