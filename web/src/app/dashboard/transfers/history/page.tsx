"use client"

import { PageHeader } from "@/components/page-header"
import { TransfersClient } from "./components/transfers-client"

/**
 * 传输记录页面（纯 CSR 模式）
 * 数据在客户端获取
 */
export default function TransfersHistoryPage() {
  return (
    <>
      <PageHeader title="传输记录" />
      <TransfersClient />
    </>
  )
}
