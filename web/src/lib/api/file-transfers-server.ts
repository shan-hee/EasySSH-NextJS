import { serverApiFetch } from "@/lib/server-api"
import type {
  ListFileTransfersResponse,
  FileTransferStatistics,
  ListFileTransfersParams,
} from "./file-transfers"

/**
 * 获取文件传输列表（服务端）
 */
export async function getFileTransfersList(
  params?: ListFileTransfersParams
): Promise<ListFileTransfersResponse> {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append("page", params.page.toString())
  if (params?.limit) queryParams.append("limit", params.limit.toString())
  if (params?.status) queryParams.append("status", params.status)
  if (params?.transfer_type) queryParams.append("transfer_type", params.transfer_type)
  if (params?.server_id) queryParams.append("server_id", params.server_id)

  const url = `/file-transfers${queryParams.toString() ? `?${queryParams}` : ""}`
  return serverApiFetch<ListFileTransfersResponse>(url)
}

/**
 * 获取文件传输统计信息（服务端）
 */
export async function getFileTransfersStatistics(): Promise<FileTransferStatistics> {
  return serverApiFetch<FileTransferStatistics>("/file-transfers/statistics")
}

/**
 * 获取文件传输页面初始数据
 * 并行加载传输列表和统计信息
 */
export async function getFileTransfersPageData(page = 1, pageSize = 20) {
  const [transfersResponse, statistics] = await Promise.all([
    getFileTransfersList({ page, limit: pageSize }),
    getFileTransfersStatistics(),
  ])

  return {
    transfers: transfersResponse.data || [],
    totalPages: transfersResponse.total_pages || 1,
    totalCount: transfersResponse.total || 0,
    currentPage: transfersResponse.page || 1,
    pageSize: transfersResponse.page_size || pageSize,
    statistics,
  }
}

export type FileTransfersPageData = Awaited<ReturnType<typeof getFileTransfersPageData>>
