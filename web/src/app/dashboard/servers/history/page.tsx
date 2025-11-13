"use client"

import { PageHeader } from "@/components/page-header"
import { SessionsClient } from "./components/sessions-client"

/**
 * 服务器历史连接页面（纯 CSR 模式）
 * 数据在客户端获取
 */
export default function ServersHistoryPage() {
  return (
    <>
      <PageHeader title="连接历史" />
      <SessionsClient />
    </>
  )
}
