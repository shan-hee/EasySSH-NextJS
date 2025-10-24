const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"

// 批量任务类型定义
export interface BatchTask {
  id: string
  user_id: string
  task_name: string
  task_type: "command" | "script" | "file"
  content: string
  script_id?: string
  server_ids: string[]
  execution_mode: "parallel" | "sequential"
  status: "pending" | "running" | "completed" | "failed"
  success_count: number
  failed_count: number
  started_at?: string
  completed_at?: string
  duration?: number
  created_at: string
  updated_at: string
}

export interface CreateBatchTaskRequest {
  task_name: string
  task_type: "command" | "script" | "file"
  content?: string
  script_id?: string
  server_ids: string[]
  execution_mode?: "parallel" | "sequential"
}

export interface UpdateBatchTaskRequest {
  task_name?: string
  content?: string
  server_ids?: string[]
  execution_mode?: "parallel" | "sequential"
}

export interface ListBatchTasksParams {
  page?: number
  limit?: number
  status?: "pending" | "running" | "completed" | "failed"
  task_type?: "command" | "script" | "file"
}

export interface ListBatchTasksResponse {
  data: BatchTask[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface BatchTaskStatistics {
  total_tasks: number
  pending_tasks: number
  running_tasks: number
  completed_tasks: number
  failed_tasks: number
  by_type: {
    [key: string]: number
  }
}

export const batchTasksApi = {
  /**
   * 获取批量任务列表
   */
  async list(token: string, params?: ListBatchTasksParams): Promise<ListBatchTasksResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)
    if (params?.task_type) queryParams.append("task_type", params.task_type)

    const url = `${API_BASE_URL}/batch-tasks${queryParams.toString() ? `?${queryParams}` : ""}`
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch batch tasks")
    }

    return response.json()
  },

  /**
   * 创建批量任务
   */
  async create(token: string, data: CreateBatchTaskRequest): Promise<{ data: BatchTask }> {
    const response = await fetch(`${API_BASE_URL}/batch-tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to create batch task")
    }

    return response.json()
  },

  /**
   * 获取批量任务详情
   */
  async getById(token: string, id: string): Promise<{ data: BatchTask }> {
    const response = await fetch(`${API_BASE_URL}/batch-tasks/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch batch task")
    }

    return response.json()
  },

  /**
   * 更新批量任务
   */
  async update(
    token: string,
    id: string,
    data: UpdateBatchTaskRequest
  ): Promise<{ data: BatchTask }> {
    const response = await fetch(`${API_BASE_URL}/batch-tasks/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to update batch task")
    }

    return response.json()
  },

  /**
   * 删除批量任务
   */
  async delete(token: string, id: string): Promise<{ data: { message: string } }> {
    const response = await fetch(`${API_BASE_URL}/batch-tasks/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to delete batch task")
    }

    return response.json()
  },

  /**
   * 获取批量任务统计信息
   */
  async getStatistics(token: string): Promise<{ data: BatchTaskStatistics }> {
    const response = await fetch(`${API_BASE_URL}/batch-tasks/statistics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch batch task statistics")
    }

    return response.json()
  },

  /**
   * 启动批量任务
   */
  async start(token: string, id: string): Promise<{ data: { message: string } }> {
    const response = await fetch(`${API_BASE_URL}/batch-tasks/${id}/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to start batch task")
    }

    return response.json()
  },
}
