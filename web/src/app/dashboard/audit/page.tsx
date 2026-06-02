"use client"

import { PageHeader } from "@/components/page-header"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { AuditLogsClient } from "../logs/components/audit-logs-client"

export default function SecurityAuditPage() {
  const t = useTranslations("logsAudit")
  const searchParams = useSearchParams()
  const action = searchParams.get("action") || undefined

  return (
    <>
      <PageHeader title={t("auditPageTitle")} />
      <AuditLogsClient scope="audit" defaultAction={action} />
    </>
  )
}
