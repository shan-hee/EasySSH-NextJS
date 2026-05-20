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
 * Webhook 配置
 */
export type WebhookMethod = "POST" | "GET"

export interface WebhookConfig {
  enabled: boolean
  url: string
  secret: string
  method: WebhookMethod
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
 * 企业微信配置
 */
export interface WeComConfig {
  enabled: boolean
  webhook_url: string
}

/**
 * 统一的通知配置（包含所有通知方式）
 */
export interface NotificationConfig {
  // SMTP 邮件通知
  smtp: SMTPConfig
  // Webhook 通知
  webhook: WebhookConfig
  // 钉钉通知
  dingtalk: DingTalkConfig
  // 企业微信通知
  wecom: WeComConfig
}

/**
 * 获取通知配置响应
 */
export interface GetNotificationConfigResponse {
  config: NotificationConfig
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
  default_language: "zh-CN" | "en-US"
  default_timezone: string
  date_format: string

  // 文件传输设置
  download_exclude_patterns: string
  default_download_mode: "fast" | "compatible"
  skip_excluded_on_upload: boolean
  max_file_upload_size: number

  // 补全配置
  completion_enabled?: boolean
  completion_providers?: {
    local: boolean
    remote_history: boolean
    script: boolean
    session: boolean
  }
  completion_quotas?: {
    local_min: number
    local_max: number
    script_min: number
    script_max: number
    session_min: number
    session_max: number
    remote_history_unlimited: boolean
    remote_history_soft_max: number
  }
  completion_cache?: {
    ttl_minutes: number
    max_entries: number
  }
  tab_session?: TabSessionConfig
  jwt_access_expire_minutes?: number
  jwt_refresh_idle_expire_days?: number
  jwt_refresh_absolute_expire_days?: number
  jwt_refresh_rotate?: boolean
  jwt_refresh_reuse_detection?: boolean

  // 注册配置
  allow_registration?: boolean
  default_role?: "user" | "viewer"

  // OAuth 配置
  oauth_enabled?: boolean
  google_client_id?: string
  google_client_secret?: string
}

/**
 * 获取系统配置响应
 */
export interface GetSystemConfigResponse {
  config: SystemConfig
}

export interface SaveCompletionConfigRequest {
  completion_enabled?: boolean
  completion_providers?: Partial<NonNullable<SystemConfig["completion_providers"]>>
  completion_quotas?: Partial<NonNullable<SystemConfig["completion_quotas"]>>
  completion_cache?: Partial<NonNullable<SystemConfig["completion_cache"]>>
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
  jwt_access_expire_minutes?: number
  jwt_refresh_idle_expire_days?: number
  jwt_refresh_absolute_expire_days?: number
  jwt_refresh_rotate?: boolean
  jwt_refresh_reuse_detection?: boolean
}

export interface JWTSessionConfig {
  jwt_access_expire_minutes: number
  jwt_refresh_idle_expire_days: number
  jwt_refresh_absolute_expire_days: number
  jwt_refresh_rotate: boolean
  jwt_refresh_reuse_detection: boolean
}

/**
 * 获取标签/会话设置响应
 */
export interface GetTabSessionConfigResponse {
  config: TabSessionConfig
}

/**
 * IP 访问控制配置
 */
export interface IPWhitelistConfig {
  allowlist_ips: string
  blocklist_ips: string
}

/**
 * 获取 IP 访问控制配置响应
 */
export interface GetIPWhitelistConfigResponse {
  config: IPWhitelistConfig
}

// === 高级配置类型定义 ===

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
  two_fa_limit: number
}

/**
 * 获取速率限制配置响应
 */
export interface GetRateLimitConfigResponse {
  config: RateLimitConfig
}

/**
 * 系统级 AI 配置
 */
export type AISystemProvider = "openai" | "openai-response" | "gemini" | "anthropic"

const VALID_AI_SYSTEM_PROVIDERS: AISystemProvider[] = [
  "openai",
  "openai-response",
  "gemini",
  "anthropic",
]

export interface AISystemConfig {
  system_enabled: boolean
  system_provider: AISystemProvider
  system_api_key?: string
  system_api_endpoint: string
  system_models: string
  has_api_key?: boolean
}

/**
 * 保存系统级 AI 配置请求
 */
export interface SaveAISystemConfigRequest {
  system_enabled?: boolean
  system_provider?: AISystemProvider
  system_api_key?: string
  system_api_endpoint?: string
  system_models?: string
}

