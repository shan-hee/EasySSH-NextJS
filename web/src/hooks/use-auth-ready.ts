"use client"

import { useSystemConfig } from "@/contexts/system-config-context"
import { useClientAuth } from "@/components/client-auth-provider"

/**
 * 统一的认证就绪 Hook
 *
 * 仅适用于挂在 DashboardLayout（ClientAuthProvider + SystemConfigProvider）之下的页面：
 * - ready 为 true 时，说明：
 *   - 全局 /auth/status 已加载完毕（不在 isLoading 状态）
 *   - 当前会话已通过认证（authStatus.is_authenticated && isAuthenticated）
 *   - 可以安全发起业务请求
 */
export function useAuthReady() {
  const { authStatus, isLoading } = useSystemConfig()
  const { isAuthenticated } = useClientAuth()

  const ready =
    !isLoading &&
    !!authStatus &&
    authStatus.is_authenticated &&
    isAuthenticated

  return {
    ready,
    isAuthenticated,
    authStatus,
    isInitializing: isLoading,
  }
}

