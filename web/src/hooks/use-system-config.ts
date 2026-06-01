import { useQuery } from "@tanstack/react-query"
import { settingsApi } from "@/lib/api/settings"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { parseWorkspaceDownloadExcludePatterns } from "@/lib/session/workspace-settings"

/**
 * 获取系统配置的 Hook
 */
export function useSystemConfig() {
  const { ready } = useAuthReady()

  return useQuery({
    queryKey: ["systemConfig"],
    queryFn: () => settingsApi.getSystemConfig(),
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
    gcTime: 10 * 60 * 1000, // 缓存 10 分钟 (v5 使用 gcTime 替代 cacheTime)
    // 只有认证准备好后才发起请求
    enabled: ready,
  })
}

/**
 * 获取下载排除规则的 Hook
 */
export function useDownloadExcludePatterns() {
  const { data: config } = useSystemConfig()

  if (!config) {
    return parseWorkspaceDownloadExcludePatterns(null)
  }

  return parseWorkspaceDownloadExcludePatterns(config.download_exclude_patterns)
}
