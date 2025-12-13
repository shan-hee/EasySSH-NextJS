import { apiFetch } from "@/lib/api-client"

/**
 * 通知设置
 */
export interface NotificationSettings {
  // 邮件通知
  email_login?: boolean
  email_alert?: boolean
  // 浏览器通知
  browser?: boolean
  // 登录安全告警
  new_device?: boolean      // 新设备登录通知
  new_location?: boolean    // 新地点登录通知
  suspicious?: boolean      // 可疑登录通知
}

/**
 * 通知设置 API 服务
 */
export const notificationsApi = {
  /**
   * 更新通知设置
   */
  async update(settings: NotificationSettings): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/users/me/notifications", {
      method: "PUT",
      body: JSON.stringify(settings),
    })
  },
}
