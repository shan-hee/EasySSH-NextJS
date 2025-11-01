const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"

// 文件传输类型定义
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

    const url = `${API_BASE_URL}/file-transfers${queryParams.toString() ? `?${queryParams}` : ""}`
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch file transfers")
    }

    return response.json()
  },

  /**
   * 获取文件传输详情
   */
  async getById(token: string, id: string): Promise<{ data: FileTransfer }> {
    const response = await fetch(`${API_BASE_URL}/file-transfers/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch file transfer")
    }

    return response.json()
  },

  /**
   * 创建文件传输记录
   */
  async create(token: string, data: CreateFileTransferRequest): Promise<{ data: FileTransfer }> {
    const response = await fetch(`${API_BASE_URL}/file-transfers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to create file transfer")
    }

    return response.json()
  },

  /**
   * 更新文件传输记录
   */
  async update(token: string, id: string, data: UpdateFileTransferRequest): Promise<{ data: FileTransfer }> {
    const response = await fetch(`${API_BASE_URL}/file-transfers/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to update file transfer")
    }

    return response.json()
  },

  /**
   * 删除文件传输记录
   */
  async delete(token: string, id: string): Promise<{ data: { message: string } }> {
    const response = await fetch(`${API_BASE_URL}/file-transfers/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to delete file transfer")
    }

    return response.json()
  },

  /**
   * 获取文件传输统计信息
   */
  async getStatistics(token: string): Promise<{ data: FileTransferStatistics }> {
    const response = await fetch(`${API_BASE_URL}/file-transfers/statistics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch file transfer statistics")
    }

    return response.json()
  },
}
