const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"

// 定时任务类型定义
export interface ScheduledTask {
  id: string
  user_id: string
  task_name: string
  task_type: "command" | "script" | "batch"
  script_id?: string
  batch_task_id?: string
  command?: string
  server_ids?: string[]
  cron_expression: string
  timezone: string
  enabled: boolean
  last_run_at?: string
  next_run_at?: string
  run_count: number
  failure_count: number
  last_status?: "success" | "failed"
  description: string
  created_at: string
  updated_at: string
}

export interface CreateScheduledTaskRequest {
  task_name: string
  task_type: "command" | "script" | "batch"
  script_id?: string
  batch_task_id?: string
  command?: string
  server_ids?: string[]
  cron_expression: string
  timezone?: string
  enabled?: boolean
  description?: string
}

export interface UpdateScheduledTaskRequest {
  task_name?: string
  command?: string
  server_ids?: string[]
  cron_expression?: string
  timezone?: string
  enabled?: boolean
  description?: string
}

export interface ListScheduledTasksParams {
  page?: number
  limit?: number
  enabled?: boolean
  task_type?: "command" | "script" | "batch"
}

export interface ListScheduledTasksResponse {
  data: ScheduledTask[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface ScheduledTaskStatistics {
  total_tasks: number
  enabled_tasks: number
  disabled_tasks: number
  total_runs: number
  by_type: {
    [key: string]: number
  }
}

export const scheduledTasksApi = {
  /**
   * 获取定时任务列表
   */
  async list(
    token: string,
    params?: ListScheduledTasksParams
  ): Promise<ListScheduledTasksResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.enabled !== undefined) queryParams.append("enabled", params.enabled.toString())
    if (params?.task_type) queryParams.append("task_type", params.task_type)

    const url = `${API_BASE_URL}/scheduled-tasks${queryParams.toString() ? `?${queryParams}` : ""}`
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch scheduled tasks")
    }

    return response.json()
  },

  /**
   * 创建定时任务
   */
  async create(
    token: string,
    data: CreateScheduledTaskRequest
  ): Promise<{ data: ScheduledTask }> {
    const response = await fetch(`${API_BASE_URL}/scheduled-tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to create scheduled task")
    }

    return response.json()
  },

  /**
   * 获取定时任务详情
   */
  async getById(token: string, id: string): Promise<{ data: ScheduledTask }> {
    const response = await fetch(`${API_BASE_URL}/scheduled-tasks/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch scheduled task")
    }

    return response.json()
  },

  /**
   * 更新定时任务
   */
  async update(
    token: string,
    id: string,
    data: UpdateScheduledTaskRequest
  ): Promise<{ data: ScheduledTask }> {
    const response = await fetch(`${API_BASE_URL}/scheduled-tasks/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to update scheduled task")
    }

    return response.json()
  },

  /**
   * 删除定时任务
   */
  async delete(token: string, id: string): Promise<{ data: { message: string } }> {
    const response = await fetch(`${API_BASE_URL}/scheduled-tasks/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to delete scheduled task")
    }

    return response.json()
  },

  /**
   * 获取定时任务统计信息
   */
  async getStatistics(token: string): Promise<{ data: ScheduledTaskStatistics }> {
    const response = await fetch(`${API_BASE_URL}/scheduled-tasks/statistics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch scheduled task statistics")
    }

    return response.json()
  },

  /**
   * 启用/禁用定时任务
   */
  async toggle(token: string, id: string, enabled: boolean): Promise<{ data: { message: string } }> {
    const response = await fetch(`${API_BASE_URL}/scheduled-tasks/${id}/toggle`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to toggle scheduled task")
    }

    return response.json()
  },

  /**
   * 手动触发定时任务
   */
  async trigger(token: string, id: string): Promise<{ data: { message: string } }> {
    const response = await fetch(`${API_BASE_URL}/scheduled-tasks/${id}/trigger`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to trigger scheduled task")
    }

    return response.json()
  },
}
