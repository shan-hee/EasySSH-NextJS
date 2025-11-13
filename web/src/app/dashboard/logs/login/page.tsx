"use client"

import { PageHeader } from "@/components/page-header"
import { LoginLogsClient } from "./components/login-logs-client"

/**
 * 登录日志页面（纯 CSR 模式）
 * 数据在客户端获取
 */
export default function LoginLogsPage() {
  return (
    <>
      <PageHeader title="登录日志" />
      <LoginLogsClient />
    </>
  )
}
