"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api/auth'

export default function Home() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkStatusAndRedirect = async () => {
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
        // 未认证 → /login
        else {
          router.replace('/login')
        }
      } catch (error) {
        console.error('Failed to check status:', error)
        // 出错时默认跳转到登录页
        router.replace('/login')
      } finally {
        setIsChecking(false)
      }
    }

    checkStatusAndRedirect()
  }, [router])

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

  return null
}
