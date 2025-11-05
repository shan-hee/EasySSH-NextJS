"use client"

import { useEffect, useRef } from "react"
import { useSystemConfig } from "@/contexts/system-config-context"

/**
 * 动态页面头部更新组件
 * 根据系统配置动态更新页面标题和favicon
 */
export function DynamicHeadUpdater() {
  const { config } = useSystemConfig()
  const faviconLinkRef = useRef<HTMLLinkElement | null>(null)

  useEffect(() => {
    if (!config) return

    // 更新页面标题
    document.title = config.system_name

    // 更新favicon
    if (config.system_favicon) {
      // 查找或创建favicon link
      let faviconLink = faviconLinkRef.current

      if (!faviconLink) {
        // 尝试找到现有的favicon
        faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement

        if (!faviconLink) {
          // 如果不存在,创建新的
          faviconLink = document.createElement("link")
          faviconLink.rel = "icon"
          document.head.appendChild(faviconLink)
        }

        faviconLinkRef.current = faviconLink
      }

      // 更新href
      faviconLink.href = config.system_favicon

      // 根据文件扩展名设置type
      if (config.system_favicon.endsWith(".svg")) {
        faviconLink.type = "image/svg+xml"
      } else if (config.system_favicon.endsWith(".png")) {
        faviconLink.type = "image/png"
      } else if (config.system_favicon.endsWith(".ico")) {
        faviconLink.type = "image/x-icon"
      }
    }
  }, [config])

  // 清理函数
  useEffect(() => {
    return () => {
      // 组件卸载时不删除favicon,因为它应该保留
      faviconLinkRef.current = null
    }
  }, [])

  return null // 这是一个效果组件,不渲染任何内容
}
