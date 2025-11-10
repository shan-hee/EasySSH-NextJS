import { apiFetch } from "@/lib/api-client"

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
    params?: ListScheduledTasksParams
  ): Promise<ListScheduledTasksResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.enabled !== undefined) queryParams.append("enabled", params.enabled.toString())
    if (params?.task_type) queryParams.append("task_type", params.task_type)

    const url = `/scheduled-tasks${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<ListScheduledTasksResponse>(url)
  },

  /**
   * 创建定时任务
   */
  async create(
    data: CreateScheduledTaskRequest
  ): Promise<{ data: ScheduledTask }> {
    return apiFetch<{ data: ScheduledTask }>(`/scheduled-tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  /**
   * 获取定时任务详情
   */
  async getById(id: string): Promise<{ data: ScheduledTask }> {
    return apiFetch<{ data: ScheduledTask }>(`/scheduled-tasks/${id}`)
  },

  /**
   * 更新定时任务
   */
  async update(
    id: string,
    data: UpdateScheduledTaskRequest
  ): Promise<{ data: ScheduledTask }> {
    return apiFetch<{ data: ScheduledTask }>(`/scheduled-tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  /**
   * 删除定时任务
   */
  async delete(id: string): Promise<{ data: { message: string } }> {
    return apiFetch<{ data: { message: string } }>(`/scheduled-tasks/${id}`, {
      method: "DELETE",
    })
  },

  /**
   * 获取定时任务统计信息
   */
  async getStatistics(): Promise<{ data: ScheduledTaskStatistics }> {
    return apiFetch<{ data: ScheduledTaskStatistics }>(`/scheduled-tasks/statistics`)
  },

  /**
   * 启用/禁用定时任务
   */
  async toggle(id: string, enabled: boolean): Promise<{ data: { message: string } }> {
    return apiFetch<{ data: { message: string } }>(`/scheduled-tasks/${id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    })
  },

  /**
   * 手动触发定时任务
   */
  async trigger(id: string): Promise<{ data: { message: string } }> {
    return apiFetch<{ data: { message: string } }>(`/scheduled-tasks/${id}/trigger`, {
      method: "POST",
    })
  },
}
