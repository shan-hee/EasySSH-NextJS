/**
 * Docker 管理功能类型定义
 */

// 容器状态枚举
export type ContainerState = 'running' | 'paused' | 'exited' | 'created' | 'restarting' | 'dead'

// 端口映射
export interface DockerPort {
  ip?: string
  privatePort: number
  publicPort?: number
  type: 'tcp' | 'udp'
}

// 挂载点
export interface DockerMount {
  type: string
  source: string
  destination: string
  mode: string
  rw: boolean
}

// Docker 容器信息
export interface DockerContainer {
  id: string
  names: string[]
  image: string
  imageId: string
  command: string
  created: number
  status: string
  state: ContainerState
  ports: DockerPort[]
  labels: Record<string, string>
  mounts: DockerMount[]
}

// 容器资源统计
export interface ContainerStats {
  containerId: string
  name: string
  cpuPercent: number
  memoryUsage: number
  memoryLimit: number
  memoryPercent: number
  networkIn: number
  networkOut: number
  blockRead: number
  blockWrite: number
  pids: number
}

// Docker 镜像
export interface DockerImage {
  id: string
  repository: string
  tag: string
  created: number
  size: number
  virtualSize: number
}

// Docker 系统信息
export interface DockerSystemInfo {
  containersRunning: number
  containersPaused: number
  containersStopped: number
  containersTotal: number
  imagesCount: number
  dockerVersion: string
  serverVersion: string
  storageDriver: string
  totalMemory: number
  cpus: number
}

// Docker 操作类型
export type DockerAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove'

// 容器筛选类型
export type ContainerFilter = 'all' | 'running' | 'stopped'

// Docker API 响应
export interface DockerDataResponse {
  containers: DockerContainer[]
  stats: ContainerStats[]
  images: DockerImage[]
  systemInfo: DockerSystemInfo | null
  dockerInstalled: boolean
  error?: string
}

// 状态颜色映射
export const STATE_COLORS: Record<ContainerState, string> = {
  running: 'bg-green-500',
  paused: 'bg-yellow-500',
  exited: 'bg-zinc-400',
  created: 'bg-purple-500',
  restarting: 'bg-blue-500',
  dead: 'bg-red-500',
}

// 状态文本颜色映射
export const STATE_TEXT_COLORS: Record<ContainerState, string> = {
  running: 'text-green-600 dark:text-green-400',
  paused: 'text-yellow-600 dark:text-yellow-400',
  exited: 'text-zinc-500 dark:text-zinc-400',
  created: 'text-purple-600 dark:text-purple-400',
  restarting: 'text-blue-600 dark:text-blue-400',
  dead: 'text-red-600 dark:text-red-400',
}
