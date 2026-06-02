"use client"

import { PageHeader } from "@/components/page-header"
import { useTranslations } from "next-intl"
import { AuditLogsClient } from "../logs/components/audit-logs-client"

export default function ActivityLogsPage() {
  const t = useTranslations("logsAudit")
  return (
    <>
      <PageHeader title={t("activityPageTitle")} />
      <AuditLogsClient scope="activity" />
    </>
  )
}
