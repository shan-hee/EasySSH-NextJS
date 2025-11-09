import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { getLoginLogsPageData } from "@/lib/api/audit-logs-server"
import { LoginLogsClient } from "./components/login-logs-client"
import { SkeletonCard } from "@/components/ui/loading"
import { generatePageMetadata } from "@/lib/metadata"

export const metadata: Metadata = generatePageMetadata("logsLogin")

/**
 * 登录日志内容组件（异步 Server Component）
 * 在服务端获取数据并预计算统计信息
 */
async function LoginLogsContent() {
  // 在服务端获取登录日志数据和统计信息
  const data = await getLoginLogsPageData(1, 20)

  return <LoginLogsClient initialData={data} />
}

/**
 * 登录日志 Loading 骨架屏
 */
function LoginLogsSkeleton() {
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
 * 登录日志页面（Server Component）
 * 使用 Suspense 包裹异步内容，提供 Loading 状态
 */
export default function LoginLogsPage() {
  return (
    <>
      <PageHeader title="登录日志" />
      <Suspense fallback={<LoginLogsSkeleton />}>
        <LoginLogsContent />
      </Suspense>
    </>
  )
}
