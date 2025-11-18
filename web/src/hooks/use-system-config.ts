import { useQuery } from "@tanstack/react-query"
import { settingsApi } from "@/lib/api/settings"

/**
 * 获取系统配置的 Hook
 */
export function useSystemConfig() {
  return useQuery({
    queryKey: ["systemConfig"],
    queryFn: () => settingsApi.getSystemConfig(),
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
    cacheTime: 10 * 60 * 1000, // 缓存 10 分钟
  })
}

/**
 * 获取下载排除规则的 Hook
 */
export function useDownloadExcludePatterns() {
  const { data: config } = useSystemConfig()

  if (!config) {
    // 默认排除规则
    return [
      "node_modules",
      ".git",
      ".svn",
      ".hg",
      "__pycache__",
      ".pytest_cache",
      ".next",
      ".nuxt",
      "dist",
      "build",
      "target",
      "vendor",
      ".cache",
      ".DS_Store",
      "thumbs.db",
    ]
  }

  // 从配置中解析排除规则
  return config.download_exclude_patterns
    .split("\n")
    .map(p => p.trim())
    .filter(p => p.length > 0)
}

/**
 * 获取默认下载模式的 Hook
 */
export function useDefaultDownloadMode() {
  const { data: config } = useSystemConfig()
  return config?.default_download_mode || "fast"
}
