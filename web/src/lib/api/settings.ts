import { apiFetch } from "@/lib/api-client"

/**
 * SMTP 配置
 */
export interface SMTPConfig {
  enabled: boolean
  host: string
  port: number
  username: string
  password: string
  from_email: string
  from_name: string
  use_tls: boolean
}

/**
 * 获取 SMTP 配置响应
 */
export interface GetSMTPConfigResponse {
  config: SMTPConfig
}

/**
 * Webhook 配置
 */
export interface WebhookConfig {
  enabled: boolean
  url: string
  secret: string
  method: string // POST 或 GET
}

/**
 * 获取 Webhook 配置响应
 */
export interface GetWebhookConfigResponse {
  config: WebhookConfig
}

/**
 * 钉钉配置
 */
export interface DingTalkConfig {
  enabled: boolean
  webhook_url: string
  secret: string
}

/**
 * 获取钉钉配置响应
 */
export interface GetDingTalkConfigResponse {
  config: DingTalkConfig
}

/**
 * 企业微信配置
 */
export interface WeComConfig {
  enabled: boolean
  webhook_url: string
}

/**
 * 获取企业微信配置响应
 */
export interface GetWeComConfigResponse {
  config: WeComConfig
}

/**
 * 系统通用配置
 */
export interface SystemConfig {
  // 基本设置
  system_name: string
  system_logo: string
  system_favicon: string

  // 国际化设置
  default_language: string
  default_timezone: string
  date_format: string

  // 其他设置
  default_page_size: number
  max_file_upload_size: number
}

/**
 * 获取系统配置响应
 */
export interface GetSystemConfigResponse {
  config: SystemConfig
}

/**
 * 标签/会话设置
 */
export interface TabSessionConfig {
  max_tabs: number
  inactive_minutes: number
  hibernate: boolean
  session_timeout: number
  remember_login: boolean
}

/**
 * 获取标签/会话设置响应
 */
export interface GetTabSessionConfigResponse {
  config: TabSessionConfig
}

/**
 * IP 白名单项
 */
export interface IPWhitelist {
  id: number
  ip_address: string
  description: string
  enabled: boolean
  created_by: number
  created_at: string
  updated_at: string
}

/**
 * IP 白名单配置
 */
export interface IPWhitelistConfig {
  enabled: boolean
  ips: IPWhitelistItem[]
}

/**
 * IP 白名单项（简化版）
 */
export interface IPWhitelistItem {
  ip_address: string
  description: string
  enabled: boolean
}

/**
 * 获取 IP 白名单配置响应
 */
export interface GetIPWhitelistConfigResponse {
  config: IPWhitelistConfig
}

/**
 * 创建 IP 白名单请求
 */
export interface CreateIPWhitelistRequest {
  ip_address: string
  description: string
}

/**
 * 更新 IP 白名单请求
 */
export interface UpdateIPWhitelistRequest {
  ip_address?: string
  description?: string
}

/**
 * 检查 IP 请求
 */
export interface CheckIPRequest {
  ip: string
}

/**
 * 检查 IP 响应
 */
export interface CheckIPResponse {
  allowed: boolean
  message: string
}

// === 高级配置类型定义 ===

/**
 * 数据库连接池配置
 */
export interface DatabasePoolConfig {
  max_idle_conns: number
  max_open_conns: number
  conn_max_lifetime: number
  conn_max_idle_time: number
}

/**
 * 获取数据库连接池配置响应
 */
export interface GetDatabasePoolConfigResponse {
  config: DatabasePoolConfig
}

/**
 * JWT 配置
 */
export interface JWTConfig {
  access_expire: number
  refresh_expire: number
}

/**
 * 获取 JWT 配置响应
 */
export interface GetJWTConfigResponse {
  config: JWTConfig
}

/**
 * CORS 配置
 */
export interface CORSConfig {
  allowed_origins: string[]
  allowed_methods: string[]
  allowed_headers: string[]
}

