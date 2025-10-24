import { apiFetch } from "@/lib/api-client"

/**
 * 文件信息
 */
export interface FileInfo {
  name: string
  path: string
  size: number
  mode: string
  mod_time: string
  is_dir: boolean
  is_link: boolean
  link_target?: string
  owner?: string
  group?: string
  permissions?: string
}

/**
 * 目录列表响应
 */
export interface DirectoryListResponse {
  path: string
  files: FileInfo[]
  parent?: string
}

/**
 * 磁盘使用响应
 */
export interface DiskUsageResponse {
  path: string
  total: number
  used: number
  available: number
  usage_percent: number
}

/**
 * SFTP API 服务
 */
export const sftpApi = {
  /**
   * 列出目录内容
   */
  async listDirectory(token: string, serverId: string, path: string = "/"): Promise<DirectoryListResponse> {
    return apiFetch<DirectoryListResponse>(`/sftp/${serverId}/list?path=${encodeURIComponent(path)}`, {
      token,
    })
  },

  /**
   * 获取文件信息
   */
  async getFileInfo(token: string, serverId: string, path: string): Promise<FileInfo> {
    return apiFetch<FileInfo>(`/sftp/${serverId}/stat?path=${encodeURIComponent(path)}`, {
      token,
    })
  },

  /**
   * 创建目录
   */
  async createDirectory(token: string, serverId: string, path: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/mkdir`, {
      method: "POST",
      token,
      body: { path },
    })
  },

  /**
   * 删除文件或目录
   */
  async delete(token: string, serverId: string, path: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/delete`, {
      method: "DELETE",
      token,
      body: { path },
    })
  },

  /**
   * 重命名文件或目录
   */
  async rename(token: string, serverId: string, oldPath: string, newPath: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/rename`, {
      method: "POST",
      token,
      body: { old_path: oldPath, new_path: newPath },
    })
  },

  /**
   * 移动文件或目录
   */
  async move(token: string, serverId: string, sourcePath: string, destPath: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/move`, {
      method: "POST",
      token,
      body: { source: sourcePath, destination: destPath },
    })
  },

  /**
   * 复制文件
   */
  async copy(token: string, serverId: string, sourcePath: string, destPath: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/copy`, {
      method: "POST",
      token,
      body: { source: sourcePath, destination: destPath },
    })
  },

  /**
   * 读取文件内容
   */
  async readFile(token: string, serverId: string, path: string): Promise<string> {
    const response = await apiFetch<{ content: string }>(`/sftp/${serverId}/read?path=${encodeURIComponent(path)}`, {
      token,
    })
    return response.content
  },

  /**
   * 写入文件内容
   */
  async writeFile(token: string, serverId: string, path: string, content: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/write`, {
      method: "POST",
      token,
      body: { path, content },
    })
  },

  /**
   * 获取磁盘使用情况
   */
  async getDiskUsage(token: string, serverId: string, path: string = "/"): Promise<DiskUsageResponse> {
    return apiFetch<DiskUsageResponse>(`/sftp/${serverId}/disk-usage?path=${encodeURIComponent(path)}`, {
      token,
    })
  },

  /**
   * 获取下载URL
   */
  getDownloadUrl(serverId: string, path: string, token: string): string {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"
    return `${apiUrl}/sftp/${serverId}/download?path=${encodeURIComponent(path)}&token=${token}`
  },

  /**
   * 上传文件
   */
  async uploadFile(token: string, serverId: string, path: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("path", path)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"
    const response = await fetch(`${apiUrl}/sftp/${serverId}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Upload failed" }))
      throw new Error(error.message || "Upload failed")
    }
  },
}
