"use client"

import type { ReactNode } from "react"
import { useRuntimeInfo } from "./use-runtime"

export function RuntimeProvider({ children }: { children: ReactNode }) {
  useRuntimeInfo()

  return <>{children}</>
}