/**
 * 获取 CORS 配置响应
 */
export interface GetCORSConfigResponse {
  config: CORSConfig
}

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  login_limit: number
  api_limit: number
}

/**
 * 获取速率限制配置响应
 */
export interface GetRateLimitConfigResponse {
  config: RateLimitConfig
}

/**
 * Cookie 配置
 */
export interface CookieConfig {
  secure: boolean
  domain: string
}

/**
 * 获取 Cookie 配置响应
 */
export interface GetCookieConfigResponse {
  config: CookieConfig
}

/**
 * 系统设置 API 服务
 */
export const settingsApi = {
  /**
   * 获取 SMTP 配置
   */
  async getSMTPConfig(token: string): Promise<SMTPConfig> {
    const response = await apiFetch<GetSMTPConfigResponse>("/settings/smtp", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存 SMTP 配置
   */
  async saveSMTPConfig(token: string, config: SMTPConfig): Promise<void> {
    return apiFetch<void>("/settings/smtp", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 测试 SMTP 连接
   */
  async testSMTPConnection(token: string, config: SMTPConfig): Promise<void> {
    return apiFetch<void>("/settings/smtp/test", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取 Webhook 配置
   */
  async getWebhookConfig(token: string): Promise<WebhookConfig> {
    const response = await apiFetch<GetWebhookConfigResponse>("/settings/webhook", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存 Webhook 配置
   */
  async saveWebhookConfig(token: string, config: WebhookConfig): Promise<void> {
    return apiFetch<void>("/settings/webhook", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 测试 Webhook 连接
   */
  async testWebhookConnection(token: string, config: WebhookConfig): Promise<void> {
    return apiFetch<void>("/settings/webhook/test", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取钉钉配置
   */
  async getDingTalkConfig(token: string): Promise<DingTalkConfig> {
    const response = await apiFetch<GetDingTalkConfigResponse>("/settings/dingding", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存钉钉配置
   */
  async saveDingTalkConfig(token: string, config: DingTalkConfig): Promise<void> {
    return apiFetch<void>("/settings/dingding", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 测试钉钉连接
   */
  async testDingTalkConnection(token: string, config: DingTalkConfig): Promise<void> {
    return apiFetch<void>("/settings/dingding/test", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取企业微信配置
   */
  async getWeComConfig(token: string): Promise<WeComConfig> {
    const response = await apiFetch<GetWeComConfigResponse>("/settings/wechat", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存企业微信配置
   */
  async saveWeComConfig(token: string, config: WeComConfig): Promise<void> {
    return apiFetch<void>("/settings/wechat", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 测试企业微信连接
   */
  async testWeComConnection(token: string, config: WeComConfig): Promise<void> {
    return apiFetch<void>("/settings/wechat/test", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取系统配置
   */
  async getSystemConfig(token: string): Promise<SystemConfig> {
    const response = await apiFetch<GetSystemConfigResponse>("/settings/system", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存系统配置
   */
  async saveSystemConfig(token: string, config: SystemConfig): Promise<void> {
    return apiFetch<void>("/settings/system", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取标签/会话设置
   */
  async getTabSessionConfig(token: string): Promise<TabSessionConfig> {
    const response = await apiFetch<GetTabSessionConfigResponse>("/settings/tabsession", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存标签/会话设置
   */
  async saveTabSessionConfig(token: string, config: TabSessionConfig): Promise<void> {
    return apiFetch<void>("/settings/tabsession", {
      method: "POST",
      token,
      body: config,
    })
  },

  // === IP 白名单相关 API ===

  /**
   * 获取 IP 白名单配置
   */
  async getIPWhitelistConfig(token: string): Promise<IPWhitelistConfig> {
    const response = await apiFetch<GetIPWhitelistConfigResponse>("/settings/ip-whitelist", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 获取 IP 白名单列表
   */
  async getIPWhitelistList(token: string): Promise<IPWhitelist[]> {
    return apiFetch<IPWhitelist[]>("/settings/ip-whitelist/list", {
      method: "GET",
      token,
    })
  },

  /**
   * 创建 IP 白名单项
   */
  async createIPWhitelist(token: string, request: CreateIPWhitelistRequest): Promise<IPWhitelist> {
    return apiFetch<IPWhitelist>("/settings/ip-whitelist", {
      method: "POST",
      token,
      body: request,
    })
  },

  /**
   * 更新 IP 白名单项
   */
  async updateIPWhitelist(token: string, id: number, request: UpdateIPWhitelistRequest): Promise<IPWhitelist> {
    return apiFetch<IPWhitelist>(`/settings/ip-whitelist/${id}`, {
      method: "PUT",
      token,
      body: request,
    })
  },

  /**
   * 删除 IP 白名单项
   */
  async deleteIPWhitelist(token: string, id: number): Promise<void> {
    return apiFetch<void>(`/settings/ip-whitelist/${id}`, {
      method: "DELETE",
      token,
    })
  },

  /**
   * 切换 IP 白名单项状态
   */
  async toggleIPWhitelist(token: string, id: number): Promise<void> {
    return apiFetch<void>(`/settings/ip-whitelist/${id}/toggle`, {
      method: "POST",
      token,
    })
  },

  /**
   * 检查 IP 是否被允许
   */
  async checkIPAllowed(token: string, request: CheckIPRequest): Promise<CheckIPResponse> {
    return apiFetch<CheckIPResponse>("/settings/ip-whitelist/check", {
      method: "POST",
      token,
      body: request,
    })
  },

  // === 高级配置相关 API ===

  /**
   * 获取数据库连接池配置
   */
  async getDatabasePoolConfig(token: string): Promise<DatabasePoolConfig> {
    const response = await apiFetch<GetDatabasePoolConfigResponse>("/settings/advanced/database-pool", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存数据库连接池配置
   */
  async saveDatabasePoolConfig(token: string, config: DatabasePoolConfig): Promise<void> {
    return apiFetch<void>("/settings/advanced/database-pool", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取 JWT 配置
   */
  async getJWTConfig(token: string): Promise<JWTConfig> {
    const response = await apiFetch<GetJWTConfigResponse>("/settings/advanced/jwt", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存 JWT 配置
   */
  async saveJWTConfig(token: string, config: JWTConfig): Promise<void> {
    return apiFetch<void>("/settings/advanced/jwt", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取 CORS 配置
   */
  async getCORSConfig(token: string): Promise<CORSConfig> {
    const response = await apiFetch<GetCORSConfigResponse>("/settings/advanced/cors", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存 CORS 配置
   */
  async saveCORSConfig(token: string, config: CORSConfig): Promise<void> {
    return apiFetch<void>("/settings/advanced/cors", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取速率限制配置
   */
  async getRateLimitConfig(token: string): Promise<RateLimitConfig> {
    const response = await apiFetch<GetRateLimitConfigResponse>("/settings/advanced/ratelimit", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存速率限制配置
   */
  async saveRateLimitConfig(token: string, config: RateLimitConfig): Promise<void> {
    return apiFetch<void>("/settings/advanced/ratelimit", {
      method: "POST",
      token,
      body: config,
    })
  },

  /**
   * 获取 Cookie 配置
   */
  async getCookieConfig(token: string): Promise<CookieConfig> {
    const response = await apiFetch<GetCookieConfigResponse>("/settings/advanced/cookie", {
      method: "GET",
      token,
    })
    return response.config
  },

  /**
   * 保存 Cookie 配置
   */
  async saveCookieConfig(token: string, config: CookieConfig): Promise<void> {
    return apiFetch<void>("/settings/advanced/cookie", {
      method: "POST",
      token,
      body: config,
    })
  },
}
