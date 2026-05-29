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
  exited: 'text-muted-foreground',
  created: 'text-purple-600 dark:text-purple-400',
  restarting: 'text-blue-600 dark:text-blue-400',
  dead: 'text-red-600 dark:text-red-400',
}

// Compose 容器信息
export interface ComposeInfo {
  isCompose: boolean
  project?: string
  service?: string
  workDir?: string
  version?: string // Compose 版本 (1.x 或 2.x)
}

// Compose 标签常量
const COMPOSE_LABELS = {
  PROJECT: 'com.docker.compose.project',
  SERVICE: 'com.docker.compose.service',
  WORK_DIR: 'com.docker.compose.project.working_dir',
  VERSION: 'com.docker.compose.version',
  CONFIG_FILES: 'com.docker.compose.project.config_files',
} as const

/**
 * 从容器标签中检测 Compose 信息
 */
export function getComposeInfo(labels: Record<string, string>): ComposeInfo {
  const project = labels[COMPOSE_LABELS.PROJECT]
  const service = labels[COMPOSE_LABELS.SERVICE]
  const workDir = labels[COMPOSE_LABELS.WORK_DIR]
  const version = labels[COMPOSE_LABELS.VERSION]
  const configFiles = labels[COMPOSE_LABELS.CONFIG_FILES]

  if (!project || !service) {
    return { isCompose: false }
  }

  // 尝试从 config_files 标签中提取工作目录（如果 workDir 不存在）
  let resolvedWorkDir = workDir
  if (!resolvedWorkDir && configFiles) {
    // config_files 格式可能是: /path/to/docker-compose.yml 或 /path/to/docker-compose.yml,/path/to/override.yml
    const firstConfigFile = configFiles.split(',')[0]?.trim()
    if (firstConfigFile) {
      // 提取目录路径
      const lastSlash = firstConfigFile.lastIndexOf('/')
      if (lastSlash > 0) {
        resolvedWorkDir = firstConfigFile.substring(0, lastSlash)
      }
    }
  }

  return {
    isCompose: true,
    project,
    service,
    workDir: resolvedWorkDir,
    version,
  }
}

/**
 * 生成更新并重启命令
 * @param container 容器信息
 * @param composeInfo Compose 信息
 * @returns 更新命令
 */
export function generateUpdateRestartCommand(
  container: DockerContainer,
  composeInfo: ComposeInfo
): string {
  if (composeInfo.isCompose && composeInfo.workDir && composeInfo.service) {
    // Compose 容器：使用 docker compose 命令
    // 优先使用 docker compose (v2)，如果失败会自动回退
    return `cd "${composeInfo.workDir}" && docker compose pull ${composeInfo.service} && docker compose up -d ${composeInfo.service}`
  }

  // 非 Compose 容器：仅拉取镜像
  return `docker pull ${container.image}`
}
