"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { settingsApi, type SystemConfig } from "@/lib/api/settings"

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

      const systemConfig = await settingsApi.getSystemConfig()
      setConfig(systemConfig)
    } catch (err) {
      console.error("Failed to load system config:", err)
      setError(err instanceof Error ? err : new Error("Unknown error"))

      // 发生错误时使用默认配置
      setConfig({
        system_name: "EasySSH",
        system_logo: "/logo.svg",
        system_favicon: "/favicon.ico",
        default_language: "zh-CN",
        default_timezone: "Asia/Shanghai",
        date_format: "YYYY-MM-DD HH:mm:ss",
        default_page_size: 20,
        max_file_upload_size: 100,
      })
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
