"use client"

import { PageHeader } from "@/components/page-header"
import { AuditLogsClient } from "./components/audit-logs-client"
import { useTranslations } from "next-intl"

/**
 * 操作日志页面（纯 CSR 模式）
 * 数据在客户端获取
 */
export default function AuditLogsPage() {
  const t = useTranslations("logsAudit")
  return (
    <>
      <PageHeader title={t("pageTitle")} />
      <AuditLogsClient />
    </>
  )
}
