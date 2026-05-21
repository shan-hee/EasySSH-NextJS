"use client"

import { useQuery } from "@tanstack/react-query"
import { getRuntimeInfo } from "./client"

export const runtimeQueryKey = ["runtime"] as const

export function useRuntimeInfo() {
  return useQuery({
    queryKey: runtimeQueryKey,
    queryFn: getRuntimeInfo,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
}
