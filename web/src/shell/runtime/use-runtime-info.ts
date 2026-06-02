import { useQuery } from "@tanstack/react-query"
import { runtimeApi } from "@/shell/runtime/api"

export const runtimeInfoQueryKey = ["runtime-info"] as const

export function useRuntimeInfo() {
  return useQuery({
    queryKey: runtimeInfoQueryKey,
    queryFn: () => runtimeApi.getRuntime(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })
}
