"use server"

import { revalidatePath } from "next/cache"
import { serverApiFetch } from "@/lib/server-api"

/**
 * 删除审计日志记录（Server Action）
 * 在服务端执行删除操作，自动重新验证缓存
 */
export async function deleteAuditLog(logId: string) {
  try {
    await serverApiFetch(`/audit-logs/${logId}`, {
      method: "DELETE",
    })

    // 自动重新验证审计日志页面
    revalidatePath("/dashboard/logs")
    revalidatePath("/dashboard/logs/login")

    return { success: true }
  } catch (error) {
    console.error("Failed to delete audit log:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    }
  }
}

/**
 * 批量删除审计日志记录（Server Action）
 */
export async function deleteAuditLogs(logIds: string[]) {
  try {
    // 并行删除所有记录
    const results = await Promise.allSettled(
      logIds.map((id) =>
        serverApiFetch(`/audit-logs/${id}`, {
          method: "DELETE",
        })
      )
    )

    // 统计成功和失败的数量
    const successCount = results.filter((r) => r.status === "fulfilled").length
    const failedCount = results.filter((r) => r.status === "rejected").length

    // 自动重新验证审计日志页面
    revalidatePath("/dashboard/logs")
    revalidatePath("/dashboard/logs/login")

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
    console.error("Failed to delete audit logs:", error)
    return {
      success: false,
      successCount: 0,
      failedCount: logIds.length,
      error: error instanceof Error ? error.message : "批量删除失败",
    }
  }
}

/**
 * 清理旧的审计日志（Server Action）
 * 删除指定天数之前的日志
 */
export async function cleanupOldAuditLogs(daysToKeep: number) {
  try {
    const result = await serverApiFetch<{ deleted_count: number }>("/audit-logs/cleanup", {
      method: "POST",
      body: { days_to_keep: daysToKeep },
    })

    // 自动重新验证审计日志页面
    revalidatePath("/dashboard/logs")
    revalidatePath("/dashboard/logs/login")

    return {
      success: true,
      deletedCount: result.deleted_count,
      message: `成功清理 ${result.deleted_count} 条旧日志`,
    }
  } catch (error) {
    console.error("Failed to cleanup old audit logs:", error)
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "清理失败",
    }
  }
}
