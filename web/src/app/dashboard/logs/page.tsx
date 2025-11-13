"use client"

import { PageHeader } from "@/components/page-header"
import { AuditLogsClient } from "./components/audit-logs-client"

/**
 * 操作日志页面（纯 CSR 模式）
 * 数据在客户端获取
 */
export default function AuditLogsPage() {
  return (
    <>
      <PageHeader title="操作日志" />
      <AuditLogsClient />
    </>
  )
}
