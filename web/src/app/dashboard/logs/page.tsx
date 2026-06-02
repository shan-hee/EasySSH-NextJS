"use client"

import { PageHeader } from "@/components/page-header"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { LogsClient } from "./components/logs-client"

export default function LogsPage() {
  const t = useTranslations("logsAudit")
  const searchParams = useSearchParams()
  const action = searchParams.get("action") || undefined

  return (
    <>
      <PageHeader title={t("logsPageTitle")} />
      <LogsClient defaultAction={action} />
    </>
  )
}
