import { apiFetch } from "@/lib/api-client"

/**
 * 系统信息
 */
export interface SystemInfo {
  hostname: string
  os: string
  platform: string
  kernel: string
  architecture: string
  cpu_model: string
  cpu_cores: number
  total_memory: number
  uptime: number
  boot_time: string
}

/**
 * CPU信息
 */
export interface CPUInfo {
  model: string
  cores: number
  usage_percent: number
  usage_per_core: number[]
  load_average: number[]
}

/**
 * 内存信息
 */
export interface MemoryInfo {
  total: number
  used: number
  free: number
  available: number
  usage_percent: number
  swap_total: number
  swap_used: number
  swap_free: number
  swap_usage_percent: number
}

/**
 * 磁盘信息
 */
export interface DiskInfo {
  device: string
  mount_point: string
  filesystem: string
  total: number
  used: number
  available: number
  usage_percent: number
}

/**
 * 网络接口信息
 */
export interface NetworkInterface {
  name: string
  addresses: string[]
  mac_address: string
  bytes_sent: number
  bytes_recv: number
  packets_sent: number
  packets_recv: number
  errors_in: number
  errors_out: number
  drop_in: number
  drop_out: number
}

/**
 * 进程信息
 */
export interface ProcessInfo {
  pid: number
  name: string
  username: string
  cpu_percent: number
  memory_percent: number
  memory_rss: number
  status: string
  started: string
}

/**
 * 监控 API 服务
 */
export const monitoringApi = {
  /**
   * 获取系统综合信息
   */
  async getSystemInfo(serverId: string): Promise<SystemInfo> {
    return apiFetch<SystemInfo>(`/monitoring/${serverId}/system`)
  },

  /**
   * 获取CPU信息
   */
  async getCPUInfo(serverId: string): Promise<CPUInfo> {
    return apiFetch<CPUInfo>(`/monitoring/${serverId}/cpu`)
  },

  /**
   * 获取内存信息
   */
  async getMemoryInfo(serverId: string): Promise<MemoryInfo> {
    return apiFetch<MemoryInfo>(`/monitoring/${serverId}/memory`)
  },

  /**
   * 获取磁盘信息
   */
  async getDiskInfo(serverId: string): Promise<DiskInfo[]> {
    return apiFetch<DiskInfo[]>(`/monitoring/${serverId}/disk`)
  },

  /**
   * 获取网络信息
   */
  async getNetworkInfo(serverId: string): Promise<NetworkInterface[]> {
    return apiFetch<NetworkInterface[]>(`/monitoring/${serverId}/network`)
  },

  /**
   * 获取TOP进程列表
   */
  async getTopProcesses(serverId: string, limit: number = 10): Promise<ProcessInfo[]> {
    return apiFetch<ProcessInfo[]>(`/monitoring/${serverId}/processes?limit=${limit}`)
  },
}
