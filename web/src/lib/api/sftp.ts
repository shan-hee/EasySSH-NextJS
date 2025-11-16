import { apiFetch } from "@/lib/api-client"
import { getApiUrl } from "../config"

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
 * 批量操作错误信息
 */
export interface BatchOperationError {
  path: string
  error: string
  message: string
}

/**
 * 批量删除响应
 */
export interface BatchDeleteResponse {
  success: string[]
  failed: BatchOperationError[]
  total: number
}

/**
 * SFTP API 服务
 */
export const sftpApi = {
  /**
   * 列出目录内容
   */
  async listDirectory(serverId: string, path: string = "/"): Promise<DirectoryListResponse> {
    return apiFetch<DirectoryListResponse>(`/sftp/${serverId}/list?path=${encodeURIComponent(path)}`)
  },

  /**
   * 获取文件信息
   */
  async getFileInfo(serverId: string, path: string): Promise<FileInfo> {
    return apiFetch<FileInfo>(`/sftp/${serverId}/stat?path=${encodeURIComponent(path)}`)
  },

  /**
   * 创建目录
   */
  async createDirectory(serverId: string, path: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/mkdir`, {
      method: "POST",
      body: { path },
    })
  },

  /**
   * 删除文件或目录
   */
  async delete(serverId: string, path: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/delete`, {
      method: "DELETE",
      body: { path },
      timeout: 300000, // 5分钟超时（用于删除大目录如 node_modules）
      retry: false,    // 禁用重试（删除操作不应重试）
    })
  },

  /**
   * 重命名文件或目录
   */
  async rename(serverId: string, oldPath: string, newPath: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/rename`, {
      method: "POST",
      body: { old_path: oldPath, new_path: newPath },
    })
  },

  /**
   * 读取文件内容
   */
  async readFile(serverId: string, path: string): Promise<string> {
    // 注意: 后端返回的是纯文本(text/plain),不是JSON
    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/sftp/${serverId}/read?path=${encodeURIComponent(path)}`, {
      method: "GET",
      // 凭 Cookie 认证（跨域请求需要 include）
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Read failed" }))
      throw new Error(error.message || "Read failed")
    }

    // 直接返回文本内容
    return await response.text()
  },

  /**
   * 写入文件内容
   */
  async writeFile(serverId: string, path: string, content: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/write`, {
      method: "POST",
      body: { path, content },
    })
  },

  /**
   * 获取磁盘使用情况
   */
  async getDiskUsage(serverId: string, path: string = "/"): Promise<DiskUsageResponse> {
    return apiFetch<DiskUsageResponse>(`/sftp/${serverId}/disk-usage?path=${encodeURIComponent(path)}`)
  },

  /**
   * 获取下载URL
   */
  getDownloadUrl(serverId: string, path: string): string {
    const apiUrl = getApiUrl()
    // 通过 Cookie 认证，不再拼接 token
    return `${apiUrl}/sftp/${serverId}/download?path=${encodeURIComponent(path)}`
  },

  /**
   * 上传文件
   * @param onProgress 进度回调函数 (loaded: 已上传字节数, total: 总字节数)
   * @param wsTaskId 可选的 WebSocket 任务 ID，用于接收 SFTP 阶段的进度
   */
  async uploadFile(
    serverId: string,
    path: string,
    file: File,
    onProgress?: (loaded: number, total: number) => void,
    wsTaskId?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const apiUrl = getApiUrl()

      // 监听上传进度事件（HTTP 阶段）
      if (onProgress) {
        xhr.upload.onprogress = (event: ProgressEvent) => {
          if (event.lengthComputable) {
            onProgress(event.loaded, event.total)
          }
        }
      }

      // 监听完成事件
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.message || "Upload failed"))
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
      }

      // 监听错误事件
      xhr.onerror = () => {
        reject(new Error("Network error during upload"))
      }

      // 监听超时事件
      xhr.ontimeout = () => {
        reject(new Error("Upload timeout"))
      }

      // 准备表单数据
      const formData = new FormData()
      formData.append("file", file)
      formData.append("path", path)

      // 构建 URL，如果提供了 wsTaskId 则添加查询参数
      let url = `${apiUrl}/sftp/${serverId}/upload`
      if (wsTaskId) {
        url += `?ws_task_id=${encodeURIComponent(wsTaskId)}`
      }

      // 发送请求
      xhr.open("POST", url)
      // 凭 Cookie 认证
      xhr.withCredentials = true
      xhr.send(formData)
    })
  },

  /**
   * 批量删除文件或目录
   */
  async batchDelete(serverId: string, paths: string[]): Promise<BatchDeleteResponse> {
    return apiFetch<BatchDeleteResponse>(`/sftp/${serverId}/batch-delete`, {
      method: "POST",
      body: { paths },
      timeout: 600000, // 10分钟超时（批量操作可能需要更长时间）
      retry: false,    // 禁用重试（删除操作不应重试）
    })
  },

  /**
   * 批量下载文件（打包为 ZIP）
   */
  async batchDownload(serverId: string, paths: string[]): Promise<void> {
    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/sftp/${serverId}/batch-download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // 凭 Cookie 认证
      body: JSON.stringify({ paths }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Batch download failed" }))
      throw new Error(error.message || "Batch download failed")
    }

    // 获取文件名（从响应头）
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = "files.zip"
    if (contentDisposition) {
      const matches = /filename=([^;]+)/.exec(contentDisposition)
      if (matches && matches[1]) {
        filename = matches[1].trim()
      }
    }

    // 下载文件
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  },
}
