import { useQuery } from "@tanstack/react-query"
import { getAIConfig, AIConfigStatus } from "@/lib/api/ai-config"
import { useAuthReady } from "@/hooks/use-auth-ready"

/**
 * AI 配置状态 Hook - 检查 AI 服务是否已配置可用
 */
export function useAIConfig() {
  const { ready } = useAuthReady()

  const query = useQuery({
    queryKey: ["aiConfig"],
    queryFn: getAIConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    // 只有认证准备好后才发起请求
    enabled: ready,
  })

  return {
    ...query,
    isConfigured: query.data?.configured ?? false,
    provider: query.data?.provider,
    model: query.data?.model,
    models: query.data?.models ?? [],
    hasKey: query.data?.has_key ?? false,
  }
}

export type { AIConfigStatus }
