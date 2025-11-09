"use server"

import { revalidatePath } from "next/cache"
import { serverApiFetch } from "@/lib/server-api"

/**
 * 删除 SSH 会话记录（Server Action）
 * 在服务端执行删除操作，自动重新验证缓存
 */
export async function deleteSSHSession(sessionId: string) {
  try {
    await serverApiFetch(`/ssh-sessions/${sessionId}`, {
      method: "DELETE",
    })

    // 自动重新验证服务器历史页面
    revalidatePath("/dashboard/servers/history")

    return { success: true }
  } catch (error) {
    console.error("Failed to delete SSH session:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除失败",
    }
  }
}

/**
 * 批量删除 SSH 会话记录（Server Action）
 */
export async function deleteSSHSessions(sessionIds: string[]) {
  try {
    // 并行删除所有记录
    const results = await Promise.allSettled(
      sessionIds.map((id) =>
        serverApiFetch(`/ssh-sessions/${id}`, {
          method: "DELETE",
        })
      )
    )

    // 统计成功和失败的数量
    const successCount = results.filter((r) => r.status === "fulfilled").length
    const failedCount = results.filter((r) => r.status === "rejected").length

    // 自动重新验证服务器历史页面
    revalidatePath("/dashboard/servers/history")

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
    console.error("Failed to delete SSH sessions:", error)
    return {
      success: false,
      successCount: 0,
      failedCount: sessionIds.length,
      error: error instanceof Error ? error.message : "批量删除失败",
    }
  }
}

/**
 * 终止活跃的 SSH 会话（Server Action）
 */
export async function terminateSSHSession(sessionId: string) {
  try {
    await serverApiFetch(`/ssh-sessions/${sessionId}/terminate`, {
      method: "POST",
    })

    // 自动重新验证相关页面
    revalidatePath("/dashboard/servers/history")
    revalidatePath("/dashboard/terminal/sessions")

    return { success: true }
  } catch (error) {
    console.error("Failed to terminate SSH session:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "终止会话失败",
    }
  }
}
