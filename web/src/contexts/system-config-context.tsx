"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { SystemConfig } from "@/lib/api/settings"
import { authApi } from "@/lib/api/auth"

/**
 * 系统配置 Context
 * 提供全局系统配置信息,如系统名称、Logo、语言等
 */

interface SystemConfigContextType {
  config: SystemConfig | null
  isLoading: boolean
  error: Error | null
  refreshConfig: () => Promise<void>
}

const SystemConfigContext = createContext<SystemConfigContextType | undefined>(undefined)

interface SystemConfigProviderProps {
  children: ReactNode
}

// 默认系统配置（用于未能从后端获取配置时的兜底）
const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  system_name: "EasySSH",
  system_logo: "/logo.svg",
  system_favicon: "/favicon.ico",
  default_language: "zh-CN",
  default_timezone: "Asia/Shanghai",
  date_format: "YYYY-MM-DD HH:mm:ss",
  default_page_size: 20,
  max_file_upload_size: 100,
  download_exclude_patterns: "node_modules,.git,.cache",
  default_download_mode: "fast",
  skip_excluded_on_upload: true,
  completion_enabled: true,
  completion_providers: {
    local: true,
    remote_history: true,
    script: true,
    session: true,
  },
  completion_quotas: {
    local_min: 1,
    local_max: 3,
    script_min: 0,
    script_max: 2,
    session_min: 0,
    session_max: 2,
    remote_history_unlimited: true,
    remote_history_soft_max: 7,
  },
  completion_cache: {
    ttl_minutes: 5,
    max_entries: 100,
  },
}

/**
 * 系统配置提供者组件
 * 在应用启动时自动加载系统配置并提供给所有子组件
 */
export function SystemConfigProvider({ children }: SystemConfigProviderProps) {
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadConfig = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // 仅通过 /auth/status 获取系统配置（开发版约定始终返回 system_config）
      const status = await authApi.checkStatus()

      if (!status.system_config) {
        // 按当前开发版约定，system_config 应始终存在
        throw new Error("system_config is missing in /auth/status response")
      }

      setConfig(status.system_config)
    } catch (err) {
      console.error("Failed to load system config:", err)
      setError(err instanceof Error ? err : new Error("Unknown error"))

      // 请求失败时，使用本地默认配置兜底
      setConfig(DEFAULT_SYSTEM_CONFIG)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshConfig = async () => {
    await loadConfig()
  }

  useEffect(() => {
    loadConfig()
  }, [])

  return (
    <SystemConfigContext.Provider value={{ config, isLoading, error, refreshConfig }}>
      {children}
    </SystemConfigContext.Provider>
  )
}

/**
 * 使用系统配置的 Hook
 * @returns 系统配置上下文
 * @throws 如果在 SystemConfigProvider 外部使用
 */
export function useSystemConfig() {
  const context = useContext(SystemConfigContext)
  if (context === undefined) {
    throw new Error("useSystemConfig must be used within a SystemConfigProvider")
  }
  return context
}
