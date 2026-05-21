"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { RegisterForm } from "@/components/register-form"
import { getDefaultDashboardPath } from "@/shell/routes"
import { isDesktopRuntime, useRuntimeInfo } from "@/shell/runtime"

export default function RegisterPage() {
  const router = useRouter()
  const { data: runtime, isLoading } = useRuntimeInfo()
  const isDesktop = isDesktopRuntime(runtime)

  useEffect(() => {
    if (isDesktop) {
      router.replace(getDefaultDashboardPath(runtime))
    }
  }, [isDesktop, router, runtime])

  if (isLoading || isDesktop) {
    return null
  }

  return <RegisterForm />
}
