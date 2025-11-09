import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { getAuditLogsPageData } from "@/lib/api/audit-logs-server"
import { AuditLogsClient } from "./components/audit-logs-client"
import { SkeletonCard } from "@/components/ui/loading"
import { generatePageMetadata } from "@/lib/metadata"

export const metadata: Metadata = generatePageMetadata("logs")

/**
 * 操作日志内容组件（异步 Server Component）
 * 在服务端获取数据和统计信息
 */
async function AuditLogsContent() {
  // 在服务端获取操作日志数据和统计信息
  const data = await getAuditLogsPageData(1, 20)

  return <AuditLogsClient initialData={data} />
}

/**
 * 操作日志 Loading 骨架屏
 */
function AuditLogsSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-4">
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
      </div>
      <SkeletonCard showHeader lines={8} className="flex-1" />
    </div>
  )
}

/**
 * 操作日志页面（Server Component）
 * 使用 Suspense 包裹异步内容，提供 Loading 状态
 */
export default function AuditLogsPage() {
  return (
    <>
      <PageHeader title="操作日志" />
      <Suspense fallback={<AuditLogsSkeleton />}>
        <AuditLogsContent />
      </Suspense>
    </>
  )
}
