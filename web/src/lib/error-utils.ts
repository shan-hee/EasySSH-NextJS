import { isApiError } from "@/lib/api-client"

/**
 * 从错误对象提取用户友好的错误消息
 * @param error 错误对象
 * @param defaultMessage 默认错误消息
 * @returns 用户友好的错误消息
 */
export function getErrorMessage(error: unknown, defaultMessage = "操作失败"): string {
  if (isApiError(error)) {
    // 根据HTTP状态码提供更友好的消息
    if (error.status === 401) {
      return "认证失败，请重新登录"
    } else if (error.status === 403) {
      return "权限不足，无法执行此操作"
    } else if (error.status === 404) {
      return "请求的资源不存在"
    } else if (error.status >= 500) {
      return "服务器内部错误，请稍后重试或联系管理员"
    }

    // 返回错误消息
    if (error.message) {
      return error.message
    }
  } else if (error instanceof Error) {
    return error.message
  } else if (typeof error === 'string') {
    return error
  }

  return defaultMessage
}
