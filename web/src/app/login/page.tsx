"use client"

import { LoginForm } from "@/components/login-form"
import LightRays from "@/components/LightRays"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/api/auth"

export default function LoginPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  // 检查认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const status = await authApi.checkStatus()

        // 需要初始化 → /setup
        if (status.need_init) {
          router.replace('/setup')
        }
        // 已认证 → /dashboard
        else if (status.is_authenticated) {
          router.replace('/dashboard')
        }
        // 未认证 → 显示登录页
        else {
          setIsChecking(false)
        }
      } catch (error) {
        console.error('Failed to check status:', error)
        // 出错时显示登录页
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [router])

  // 等待客户端挂载，避免 hydration 不匹配
  useEffect(() => {
    setMounted(true)
  }, [])

  // 显示加载状态
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在加载...</p>
        </div>
      </div>
    )
  }

  // 根据主题选择光线颜色和参数
  const isLightTheme = mounted && resolvedTheme === "light"
  const raysColor = isLightTheme ? "#3b82f6" : "#ffffff" // 浅色主题使用蓝色，深色主题使用白色
  const raysOpacity = isLightTheme ? "opacity-30" : "opacity-60" // 浅色主题降低透明度

  return (
    <div className="relative bg-zinc-50 dark:bg-zinc-950 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
      {/* 光线背景 */}
      <div className="absolute inset-0 z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor={raysColor}
          raysSpeed={1}
          lightSpread={0.3}
          rayLength={3}
          fadeDistance={2}
          saturation={1}
          followMouse={true}
          mouseInfluence={0.1}
          noiseAmount={0}
          distortion={0}
          pulsating={false}
          className={raysOpacity}
        />
      </div>

      {/* 登录表单 */}
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
