"use client"

import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/page-header"
import { SessionsClient } from "./components/sessions-client"

/**
 * 服务器历史连接页面（纯 CSR 模式）
 * 数据在客户端获取
 */
export default function ServersHistoryPage() {
  const t = useTranslations("connectionHistory")
  return (
    <>
      <PageHeader title={t("pageTitle")} />
      <SessionsClient />
    </>
  )
}
