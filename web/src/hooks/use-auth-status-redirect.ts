"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSystemConfig } from "@/contexts/system-config-context"

type EntryPage = "home" | "login"

interface UseAuthStatusRedirectResult {
  isChecking: boolean
}

/**
 * 统一处理入口页的认证/初始化状态检查与跳转逻辑
 *
 * - home: 根据状态跳转到 /setup /dashboard /login
 * - login: 已初始化且未登录时才停留在当前页,其他情况跳转
 */
export function useAuthStatusRedirect(page: EntryPage): UseAuthStatusRedirectResult {
  const router = useRouter()
  const { authStatus, isLoading } = useSystemConfig()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // 等待系统配置 / 认证状态加载完成
    if (isLoading) {
      setIsChecking(true)
      return
    }

    // 如果加载失败（authStatus 为空），按“未认证且已初始化失败未知”处理
    if (!authStatus) {
      if (page === "home") {
        router.replace("/login")
      } else {
        setIsChecking(false)
      }
      return
    }

    const status = authStatus

    // 需要初始化 → 统一跳转到 /setup
    if (status.need_init) {
      router.replace("/setup")
      return
    }

    // 已认证 → 统一跳转到 /dashboard
    if (status.is_authenticated) {
      router.replace("/dashboard")
      return
    }

    // 未认证
    if (page === "home") {
      router.replace("/login")
    } else {
      setIsChecking(false)
    }
  }, [authStatus, isLoading, page, router])

  return { isChecking }
}
