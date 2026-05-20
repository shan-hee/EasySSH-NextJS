import { isApiError } from "@/lib/api-client"

/**
 * 从错误对象提取用户友好的错误消息
 * @param error 错误对象
 * @param defaultMessage 默认错误消息
 * @returns 用户友好的错误消息
 */
/**
 * 错误消息映射表（英文 -> 中文）
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  // 用户相关错误
  "Username or email already exists": "用户名或邮箱已存在",
  "Invalid username or password": "用户名或密码错误",
  "User not found": "用户不存在",
  "Invalid or expired verification code": "验证码无效或已过期",
  "Verification code not found, please request a new one": "验证码不存在，请重新获取",
  "Too many failed attempts, please request a new code": "验证失败次数过多，请重新获取验证码",
  "Invalid verification code": "验证码错误",
  "Please wait 60 seconds before requesting another code": "请等待60秒后再次获取验证码",

  // 密码重置相关错误
  "If the email exists, a password reset code has been sent": "如果该邮箱存在，密码重置验证码已发送",
  "Password reset code sent successfully": "密码重置验证码发送成功",
  "Password reset successfully": "密码重置成功",
  "Failed to send password reset code email": "发送密码重置验证码邮件失败",
  "Failed to reset password": "重置密码失败",

  // 密码策略相关错误
  "密码长度至少需要 8 个字符": "密码长度至少需要 8 个字符",
  "密码过于简单，请使用更复杂的密码": "密码过于简单，请使用更复杂的密码",
  "密码必须包含至少一个大写字母": "密码必须包含至少一个大写字母",
  "密码必须包含至少一个小写字母": "密码必须包含至少一个小写字母",
  "密码必须包含至少一个数字": "密码必须包含至少一个数字",
  "密码必须包含至少一个特殊字符": "密码必须包含至少一个特殊字符",
  "password validation failed": "密码验证失败，请确保密码符合要求",

  // 权限相关错误
  "registration_disabled": "用户注册功能已关闭，请联系管理员先创建或绑定账号",
  "User registration is currently disabled": "用户注册功能已关闭",
  "User registration is disabled. Please contact administrator.": "用户注册功能已关闭，请联系管理员先创建或绑定账号",
  "Verification service is not available. Please contact administrator.": "验证码服务不可用，请联系管理员",
  "Email service is not configured. Please configure SMTP settings in: Settings > Integrations > Email Notifications": "邮件服务未配置，请在设置中配置SMTP",

  // 通用错误
  "Failed to register user": "注册失败",
  "Failed to generate verification code": "生成验证码失败",
  "Failed to send verification code email": "发送验证码邮件失败",

  // 账户锁定相关错误
  "Account is temporarily locked due to too many failed login attempts. Please try again later.": "账户因登录失败次数过多已被临时锁定，请稍后再试",
  "account_locked": "账户已被锁定，请稍后再试",
  "ip_locked": "当前IP因登录失败次数过多已被临时锁定，请稍后再试",
  "Too many requests from this IP address. Please try again later.": "当前IP请求过于频繁，请稍后再试",

  // 用户状态相关错误
  "User account is locked": "用户账户已被锁定",
  "User account is disabled": "用户账户已被禁用",
  "Account is locked. Please contact administrator.": "账户已被锁定，请联系管理员",
}

export function getErrorMessage(error: unknown, defaultMessage = "操作失败"): string {
  if (isApiError(error)) {
    const detail = error.detail
    if (detail && typeof detail === "object") {
      const detailObj = detail as { error?: unknown; message?: unknown }
      const candidates = [detailObj.message, detailObj.error]

      for (const candidate of candidates) {
        if (typeof candidate !== "string" || candidate.trim() === "") {
          continue
        }
        const translatedMessage = ERROR_MESSAGE_MAP[candidate]
        if (translatedMessage) {
          return translatedMessage
        }
        return candidate
      }
    } else if (typeof detail === "string" && detail.trim() !== "") {
      const translatedMessage = ERROR_MESSAGE_MAP[detail]
      if (translatedMessage) {
        return translatedMessage
      }
      return detail
    }

    // 根据HTTP状态码提供更友好的消息（作为后备）
    if (error.status === 401) {
      return "认证失败，请重新登录"
    } else if (error.status === 403) {
      return "权限不足，无法执行此操作"
    } else if (error.status === 404) {
      return "请求的资源不存在"
    } else if (error.status === 409) {
      return "资源冲突，请检查输入信息"
    } else if (error.status === 429) {
      return "请求过于频繁或账户已被锁定，请稍后再试"
    } else if (error.status >= 500) {
      return "服务器内部错误，请稍后重试或联系管理员"
    }
  } else if (error instanceof Error) {
    return error.message
  } else if (typeof error === 'string') {
    return error
  }

  return defaultMessage
}
