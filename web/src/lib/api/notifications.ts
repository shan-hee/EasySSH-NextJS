import { apiFetch } from "@/lib/api-client"

/**
 * 通知设置
 */
export interface NotificationSettings {
  email_login?: boolean
  email_alert?: boolean
  browser?: boolean
}

/**
 * 通知设置 API 服务
 */
export const notificationsApi = {
  /**
   * 更新通知设置
   */
  async update(
    token: string,
    settings: NotificationSettings
  ): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/users/me/notifications", {
      token,
      method: "PUT",
      body: JSON.stringify(settings),
    })
  },
}
