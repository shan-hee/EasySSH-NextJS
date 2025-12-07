/**
 * 任务执行历史 API
 */

import { apiFetch } from "@/lib/api-client"

// 触发类型
export type TriggerType = "schedule" | "manual"

// 执行状态
export type ExecutionStatus = "pending" | "running" | "success" | "failed" | "partial" | "timeout" | "canceled"

// 任务执行记录
export interface TaskExecution {
  id: string
  scheduled_task_id: string
  user_id: string
  username: string
  task_name: string
  task_type: string // command | script | batch
  trigger_type: TriggerType
  command: string
  status: ExecutionStatus
  total_servers: number
  success_count: number
  failed_count: number
  start_time: string
  end_time?: string
  duration: number // 毫秒
  error_message?: string
  created_at: string
  updated_at: string
  server_results?: TaskExecutionServer[]
}

// 服务器执行结果
export interface TaskExecutionServer {
  id: string
  execution_id: string
  server_id: string
  server_name: string
  server_host: string
  status: ExecutionStatus
  exit_code?: number
  output: string
  error_message?: string
  start_time: string
  end_time?: string
  duration: number // 毫秒
  created_at: string
}

// 查询参数
export interface ListExecutionsParams {
  page?: number
  limit?: number
  scheduled_task_id?: string
  status?: ExecutionStatus
  trigger_type?: TriggerType
  task_type?: string
  start_time?: string
  end_time?: string
}

// 列表响应
export interface ListExecutionsResponse {
  data: TaskExecution[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// 执行统计
export interface ExecutionStatistics {
  total_executions: number
  success_count: number
  failed_count: number
  partial_count: number
  running_count: number
  average_duration: number // 毫秒
  by_status: Record<ExecutionStatus, number>
  by_task_type: Record<string, number>
  recent_executions: TaskExecution[]
}

// 执行详情响应
export interface ExecutionDetailResponse extends TaskExecution {
  server_results: TaskExecutionServer[]
}

/**
 * 任务执行历史 API
 */
export const taskExecutionsApi = {
  /**
   * 获取执行历史列表
   */
  list: async (params?: ListExecutionsParams): Promise<ListExecutionsResponse> => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
    }
    const query = searchParams.toString()
    const url = query ? `/task-executions?${query}` : "/task-executions"
    return apiFetch<ListExecutionsResponse>(url)
  },

  /**
   * 获取执行详情
   */
  getById: async (id: string): Promise<ExecutionDetailResponse> => {
    return apiFetch<ExecutionDetailResponse>(`/task-executions/${id}`)
  },

  /**
   * 获取服务器执行结果
   */
  getResults: async (id: string): Promise<TaskExecutionServer[]> => {
    return apiFetch<TaskExecutionServer[]>(`/task-executions/${id}/results`)
  },

  /**
   * 获取执行统计
   */
  getStatistics: async (days?: number): Promise<ExecutionStatistics> => {
    const url = days ? `/task-executions/statistics?days=${days}` : "/task-executions/statistics"
    return apiFetch<ExecutionStatistics>(url)
  },
}
