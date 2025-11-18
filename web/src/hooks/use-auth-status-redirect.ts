"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/api/auth"

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
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    const checkStatusAndRedirect = async () => {
      try {
        const status = await authApi.checkStatus()
        if (cancelled) return

        // 需要初始化 → 统一跳转到 /setup
        if (status.need_init) {
          if (page !== "home" || typeof window === "undefined") {
            router.replace("/setup")
          } else {
            router.replace("/setup")
          }
          return
        }

        // 已认证 → 统一跳转到 /dashboard
        if (status.is_authenticated) {
          router.replace("/dashboard")
          return
        }

        // 未认证
        if (page === "home") {
          // 首页: 未登录则跳到登录页
          router.replace("/login")
        } else {
          // 登录页: 未登录且已完成初始化,停留在本页展示登录表单
          setIsChecking(false)
        }
      } catch (error) {
        console.error("Failed to check auth status:", error)

        // 出错时:
        // - 首页: 默认跳到登录页
        // - 登录页: 停留并展示登录表单,让用户可以尝试登录
        if (page === "home") {
          router.replace("/login")
        } else {
          setIsChecking(false)
        }
      } finally {
        if (!cancelled && page === "home") {
          setIsChecking(false)
        }
      }
    }

    checkStatusAndRedirect()

    return () => {
      cancelled = true
    }
  }, [page, router])

  return { isChecking }
}

