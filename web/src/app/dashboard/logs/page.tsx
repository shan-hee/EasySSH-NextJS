"use client"

import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { LogsClient } from "./components/logs-client"

export default function LogsPage() {
  const t = useTranslations("logsAudit")

  return (
    <>
      <PageHeader title={t("logsPageTitle")} />
      <Suspense fallback={<div className="flex min-h-0 flex-1" />}>
        <LogsPageContent />
      </Suspense>
    </>
  )
}

function LogsPageContent() {
  const searchParams = useSearchParams()
  const action = searchParams.get("action") || undefined

  return <LogsClient defaultAction={action} />
}
