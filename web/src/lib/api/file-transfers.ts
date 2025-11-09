import { apiFetch } from "@/lib/api-client"

/**
 * 文件传输类型定义
 */
export interface FileTransfer {
  id: string
  user_id: string
  server_id: string
  session_id?: string
  transfer_type: "upload" | "download"
  source_path: string
  dest_path: string
  file_name: string
  file_size: number
  status: "pending" | "transferring" | "completed" | "failed"
  progress: number
  bytes_transferred: number
  started_at?: string
  completed_at?: string
  duration?: number
  speed?: number
  error_message?: string
  created_at: string
  updated_at: string
}

export interface ListFileTransfersParams {
  page?: number
  limit?: number
  status?: "pending" | "transferring" | "completed" | "failed"
  transfer_type?: "upload" | "download"
  server_id?: string
}

export interface ListFileTransfersResponse {
  data: FileTransfer[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface FileTransferStatistics {
  total_transfers: number
  completed_transfers: number
  failed_transfers: number
  total_bytes_uploaded: number
  total_bytes_downloaded: number
  by_type: {
    [key: string]: number
  }
  by_status: {
    [key: string]: number
  }
}

export interface CreateFileTransferRequest {
  server_id: string
  session_id?: string
  transfer_type: "upload" | "download"
  source_path: string
  dest_path: string
  file_name: string
  file_size: number
}

export interface UpdateFileTransferRequest {
  status?: "pending" | "transferring" | "completed" | "failed"
  progress?: number
  bytes_transferred?: number
  error_message?: string
}

/**
 * 文件传输 API 服务
 */
export const fileTransfersApi = {
  /**
   * 获取文件传输列表
   */
  async list(token: string, params?: ListFileTransfersParams): Promise<ListFileTransfersResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)
    if (params?.transfer_type) queryParams.append("transfer_type", params.transfer_type)
    if (params?.server_id) queryParams.append("server_id", params.server_id)

    const url = `/file-transfers${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<ListFileTransfersResponse>(url, { token })
  },

  /**
   * 获取文件传输详情
   */
  async getById(token: string, id: string): Promise<FileTransfer> {
    return apiFetch<FileTransfer>(`/file-transfers/${id}`, { token })
  },

  /**
   * 创建文件传输记录
   */
  async create(token: string, data: CreateFileTransferRequest): Promise<FileTransfer> {
    return apiFetch<FileTransfer>("/file-transfers", {
      method: "POST",
      token,
      body: data,
    })
  },

  /**
   * 更新文件传输记录
   */
  async update(token: string, id: string, data: UpdateFileTransferRequest): Promise<FileTransfer> {
    return apiFetch<FileTransfer>(`/file-transfers/${id}`, {
      method: "PUT",
      token,
      body: data,
    })
  },

  /**
   * 删除文件传输记录
   */
  async delete(token: string, id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/file-transfers/${id}`, {
      method: "DELETE",
      token,
    })
  },

  /**
   * 获取文件传输统计信息
   */
  async getStatistics(token: string): Promise<FileTransferStatistics> {
    return apiFetch<FileTransferStatistics>("/file-transfers/statistics", { token })
  },
}
