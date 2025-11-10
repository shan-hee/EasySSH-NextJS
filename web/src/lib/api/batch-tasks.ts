import { apiFetch } from "@/lib/api-client"

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
  async list(params?: ListBatchTasksParams): Promise<ListBatchTasksResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)
    if (params?.task_type) queryParams.append("task_type", params.task_type)

    const url = `/batch-tasks${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<ListBatchTasksResponse>(url)
  },

  /**
   * 创建批量任务
   */
  async create(data: CreateBatchTaskRequest): Promise<{ data: BatchTask }> {
    return apiFetch<{ data: BatchTask }>(`/batch-tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  /**
   * 获取批量任务详情
   */
  async getById(id: string): Promise<{ data: BatchTask }> {
    return apiFetch<{ data: BatchTask }>(`/batch-tasks/${id}`)
  },

  /**
   * 更新批量任务
   */
  async update(
    id: string,
    data: UpdateBatchTaskRequest
  ): Promise<{ data: BatchTask }> {
    return apiFetch<{ data: BatchTask }>(`/batch-tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  /**
   * 删除批量任务
   */
  async delete(id: string): Promise<{ data: { message: string } }> {
    return apiFetch<{ data: { message: string } }>(`/batch-tasks/${id}`, {
      method: "DELETE",
    })
  },

  /**
   * 获取批量任务统计信息
   */
  async getStatistics(): Promise<{ data: BatchTaskStatistics }> {
    return apiFetch<{ data: BatchTaskStatistics }>(`/batch-tasks/statistics`)
  },

  /**
   * 启动批量任务
   */
  async start(id: string): Promise<{ data: { message: string } }> {
    return apiFetch<{ data: { message: string } }>(`/batch-tasks/${id}/start`, {
      method: "POST",
    })
  },
}
