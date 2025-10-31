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
    // 注意: 后端返回的是纯文本(text/plain),不是JSON
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"
    const response = await fetch(`${apiUrl}/sftp/${serverId}/read?path=${encodeURIComponent(path)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
   * @param onProgress 进度回调函数 (loaded: 已上传字节数, total: 总字节数)
   * @param wsTaskId 可选的 WebSocket 任务 ID，用于接收 SFTP 阶段的进度
   */
  async uploadFile(
    token: string,
    serverId: string,
    path: string,
    file: File,
    onProgress?: (loaded: number, total: number) => void,
    wsTaskId?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"

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
      xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      xhr.send(formData)
    })
  },
}
