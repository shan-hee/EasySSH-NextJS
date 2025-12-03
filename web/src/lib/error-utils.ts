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

  // 权限相关错误
  "User registration is currently disabled": "用户注册功能已关闭",
  "Verification service is not available. Please contact administrator.": "验证码服务不可用，请联系管理员",
  "Email service is not configured. Please configure SMTP settings in: Settings > Integrations > Email Notifications": "邮件服务未配置，请在设置中配置SMTP",

  // 通用错误
  "Failed to register user": "注册失败",
  "Failed to generate verification code": "生成验证码失败",
  "Failed to send verification code email": "发送验证码邮件失败",
}

export function getErrorMessage(error: unknown, defaultMessage = "操作失败"): string {
  if (isApiError(error)) {
    // 优先返回服务器返回的具体错误消息，并尝试翻译
    if (error.message) {
      // 如果有中文翻译，返回翻译后的消息
      const translatedMessage = ERROR_MESSAGE_MAP[error.message]
      if (translatedMessage) {
        return translatedMessage
      }
      // 否则返回原始消息
      return error.message
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
