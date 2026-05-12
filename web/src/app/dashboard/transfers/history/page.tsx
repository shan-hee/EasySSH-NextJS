"use client"

import { PageHeader } from "@/components/page-header"
import { TransfersClient } from "./components/transfers-client"
import { useTranslations } from "next-intl"

/**
 * 传输任务页面（纯 CSR 模式）
 * 数据在客户端获取
 */
export default function TransfersHistoryPage() {
  const t = useTranslations("transfers")

  return (
    <>
      <PageHeader title={t("pageTitle")} />
      <TransfersClient />
    </>
  )
}
