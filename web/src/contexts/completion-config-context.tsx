"use client"

import React, { createContext, useContext, useMemo, ReactNode } from "react"
import type { CompletionConfig, SourceQuotaConfig } from "@/lib/completion/types"
import { DEFAULT_COMPLETION_CONFIG, DEFAULT_SOURCE_QUOTAS } from "@/lib/completion/types"
import { useSystemConfig } from "./system-config-context"

/**
 * 全局补全配置接口
 */
interface GlobalCompletionConfig {
  enabled: boolean
  providers: {
    local: boolean
    remote_history: boolean
    script: boolean
    session: boolean
  }
  quotas: {
    local_min: number
    local_max: number
    script_min: number
    script_max: number
    session_min: number
    session_max: number
    remote_history_unlimited: boolean
    remote_history_soft_max: number
  }
  cache: {
    ttl_minutes: number
    max_entries: number
  }
}

/**
 * 补全配置 Context 类型
 */
interface CompletionConfigContextType {
  globalConfig: GlobalCompletionConfig
  completionConfig: CompletionConfig
}

const CompletionConfigContext = createContext<CompletionConfigContextType | undefined>(undefined)

/**
 * 默认全局配置
 */
const DEFAULT_GLOBAL_CONFIG: GlobalCompletionConfig = {
  enabled: true,
  providers: {
    local: true,
    remote_history: true,
    script: true,
    session: true,
  },
  quotas: {
    local_min: 1,
    local_max: 3,
    script_min: 0,
    script_max: 2,
    session_min: 0,
    session_max: 2,
    remote_history_unlimited: true,
    remote_history_soft_max: 7,
  },
  cache: {
    ttl_minutes: 5,
    max_entries: 100,
  },
}

/**
 * 补全配置 Provider
 * 从系统配置中读取补全相关配置
 */
export function CompletionConfigProvider({ children }: { children: ReactNode }) {
  const { config: systemConfig } = useSystemConfig()

  /**
   * 从系统配置构建全局补全配置
   */
  const globalConfig = useMemo<GlobalCompletionConfig>(() => {
    if (!systemConfig) {
      return DEFAULT_GLOBAL_CONFIG
    }

    return {
      enabled: systemConfig.completion_enabled ?? DEFAULT_GLOBAL_CONFIG.enabled,
      providers: systemConfig.completion_providers ?? DEFAULT_GLOBAL_CONFIG.providers,
      quotas: systemConfig.completion_quotas ?? DEFAULT_GLOBAL_CONFIG.quotas,
      cache: systemConfig.completion_cache ?? DEFAULT_GLOBAL_CONFIG.cache,
    }
  }, [systemConfig])

  /**
   * 将全局配置转换为 CompletionEngine 所需的配置格式
   */
  const completionConfig = useMemo((): CompletionConfig => {
    // 构建配额配置
    const sourceQuotas: SourceQuotaConfig[] = []

    if (globalConfig.providers.local) {
      sourceQuotas.push({
        providerName: "local",
        min: globalConfig.quotas.local_min,
        max: globalConfig.quotas.local_max,
      })
    }

    if (globalConfig.providers.script) {
      sourceQuotas.push({
        providerName: "script",
        min: globalConfig.quotas.script_min,
        max: globalConfig.quotas.script_max,
      })
    }

    if (globalConfig.providers.session) {
      sourceQuotas.push({
        providerName: "session",
        min: globalConfig.quotas.session_min,
        max: globalConfig.quotas.session_max,
      })
    }

    if (globalConfig.providers.remote_history) {
      sourceQuotas.push({
        providerName: "remote-history",
        min: 0,
        max: globalConfig.quotas.remote_history_unlimited ? Infinity : globalConfig.quotas.remote_history_soft_max,
        unlimited: globalConfig.quotas.remote_history_unlimited,
        softMax: globalConfig.quotas.remote_history_soft_max,
      })
    }

    return {
      ...DEFAULT_COMPLETION_CONFIG,
      enabled: globalConfig.enabled,
      providers: {
        local: globalConfig.providers.local,
        remote: globalConfig.providers.remote_history,
        history: globalConfig.providers.session,
        script: globalConfig.providers.script,
        session: globalConfig.providers.session,
      },
      enableQuotaAllocation: true,
      sourceQuotas: sourceQuotas.length > 0 ? sourceQuotas : DEFAULT_SOURCE_QUOTAS,
      cache: globalConfig.cache,
    }
  }, [globalConfig])

  return (
    <CompletionConfigContext.Provider
      value={{
        globalConfig,
        completionConfig,
      }}
    >
      {children}
    </CompletionConfigContext.Provider>
  )
}

/**
 * 使用补全配置的 Hook
 */
export function useCompletionConfig() {
  const context = useContext(CompletionConfigContext)
  if (context === undefined) {
    throw new Error("useCompletionConfig must be used within a CompletionConfigProvider")
  }
  return context
}
