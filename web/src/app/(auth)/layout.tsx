"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import LightRays from "@/components/LightRays"
import { AuthI18nProvider } from "@/providers/auth-i18n-provider"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 等待客户端挂载，避免 hydration 不匹配
  useEffect(() => {
    setMounted(true)
  }, [])

  // 根据主题选择光线颜色和参数
  const isLightTheme = mounted && resolvedTheme === "light"
  const raysColor = isLightTheme ? "#3b82f6" : "#ffffff"
  const raysOpacity = isLightTheme ? "opacity-30" : "opacity-60"

  return (
    <AuthI18nProvider>
      <div className="relative bg-zinc-50 dark:bg-zinc-950 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
        {/* 光线背景 - 始终保持不变 */}
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

        {/* 表单内容区域 */}
        <div className="relative z-10 w-full max-w-sm">
          {children}
        </div>
      </div>
    </AuthI18nProvider>
  )
}
