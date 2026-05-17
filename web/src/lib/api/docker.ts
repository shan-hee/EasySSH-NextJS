/**
 * Docker 管理 API 封装
 */
import { apiFetch } from "@/lib/api-client"
import type {
  DockerContainer,
  ContainerStats,
  DockerImage,
  DockerSystemInfo,
} from "@/components/terminal/docker/types"

/**
 * 容器列表响应
 */
export interface ContainersResponse {
  data: DockerContainer[]
  total: number
}

/**
 * 镜像列表响应
 */
export interface ImagesResponse {
  data: DockerImage[]
  total: number
}

/**
 * 容器日志响应
 */
export interface ContainerLogsResponse {
  data: string
  container_id: string
  lines: number
}

/**
 * 资源页签响应（仅 stats + systemInfo）
 */
export interface ResourcesResponse {
  stats: ContainerStats[]
  systemInfo: DockerSystemInfo | null
  dockerInstalled: boolean
  error?: string
}

/**
 * 镜像更新检查响应
 */
export interface ImageUpdateCheckResponse {
  hasUpdate: boolean
  imageName: string
  containerName: string
  updateCommand: string
  error?: string
}

/**
 * Docker API 服务
 */
export const dockerApi = {
  /**
   * 获取容器列表
   */
  async listContainers(serverId: string, all = true): Promise<ContainersResponse> {
    const params = new URLSearchParams()
    if (all) params.set("all", "true")
    const qs = params.toString()
    return apiFetch<ContainersResponse>(`/docker/${serverId}/containers${qs ? `?${qs}` : ""}`)
  },

  /**
   * 获取容器统计信息
   */
  async getContainerStats(serverId: string): Promise<ContainerStats[]> {
    const res = await apiFetch<{ data: ContainerStats[] }>(`/docker/${serverId}/stats`)
    return res.data
  },

  /**
   * 获取单个容器的统计信息
   */
  async getContainerStat(serverId: string, containerId: string): Promise<ContainerStats> {
    return apiFetch<ContainerStats>(`/docker/${serverId}/containers/${containerId}/stats`)
  },

  /**
   * 获取容器日志
   */
  async getContainerLogs(
    serverId: string,
    containerId: string,
    tail = 100,
    encoding = "utf-8"
  ): Promise<ContainerLogsResponse> {
    const params = new URLSearchParams({
      tail: String(tail),
      encoding,
    })

    return apiFetch<ContainerLogsResponse>(
      `/docker/${serverId}/containers/${containerId}/logs?${params.toString()}`
    )
  },

  /**
   * 启动容器
   */
  async startContainer(serverId: string, containerId: string): Promise<void> {
    await apiFetch(`/docker/${serverId}/containers/${containerId}/start`, {
      method: "POST",
    })
  },

  /**
   * 停止容器
   */
  async stopContainer(serverId: string, containerId: string): Promise<void> {
    await apiFetch(`/docker/${serverId}/containers/${containerId}/stop`, {
      method: "POST",
    })
  },

  /**
   * 重启容器
   */
  async restartContainer(serverId: string, containerId: string): Promise<void> {
    await apiFetch(`/docker/${serverId}/containers/${containerId}/restart`, {
      method: "POST",
    })
  },

  /**
   * 暂停容器
   */
  async pauseContainer(serverId: string, containerId: string): Promise<void> {
    await apiFetch(`/docker/${serverId}/containers/${containerId}/pause`, {
      method: "POST",
    })
  },

  /**
   * 恢复容器
   */
  async unpauseContainer(serverId: string, containerId: string): Promise<void> {
    await apiFetch(`/docker/${serverId}/containers/${containerId}/unpause`, {
      method: "POST",
    })
  },

  /**
   * 删除容器
   */
  async removeContainer(serverId: string, containerId: string, force = false): Promise<void> {
    const params = new URLSearchParams()
    if (force) params.set("force", "true")
    const qs = params.toString()
    await apiFetch(`/docker/${serverId}/containers/${containerId}${qs ? `?${qs}` : ""}`, {
      method: "DELETE",
    })
  },

  /**
   * 获取镜像列表
   */
  async listImages(serverId: string): Promise<ImagesResponse> {
    return apiFetch<ImagesResponse>(`/docker/${serverId}/images`)
  },

  /**
   * 获取 Docker 系统信息
   */
  async getSystemInfo(serverId: string): Promise<DockerSystemInfo> {
    const res = await apiFetch<{ data: DockerSystemInfo }>(`/docker/${serverId}/system`)
    return res.data
  },

  /**
   * 获取资源页签数据（仅 stats + systemInfo）
   */
  async getResources(serverId: string): Promise<ResourcesResponse> {
    return apiFetch<ResourcesResponse>(`/docker/${serverId}/resources`)
  },

  /**
   * 检查容器镜像更新
   */
  async checkImageUpdate(serverId: string, containerId: string): Promise<ImageUpdateCheckResponse> {
    const res = await apiFetch<{ data: ImageUpdateCheckResponse }>(
      `/docker/${serverId}/containers/${containerId}/check-update`
    )
    return res.data
  },
}
