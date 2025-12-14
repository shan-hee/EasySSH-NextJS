import { useQuery } from "@tanstack/react-query"
import { aiApi, AIConfigStatus } from "@/lib/api/ai"

/**
 * AI 配置状态 Hook
 * 用于检查 AI 服务是否已配置可用
 */
export function useAIConfig() {
  const query = useQuery({
    queryKey: ["aiConfig"],
    queryFn: () => aiApi.getConfig(),
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
    gcTime: 10 * 60 * 1000, // 缓存 10 分钟
    retry: 1, // 失败后只重试一次
  })

  return {
    ...query,
    /** AI 是否已配置可用 */
    isConfigured: query.data?.configured ?? false,
    /** AI 提供商 */
    provider: query.data?.provider,
    /** AI 模型 */
    model: query.data?.model,
    /** 是否设置了 API Key */
    hasKey: query.data?.has_key ?? false,
  }
}

export type { AIConfigStatus }
