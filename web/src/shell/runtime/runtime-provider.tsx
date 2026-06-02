"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useRuntimeInfo } from "@/shell/runtime/use-runtime-info"
import type { RuntimeInfo } from "@/shell/runtime/types"

interface RuntimeContextValue {
  runtime: RuntimeInfo | null
  isLoading: boolean
  error: Error | null
  refreshRuntime: () => Promise<unknown>
}

const RuntimeContext = createContext<RuntimeContextValue | undefined>(undefined)

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const query = useRuntimeInfo()

  return (
    <RuntimeContext.Provider
      value={{
        runtime: query.data ?? null,
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error : null,
        refreshRuntime: query.refetch,
      }}
    >
      {children}
    </RuntimeContext.Provider>
  )
}

export function useRuntime() {
  const context = useContext(RuntimeContext)
  if (!context) {
    throw new Error("useRuntime must be used within RuntimeProvider")
  }

  return context
}
