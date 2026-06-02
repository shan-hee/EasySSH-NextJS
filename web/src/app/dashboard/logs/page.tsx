"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useClientAuth } from "@/components/client-auth-provider"

export default function LegacyLogsPage() {
  const router = useRouter()
  const { user } = useClientAuth()

  React.useEffect(() => {
    if (!user) {
      return
    }
    router.replace(user?.role === "admin" ? "/dashboard/audit" : "/dashboard/activity")
  }, [router, user])

  return null
}