/**
 * 探测系统 AI 模型请求
 */
export interface ProbeAISystemModelsRequest {
  system_provider?: AISystemProvider
  system_api_key?: string
  system_api_endpoint?: string
}

/**
 * 探测系统 AI 模型响应
 */
export interface ProbeAISystemModelsResponse {
  available: boolean
  models: string[]
  message?: string
}

/**
 * 系统设置 API 服务
 */
export const settingsApi = {
  // === 统一的通知配置 API ===

  /**
   * 获取所有通知配置（统一接口）
   */
  async getNotificationConfig(): Promise<NotificationConfig> {
    const response = await apiFetch<GetNotificationConfigResponse>("/settings/notifications", {
      method: "GET",
      retry: false, // 禁用重试，减少错误日志
    })
    return {
      ...response.config,
      webhook: {
        ...response.config.webhook,
        method: response.config.webhook.method === "GET" ? "GET" : "POST",
      },
    }
  },

  /**
   * 保存所有通知配置（统一接口）
   */
  async saveNotificationConfig(config: NotificationConfig): Promise<void> {
    return apiFetch<void>("/settings/notifications", {
      method: "POST",
      body: config,
    })
  },

  // === 通知配置分组 API ===

  /**
   * 保存 SMTP 配置
   */
  async saveSMTPConfigOnly(config: SMTPConfig): Promise<void> {
    return apiFetch<void>("/settings/smtp", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 保存 Webhook 配置
   */
  async saveWebhookConfigOnly(config: WebhookConfig): Promise<void> {
    return apiFetch<void>("/settings/webhook", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 保存钉钉配置
   */
  async saveDingTalkConfigOnly(config: DingTalkConfig): Promise<void> {
    return apiFetch<void>("/settings/dingtalk", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 保存企业微信配置
   */
  async saveWeComConfigOnly(config: WeComConfig): Promise<void> {
    return apiFetch<void>("/settings/wecom", {
      method: "POST",
      body: config,
    })
  },

  // === 通知测试连接 API ===

  /**
   * 测试 SMTP 连接
   */
  async testSMTPConnection(config: SMTPConfig): Promise<void> {
    return apiFetch<void>("/settings/smtp/test", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 测试 Webhook 连接
   */
  async testWebhookConnection(config: WebhookConfig): Promise<void> {
    return apiFetch<void>("/settings/webhook/test", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 测试钉钉连接
   */
  async testDingTalkConnection(config: DingTalkConfig): Promise<void> {
    return apiFetch<void>("/settings/dingtalk/test", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 测试企业微信连接
   */
  async testWeComConnection(config: WeComConfig): Promise<void> {
    return apiFetch<void>("/settings/wecom/test", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 获取系统配置
   */
  async getSystemConfig(): Promise<SystemConfig> {
    const response = await apiFetch<GetSystemConfigResponse>("/settings/system", {
      method: "GET",
    })
    return response.config
  },

  /**
   * 保存系统配置
   */
  async saveBasicInfo(config: Partial<SystemConfig>): Promise<void> {
    return apiFetch<void>("/settings/system/basic", {
      method: "PATCH",
      body: config,
    })
  },

  /**
   * 保存文件传输配置
   */
  async saveFileTransferConfig(config: Partial<SystemConfig>): Promise<void> {
    return apiFetch<void>("/settings/system/file-transfer", {
      method: "PATCH",
      body: config,
    })
  },

  /**
   * 保存补全配置
   */
  async saveCompletionConfig(config: SaveCompletionConfigRequest): Promise<void> {
    return apiFetch<void>("/settings/system/completion", {
      method: "PATCH",
      body: config,
    })
  },

  /**
   * 保存 JWT 过期与刷新配置
   */
  async saveJWTSessionConfig(config: JWTSessionConfig): Promise<void> {
    return apiFetch<void>("/settings/system/jwt-session", {
      method: "PATCH",
      body: config,
    })
  },

  /**
   * 获取标签/会话设置
   */
  async getTabSessionConfig(): Promise<TabSessionConfig> {
    const response = await apiFetch<GetTabSessionConfigResponse>("/settings/tabsession", {
      method: "GET",
    })
    return response.config
  },

  /**
   * 保存标签/会话设置
   */
  async saveTabSessionConfig(config: TabSessionConfig): Promise<void> {
    return apiFetch<void>("/settings/tabsession", {
      method: "POST",
      body: config,
    })
  },

  // === IP 白名单相关 API ===

  /**
   * 获取 IP 访问控制配置
   */
  async getIPWhitelistConfig(): Promise<IPWhitelistConfig> {
    const response = await apiFetch<GetIPWhitelistConfigResponse>("/settings/access-control", {
      method: "GET",
    })
    return response.config
  },

  /**
   * 保存 IP 访问控制配置
   */
  async saveIPWhitelistConfig(config: Partial<IPWhitelistConfig>): Promise<void> {
    return apiFetch<void>("/settings/access-control", {
      method: "POST",
      body: config,
    })
  },

  // === 高级配置相关 API ===

  /**
   * 获取 CORS 配置
   */
  async getCORSConfig(): Promise<CORSConfig> {
    const response = await apiFetch<GetCORSConfigResponse>("/settings/advanced/cors", {
      method: "GET",
    })
    return response.config
  },

  /**
   * 保存 CORS 配置
   */
  async saveCORSConfig(config: CORSConfig): Promise<void> {
    return apiFetch<void>("/settings/advanced/cors", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 获取速率限制配置
   */
  async getRateLimitConfig(): Promise<RateLimitConfig> {
    const response = await apiFetch<GetRateLimitConfigResponse>("/settings/advanced/ratelimit", {
      method: "GET",
    })
    return response.config
  },

  /**
   * 保存速率限制配置
   */
  async saveRateLimitConfig(config: RateLimitConfig): Promise<void> {
    return apiFetch<void>("/settings/advanced/ratelimit", {
      method: "POST",
      body: config,
    })
  },

  // === AI 配置相关 API ===

  /**
   * 获取系统级 AI 配置
   */
  async getAISystemConfig(): Promise<AISystemConfig> {
    const response = await apiFetch<
      Partial<Omit<AISystemConfig, "system_provider">> & { system_provider?: string }
    >("/settings/ai/system", { method: "GET" })
    const rawProvider = (response.system_provider || "").toLowerCase()
    const normalizedProvider: AISystemProvider =
      VALID_AI_SYSTEM_PROVIDERS.includes(rawProvider as AISystemProvider)
        ? (rawProvider as AISystemProvider)
        : "openai"
    return {
      system_enabled: response.system_enabled ?? false,
      system_provider: normalizedProvider,
      system_api_endpoint: response.system_api_endpoint ?? "",
      system_models: response.system_models ?? "",
      has_api_key: response.has_api_key ?? false,
      system_api_key: "",
    }
  },

  /**
   * 保存系统级 AI 配置
   */
  async saveAISystemConfig(config: SaveAISystemConfigRequest): Promise<void> {
    return apiFetch<void>("/settings/ai/system", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 探测系统级 AI 可用模型
   */
  async probeAISystemModels(payload: ProbeAISystemModelsRequest): Promise<ProbeAISystemModelsResponse> {
    return apiFetch<ProbeAISystemModelsResponse>("/settings/ai/system/models", {
      method: "POST",
      body: payload,
    })
  },
}

/**
 * 用户AI配置
 */
export interface UserAIConfig {
  use_system_config: boolean
  custom_enabled: boolean
  custom_provider: string
  custom_endpoint: string
  custom_models: string
  has_api_key: boolean
}

/**
 * 保存用户AI配置请求
 */
export interface SaveUserAIConfigRequest {
  use_system_config: boolean
  custom_enabled: boolean
  custom_provider: string
  custom_api_key: string
  custom_endpoint: string
  custom_models: string
}

/**
 * 用户AI配置 API 服务
 */
export const userAIConfigApi = {
  /**
   * 获取当前用户的AI配置
   */
  async getUserAIConfig(): Promise<UserAIConfig> {
    return apiFetch<UserAIConfig>("/users/me/ai-config", {
      method: "GET",
    })
  },

  /**
   * 保存当前用户的AI配置
   */
  async saveUserAIConfig(config: SaveUserAIConfigRequest): Promise<void> {
    return apiFetch<void>("/users/me/ai-config", {
      method: "PUT",
      body: config,
    })
  },

  /**
   * 删除当前用户的AI配置（恢复使用系统配置）
   */
  async deleteUserAIConfig(): Promise<void> {
    return apiFetch<void>("/users/me/ai-config", {
      method: "DELETE",
    })
  },
}
