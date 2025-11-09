"use server"

import { revalidatePath } from "next/cache"
import { serverApiFetch } from "@/lib/server-api"

/**
 * 删除文件传输记录（Server Action）
 * 在服务端执行删除操作，自动重新验证缓存
 */
export async function deleteFileTransfer(transferId: string) {
  try {
    await serverApiFetch(`/file-transfers/${transferId}`, {
      method: "DELETE",
    })

    // 自动重新验证传输记录页面
    revalidatePath("/dashboard/transfers/history")

    return { success: true }
  } catch (error) {
    console.error("Failed to delete file transfer:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    }
  }
}

/**
 * 批量删除文件传输记录（Server Action）
 */
export async function deleteFileTransfers(transferIds: string[]) {
  try {
    // 并行删除所有记录
    const results = await Promise.allSettled(
      transferIds.map((id) =>
        serverApiFetch(`/file-transfers/${id}`, {
          method: "DELETE",
        })
      )
    )

    // 统计成功和失败的数量
    const successCount = results.filter((r) => r.status === "fulfilled").length
    const failedCount = results.filter((r) => r.status === "rejected").length

    // 自动重新验证传输记录页面
    revalidatePath("/dashboard/transfers/history")

    return {
      success: failedCount === 0,
      successCount,
      failedCount,
      message:
        failedCount === 0
          ? `成功删除 ${successCount} 条记录`
          : `成功删除 ${successCount} 条，失败 ${failedCount} 条`,
    }
  } catch (error) {
    console.error("Failed to delete file transfers:", error)
    return {
      success: false,
      successCount: 0,
      failedCount: transferIds.length,
      error: error instanceof Error ? error.message : "批量删除失败",
    }
  }
}
