import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { getFileTransfersPageData } from "@/lib/api/file-transfers-server"
import { TransfersClient } from "./components/transfers-client"
import { SkeletonCard } from "@/components/ui/loading"
import { generatePageMetadata } from "@/lib/metadata"

export const metadata: Metadata = generatePageMetadata("transfersHistory")

/**
 * 传输记录内容组件（异步 Server Component）
 * 在服务端获取数据并渲染
 */
async function TransfersHistoryContent() {
  // 在服务端获取传输记录数据
  const data = await getFileTransfersPageData(1, 20)

  return <TransfersClient initialData={data} />
}

/**
 * 传输记录 Loading 骨架屏
 */
function TransfersHistorySkeleton() {
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
 * 传输记录页面（Server Component）
 * 使用 Suspense 包裹异步内容，提供 Loading 状态
 */
export default function TransfersHistoryPage() {
  return (
    <>
      <PageHeader title="传输记录" />
      <Suspense fallback={<TransfersHistorySkeleton />}>
        <TransfersHistoryContent />
      </Suspense>
    </>
  )
}
