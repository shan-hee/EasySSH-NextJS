"use client"

import { PageHeader } from "@/components/page-header"
import { LoginLogsClient } from "./components/login-logs-client"
import { useTranslations } from "next-intl"

/**
 * 登录日志页面（纯 CSR 模式）
 * 数据在客户端获取
 */
export default function LoginLogsPage() {
  const t = useTranslations("logsLogin")
  return (
    <>
      <PageHeader title={t("pageTitle")} />
      <LoginLogsClient />
    </>
  )
}
