import { apiFetch, getApiUrl, getAuthHeaders } from "@/lib/api-client"

/**
 * CPU 概览
 */
export interface CPUSummary {
  cores: number
  usage_percent: number
  load_average: number[]
}

/**
 * 内存概览
 */
export interface MemorySummary {
  total: number
  used: number
  used_percent: number
}

/**
 * 磁盘概览
 */
export interface DiskSummary {
  total: number
  used: number
  used_percent: number
}

/**
 * 网络概览
 */
export interface NetworkSummary {
  rx_bytes: number
  tx_bytes: number
}

/**
 * 地理位置概览
 */
export interface LocationSummary {
  country: string
  country_code: string
  region: string
  city: string
}

/**
 * 单台服务器资源概览
 */
export interface ServerResourceSummary {
  server_id: string
  name: string
  host: string
  port: number
  status: "online" | "offline" | "error"
  location?: LocationSummary | null
  cpu: CPUSummary | null
  memory: MemorySummary | null
  disk: DiskSummary | null
  network: NetworkSummary | null
  uptime: number
  collected_at: string
  error?: string
}

/**
 * 所有服务器资源概览响应
 */
export interface AllServersResourcesResponse {
  servers: ServerResourceSummary[]
  collected_at: string
}

/**
 * 监控 API 服务
 */
export const monitoringApi = {
  /**
   * 获取所有服务器的资源概览（单次请求，批量采集）
   */
  async getAllServersResources(): Promise<AllServersResourcesResponse> {
    return apiFetch<AllServersResourcesResponse>(`/monitoring/resources`)
  },

  /**
   * 流式获取服务器资源（SSE，每台服务器采集完成立即返回）
   * @param onServer 每收到一台服务器数据时的回调
   * @param onDone 全部完成时的回调
   * @param onError 发生错误时的回调
   * @returns 取消函数
   */
  streamServersResources(
    onServer: (server: ServerResourceSummary) => void,
    onDone: () => void,
    onError?: (error: Error) => void
  ): () => void {
    const url = getApiUrl("/monitoring/resources/stream")
    const headers = getAuthHeaders()

    // 使用 fetch 而不是 EventSource（因为需要携带 Authorization header）
    const controller = new AbortController()

    fetch(url, {
      headers,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No reader available")
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // 解析 SSE 事件
          const lines = buffer.split("\n")
          buffer = lines.pop() || "" // 保留最后不完整的行

          let eventType = ""
          let eventData = ""

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7)
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6)
            } else if (line === "" && eventData) {
              // 空行表示事件结束
              try {
                if (eventType === "server") {
                  const server = JSON.parse(eventData) as ServerResourceSummary
                  onServer(server)
                } else if (eventType === "done") {
                  onDone()
                } else if (eventType === "error") {
                  const error = JSON.parse(eventData) as { error: string }
                  onError?.(new Error(error.error))
                }
              } catch {
                // 忽略解析错误
              }
              eventType = ""
              eventData = ""
            }
          }
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          onError?.(error)
        }
      })

    return () => controller.abort()
  },
}
