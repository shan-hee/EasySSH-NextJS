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
export interface WebhookConfig {
  enabled: boolean
  url: string
  secret: string
  method: string // POST 或 GET
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

  // 性能设置
  default_page_size: number
  max_file_upload_size: number

  // 文件传输设置
  download_exclude_patterns: string
  default_download_mode: "fast" | "compatible"
  skip_excluded_on_upload: boolean

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

  // 注册配置
  allow_registration?: boolean

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
  // === 统一的通知配置 API ===

  /**
   * 获取所有通知配置（统一接口）
   */
  async getNotificationConfig(): Promise<NotificationConfig> {
    try {
      const response = await apiFetch<GetNotificationConfigResponse>("/settings/notifications", {
        method: "GET",
        retry: false, // 禁用重试，减少错误日志
      })
      return response.config
    } catch (error) {
      // 返回默认配置（API 未实现时）
      return {
        smtp: {
          enabled: false,
          host: "",
          port: 587,
          username: "",
          password: "",
          from_email: "",
          from_name: "",
          use_tls: true,
        },
        webhook: {
          enabled: false,
          url: "",
          secret: "",
          method: "POST",
        },
        dingtalk: {
          enabled: false,
          webhook_url: "",
          secret: "",
        },
        wecom: {
          enabled: false,
          webhook_url: "",
        },
      }
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

  // === 通知测试连接 API ===

  /**
   * 测试 SMTP 连接
   */
  async testSMTPConnection(config: SMTPConfig): Promise<void> {
    return apiFetch<void>("/settings/notifications/smtp/test", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 测试 Webhook 连接
   */
  async testWebhookConnection(config: WebhookConfig): Promise<void> {
    return apiFetch<void>("/settings/notifications/webhook/test", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 测试钉钉连接
   */
  async testDingTalkConnection(config: DingTalkConfig): Promise<void> {
    return apiFetch<void>("/settings/notifications/dingtalk/test", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 测试企业微信连接
   */
  async testWeComConnection(config: WeComConfig): Promise<void> {
    return apiFetch<void>("/settings/notifications/wecom/test", {
      method: "POST",
      body: config,
    })
  },

  // === 单独的通知配置 API（向后兼容） ===

  /**
   * 获取 SMTP 配置
   * @deprecated 建议使用 getNotificationConfig() 获取完整配置
   */
  async getSMTPConfig(): Promise<SMTPConfig> {
    const config = await this.getNotificationConfig()
    return config.smtp
  },

  /**
   * 保存 SMTP 配置
   * @deprecated 建议使用 saveNotificationConfig() 保存完整配置
   */
  async saveSMTPConfig(smtpConfig: SMTPConfig): Promise<void> {
    const config = await this.getNotificationConfig()
    config.smtp = smtpConfig
    return this.saveNotificationConfig(config)
  },

  /**
   * 获取 Webhook 配置
   * @deprecated 建议使用 getNotificationConfig() 获取完整配置
   */
  async getWebhookConfig(): Promise<WebhookConfig> {
    const config = await this.getNotificationConfig()
    return config.webhook
  },

  /**
   * 保存 Webhook 配置
   * @deprecated 建议使用 saveNotificationConfig() 保存完整配置
   */
  async saveWebhookConfig(webhookConfig: WebhookConfig): Promise<void> {
    const config = await this.getNotificationConfig()
    config.webhook = webhookConfig
    return this.saveNotificationConfig(config)
  },

  /**
   * 获取钉钉配置
   * @deprecated 建议使用 getNotificationConfig() 获取完整配置
   */
  async getDingTalkConfig(): Promise<DingTalkConfig> {
    const config = await this.getNotificationConfig()
    return config.dingtalk
  },

  /**
   * 保存钉钉配置
   * @deprecated 建议使用 saveNotificationConfig() 保存完整配置
   */
  async saveDingTalkConfig(dingtalkConfig: DingTalkConfig): Promise<void> {
    const config = await this.getNotificationConfig()
    config.dingtalk = dingtalkConfig
    return this.saveNotificationConfig(config)
  },

  /**
   * 获取企业微信配置
   * @deprecated 建议使用 getNotificationConfig() 获取完整配置
   */
  async getWeComConfig(): Promise<WeComConfig> {
    const config = await this.getNotificationConfig()
    return config.wecom
  },

  /**
   * 保存企业微信配置
   * @deprecated 建议使用 saveNotificationConfig() 保存完整配置
   */
  async saveWeComConfig(wecomConfig: WeComConfig): Promise<void> {
    const config = await this.getNotificationConfig()
    config.wecom = wecomConfig
    return this.saveNotificationConfig(config)
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
  async saveSystemConfig(config: SystemConfig): Promise<void> {
    return apiFetch<void>("/settings/system", {
      method: "POST",
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

  /**
   * 获取 Cookie 配置
   * @deprecated Cookie配置已移至环境变量(.env.example)，此方法已废弃
   */
  async getCookieConfig(): Promise<CookieConfig> {
    const response = await apiFetch<GetCookieConfigResponse>("/settings/advanced/cookie", {
      method: "GET",
    })
    return response.config
  },

  /**
   * 保存 Cookie 配置
   * @deprecated Cookie配置已移至环境变量(.env.example)，此方法已废弃
   */
  async saveCookieConfig(config: CookieConfig): Promise<void> {
    return apiFetch<void>("/settings/advanced/cookie", {
      method: "POST",
      body: config,
    })
  },

  // === AI 配置相关 API ===

  /**
   * 获取系统级 AI 配置
   */
  async getAISystemConfig(): Promise<any> {
    const response = await apiFetch<any>("/settings/ai/system", { method: "GET" })
    return response.config || {}
  },

  /**
   * 保存系统级 AI 配置
   */
  async saveAISystemConfig(config: any): Promise<void> {
    return apiFetch<void>("/settings/ai/system", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 获取用户 AI 配置
   */
  async getAIUserConfig(): Promise<any> {
    const response = await apiFetch<any>("/settings/ai/user", { method: "GET" })
    return response.config || {}
  },

  /**
   * 保存用户 AI 配置
   */
  async saveAIUserConfig(config: any): Promise<void> {
    return apiFetch<void>("/settings/ai/user", {
      method: "POST",
      body: config,
    })
  },

  /**
   * 获取 AI 模型参数
   */
  async getAIModelParams(): Promise<any> {
    const response = await apiFetch<any>("/settings/ai/model-params", { method: "GET" })
    return response.params || {}
  },

  /**
   * 保存 AI 模型参数
   */
  async saveAIModelParams(params: any): Promise<void> {
    return apiFetch<void>("/settings/ai/model-params", {
      method: "POST",
      body: params,
    })
  },

  /**
   * 获取 AI 隐私设置
   */
  async getAIPrivacySettings(): Promise<any> {
    const response = await apiFetch<any>("/settings/ai/privacy", { method: "GET" })
    return response.settings || {}
  },

  /**
   * 保存 AI 隐私设置
   */
  async saveAIPrivacySettings(settings: any): Promise<void> {
    return apiFetch<void>("/settings/ai/privacy", {
      method: "POST",
      body: settings,
    })
  },

  // === 集成配置相关 API（统一接口 - 已废弃） ===

  /**
   * 获取集成配置（包含AI、通知等所有配置）
   * @deprecated 请使用各个独立的 API 方法
   */
  async getIntegrationsConfig(): Promise<any> {
    // 并行获取所有配置（禁用重试以减少错误日志）
    const [aiSystem, aiUser, modelParams, privacy, notifications] = await Promise.all([
      // AI配置
      apiFetch<any>("/settings/ai/system", { method: "GET", retry: false }).catch(() => ({ config: {} })),
      apiFetch<any>("/settings/ai/user", { method: "GET", retry: false }).catch(() => ({ config: {} })),
      apiFetch<any>("/settings/ai/model-params", { method: "GET", retry: false }).catch(() => ({ params: {} })),
      apiFetch<any>("/settings/ai/privacy", { method: "GET", retry: false }).catch(() => ({ settings: {} })),
      // 通知配置（使用统一 API）
      this.getNotificationConfig(),
    ])

    // 合并所有配置
    return {
      // AI系统配置
      system_enabled: aiSystem.config?.system_enabled ?? false,
      system_provider: aiSystem.config?.system_provider ?? "openai",
      system_api_endpoint: aiSystem.config?.system_api_endpoint ?? "",
      system_default_model: aiSystem.config?.system_default_model ?? "",
      system_rate_limit: aiSystem.config?.system_rate_limit ?? 100,

      // AI用户配置
      use_system_config: aiUser.config?.use_system_config ?? true,
      provider: aiUser.config?.provider ?? "openai",
      api_key: aiUser.config?.api_key ?? "",
      api_endpoint: aiUser.config?.api_endpoint ?? "",
      preferred_model: aiUser.config?.preferred_model ?? "",

      // AI模型参数
      temperature: modelParams.params?.temperature ?? 0.7,
      max_tokens: modelParams.params?.max_tokens ?? 2048,
      top_p: modelParams.params?.top_p ?? 1.0,
      frequency_penalty: modelParams.params?.frequency_penalty ?? 0.0,
      presence_penalty: modelParams.params?.presence_penalty ?? 0.0,

      // AI隐私设置
      save_history: privacy.settings?.save_history ?? true,
      allow_training: privacy.settings?.allow_training ?? false,
      auto_delete_days: privacy.settings?.auto_delete_days ?? 30,

      // SMTP配置
      enabled: notifications.smtp.enabled ?? false,
      host: notifications.smtp.host ?? "",
      port: notifications.smtp.port ?? 587,
      username: notifications.smtp.username ?? "",
      password: notifications.smtp.password ?? "",
      from_email: notifications.smtp.from_email ?? "",
      from_name: notifications.smtp.from_name ?? "",
      use_tls: notifications.smtp.use_tls ?? true,

      // Webhook配置
      webhook_url: notifications.webhook.url ?? "",
      webhook_method: notifications.webhook.method ?? "POST",
      webhook_secret: notifications.webhook.secret ?? "",
      webhook_enabled: notifications.webhook.enabled ?? false,

      // 钉钉配置
      dingtalk_enabled: notifications.dingtalk.enabled ?? false,
      dingtalk_webhook_url: notifications.dingtalk.webhook_url ?? "",
      dingtalk_secret: notifications.dingtalk.secret ?? "",

      // 企业微信配置
      wecom_enabled: notifications.wecom.enabled ?? false,
      wecom_webhook_url: notifications.wecom.webhook_url ?? "",
    }
  },

  /**
   * 保存集成配置（包含AI、通知等所有配置）
   */
  async saveIntegrationsConfig(config: any): Promise<void> {
    // 并行保存所有配置
    await Promise.all([
      // 保存AI系统配置
      apiFetch<void>("/settings/ai/system", {
        method: "POST",
        body: {
          system_enabled: config.system_enabled,
          system_provider: config.system_provider,
          system_api_endpoint: config.system_api_endpoint,
          system_default_model: config.system_default_model,
          system_rate_limit: config.system_rate_limit,
        },
      }).catch(err => console.error("Failed to save AI system config:", err)),

      // 保存AI用户配置
      apiFetch<void>("/settings/ai/user", {
        method: "POST",
        body: {
          use_system_config: config.use_system_config,
          provider: config.provider,
          api_key: config.api_key,
          api_endpoint: config.api_endpoint,
          preferred_model: config.preferred_model,
        },
      }).catch(err => console.error("Failed to save AI user config:", err)),

      // 保存AI模型参数
      apiFetch<void>("/settings/ai/model-params", {
        method: "POST",
        body: {
          temperature: config.temperature,
          max_tokens: config.max_tokens,
          top_p: config.top_p,
          frequency_penalty: config.frequency_penalty,
          presence_penalty: config.presence_penalty,
        },
      }).catch(err => console.error("Failed to save model params:", err)),

      // 保存AI隐私设置
      apiFetch<void>("/settings/ai/privacy", {
        method: "POST",
        body: {
          save_history: config.save_history,
          allow_training: config.allow_training,
          auto_delete_days: config.auto_delete_days,
        },
      }).catch(err => console.error("Failed to save privacy settings:", err)),

      // 保存通知配置（使用统一 API）
      this.saveNotificationConfig({
        smtp: {
          enabled: config.enabled,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          from_email: config.from_email,
          from_name: config.from_name,
          use_tls: config.use_tls,
        },
        webhook: {
          enabled: config.webhook_enabled,
          url: config.webhook_url,
          method: config.webhook_method,
          secret: config.webhook_secret,
        },
        dingtalk: {
          enabled: config.dingtalk_enabled,
          webhook_url: config.dingtalk_webhook_url,
          secret: config.dingtalk_secret,
        },
        wecom: {
          enabled: config.wecom_enabled,
          webhook_url: config.wecom_webhook_url,
        },
      }).catch(err => console.error("Failed to save notification config:", err)),
    ])
  },
}
