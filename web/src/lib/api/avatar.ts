import { apiFetch } from "@/lib/api-client"

/**
 * 生成头像请求
 */
export interface GenerateAvatarRequest {
  seed?: string // 可选的种子值，用于生成一致的头像
}

/**
 * 生成头像响应
 */
export interface GenerateAvatarResponse {
  avatar: string // base64编码的SVG头像数据URL
}

/**
 * 头像API客户端
 */
export const avatarApi = {
  /**
   * 生成头像
   * @param token 认证令牌
   * @param request 生成头像请求参数
   * @returns 生成的头像数据URL
   */
  async generate(token: string, request: GenerateAvatarRequest = {}): Promise<GenerateAvatarResponse> {
    const response = await apiFetch<GenerateAvatarResponse>("/avatar/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    return response
  },

  /**
   * 为新用户生成头像（基于用户信息）
   * @param token 认证令牌
   * @param username 用户名
   * @param email 邮箱（可选）
   * @returns 生成的头像数据URL
   */
  async generateForNewUser(token: string, username: string, email?: string): Promise<GenerateAvatarResponse> {
    // 生成确定性种子
    const seed = this.generateUserSeed(username, email)

    return this.generate(token, { seed })
  },

  /**
   * 基于用户信息生成确定性种子
   * @param username 用户名
   * @param email 邮箱（可选）
   * @returns 确定性种子值
   */
  generateUserSeed(username: string, email?: string): string {
    // 使用用户名作为主要种子
    let seedInput = username.toLowerCase().trim()

    // 如果有邮箱，组合使用以增加唯一性
    if (email) {
      seedInput += email.toLowerCase().trim()
    }

    // 简单的哈希函数生成确定性种子
    let hash = 0
    for (let i = 0; i < seedInput.length; i++) {
      const char = seedInput.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    // 转换为正数并转为16进制字符串
    return Math.abs(hash).toString(16)
  },

  /**
   * 验证头像数据URL是否有效
   * @param dataUrl 头像数据URL
   * @returns 是否为有效的头像
   */
  isValidAvatarDataUrl(dataUrl: string): boolean {
    if (!dataUrl || typeof dataUrl !== 'string') {
      return false
    }

    // 检查是否为有效的data URL格式
    return dataUrl.startsWith('data:image/') && dataUrl.includes(',')
  }
}