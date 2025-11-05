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
  system_description: string
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
}

/**
 * 获取标签/会话设置响应
 */
export interface GetTabSessionConfigResponse {
  config: TabSessionConfig
}

/**
 * Logo上传响应
 */
export interface UploadLogoResponse {
  message: string
  file_url: string
  file_name: string
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
   * 上传Logo文件
   */
  async uploadLogo(token: string, file: File): Promise<UploadLogoResponse> {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiFetch<UploadLogoResponse>("/settings/upload/logo", {
      method: "POST",
      token,
      body: formData,
      headers: {
        // 不要设置 Content-Type，让浏览器自动设置 multipart/form-data
      },
    })
    return response
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
}
