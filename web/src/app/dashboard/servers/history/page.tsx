import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { getSSHSessionsPageData } from "@/lib/api/ssh-sessions-server"
import { SessionsClient } from "./components/sessions-client"
import { SkeletonCard } from "@/components/ui/loading"
import { generatePageMetadata } from "@/lib/metadata"

export const metadata: Metadata = generatePageMetadata("serversHistory")

/**
 * 服务器历史连接内容组件（异步 Server Component）
 * 在服务端获取数据并渲染
 */
async function ServersHistoryContent() {
  // 在服务端获取会话历史数据
  const data = await getSSHSessionsPageData(1, 20)

  return <SessionsClient initialData={data} />
}

/**
 * 服务器历史连接 Loading 骨架屏
 */
function ServersHistorySkeleton() {
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
 * 服务器历史连接页面（Server Component）
 * 使用 Suspense 包裹异步内容，提供 Loading 状态
 */
export default function ServersHistoryPage() {
  return (
    <>
      <PageHeader title="历史连接" />
      <Suspense fallback={<ServersHistorySkeleton />}>
        <ServersHistoryContent />
      </Suspense>
    </>
  )
}
