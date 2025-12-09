/**
 * Docker 管理 API 封装
 */
import { apiFetch } from "@/lib/api-client"
import type {
  DockerContainer,
  ContainerStats,
  DockerImage,
  DockerSystemInfo,
  DockerDataResponse,
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
 * Docker API 服务
 */
export const dockerApi = {
  /**
   * 获取所有 Docker 数据（容器、镜像、统计、系统信息）
   * 单次请求获取所有数据，减少网络开销
   */
  async getAllData(serverId: string): Promise<DockerDataResponse> {
    return apiFetch<DockerDataResponse>(`/docker/${serverId}/all`)
  },

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
    tail = 100
  ): Promise<ContainerLogsResponse> {
    return apiFetch<ContainerLogsResponse>(
      `/docker/${serverId}/containers/${containerId}/logs?tail=${tail}`
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
}
