import { apiFetch } from "@/lib/api-client"
import { getApiUrl } from "../config"
import { getCurrentAccessToken } from "@/stores/auth-store"
import { createAuthTicket } from "@/lib/auth-ticket"

/**
 * 文件信息
 */
export interface FileInfo {
  name: string
  path: string
  size: number
  mode: number  // os.FileMode 序列化为数字
  mod_time: string
  is_dir: boolean
  is_link: boolean
  link_target?: string
  permission?: string  // 权限字符串，如 "drwxr-xr-x"
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

export type UploadProgressStage = "http" | "sftp" | "stream"

export interface UploadTaskStatus {
  id: string
  file_name: string
  file_size: number
  server_id?: string
  remote_path?: string
  status: "pending" | "uploading" | "completed" | "failed" | "cancelled"
  stage?: UploadProgressStage
  progress: number
  loaded: number
  total: number
  speed_bps: number
  message?: string
  error?: string
  created_at: string
  started_at?: string
  updated_at: string
  ended_at?: string
}

export interface UploadTaskListResponse {
  tasks: UploadTaskStatus[]
}

/**
 * SFTP API 服务
 */
export const sftpApi = {
  /**
   * 创建上传任务（服务端生成 task_id，用于上传进度 WebSocket）
   */
  async createUploadTask(): Promise<{ task_id: string }> {
    return apiFetch<{ task_id: string }>(`/sftp/upload/task`, {
      method: "POST",
    })
  },

  /**
   * 获取上传任务列表（后端内存运行态）
   */
  async listUploadTasks(): Promise<UploadTaskListResponse> {
    return apiFetch<UploadTaskListResponse>(`/sftp/upload/tasks`)
  },

  /**
   * 获取上传任务详情（后端内存运行态）
   */
  async getUploadTask(taskId: string): Promise<UploadTaskStatus> {
    return apiFetch<UploadTaskStatus>(`/sftp/upload/tasks/${encodeURIComponent(taskId)}`)
  },

  /**
   * 取消上传任务
   */
  async cancelUploadTask(taskId: string): Promise<void> {
    return apiFetch<void>(`/sftp/upload/tasks/${encodeURIComponent(taskId)}/cancel`, {
      method: "POST",
      retry: false,
      timeout: 10000,
    })
  },

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
  async createDirectory(serverId: string, path: string): Promise<FileInfo> {
    // 后端返回新建目录的 FileInfo,用于前端差异更新
    return apiFetch<FileInfo>(`/sftp/${serverId}/mkdir`, {
      method: "POST",
      body: { path },
    })
  },

  /**
   * 删除文件或目录
   */
  async delete(serverId: string, path: string): Promise<FileInfo> {
    // 后端返回被删除文件的 FileInfo(删除前快照)
    return apiFetch<FileInfo>(`/sftp/${serverId}/delete`, {
      method: "DELETE",
      body: { path },
      timeout: 300000, // 5分钟超时（用于删除大目录如 node_modules）
      retry: false,    // 禁用重试（删除操作不应重试）
    })
  },

  /**
   * 重命名文件或目录
   */
  async rename(serverId: string, oldPath: string, newPath: string): Promise<FileInfo> {
    // 后端返回重命名后的 FileInfo
    return apiFetch<FileInfo>(`/sftp/${serverId}/rename`, {
      method: "POST",
      body: { old_path: oldPath, new_path: newPath },
    })
  },

  /**
   * 修改文件或目录权限
   */
  async chmod(serverId: string, path: string, mode: string): Promise<void> {
    return apiFetch<void>(`/sftp/${serverId}/chmod`, {
      method: "POST",
      body: { path, mode },
    })
  },

  /**
   * 读取文件内容
   */
  async readFile(serverId: string, path: string): Promise<string> {
    // 使用统一的 apiFetch，自动附带 Bearer Token
    // 后端返回的是 text/plain，这里通过泛型声明为 string
    return apiFetch<string>(`/sftp/${serverId}/read?path=${encodeURIComponent(path)}`, {
      headers: {
        // 明确告知后端我们接受文本响应
        Accept: "text/plain",
      },
      // 读文件一般不需要重试，避免对远端 SFTP 增加额外压力
      retry: false,
    })
  },

  /**
   * 写入文件内容
   */
  async writeFile(serverId: string, path: string, content: string): Promise<FileInfo> {
    // 后端返回最新的 FileInfo(包含大小/修改时间等)
    return apiFetch<FileInfo>(`/sftp/${serverId}/write`, {
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
   * 主动关闭指定服务器的 SFTP 连接（加速资源回收）
   */
  async closeConnection(serverId: string): Promise<void> {
    await apiFetch<void>(`/sftp/${serverId}/close`, {
      method: "POST",
      retry: false,
      timeout: 10000,
    })
  },

  /**
   * 获取下载URL
   */
  getDownloadUrl(serverId: string, path: string): string {
    void serverId
    void path
    throw new Error("getDownloadUrl 已弃用：下载需使用一次性 ticket（请使用 downloadFile 或 createAuthTicket）")
  },

  /**
   * 上传文件（新方案：浏览器 multipart 流直接转写到远端 SFTP）
   * @param onProgress 进度回调函数 (loaded: 已上传字节数, total: 总字节数)
   * @param wsTaskId 服务端上传任务 ID，用于接收流式上传进度和支持取消
   */
  async uploadFile(
    serverId: string,
    path: string,
    file: File,
    onProgress?: (loaded: number, total: number) => void,
    wsTaskId?: string,
    onXhr?: (xhr: XMLHttpRequest) => void
  ): Promise<FileInfo | null> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const apiUrl = getApiUrl()

      if (onXhr) {
        onXhr(xhr)
      }

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
          // 尝试解析后端返回的 FileInfo(JSON 包装为 { data: FileInfo })
          try {
            const raw = xhr.responseText
            if (!raw) {
              resolve(null)
              return
            }
            const parsed: unknown = JSON.parse(raw)
            if (parsed && typeof parsed === "object" && "data" in parsed) {
              const { data } = parsed as { data?: FileInfo | null }
              resolve(data ?? null)
            } else {
              resolve(null)
            }
          } catch {
            // 解析失败时仍视为成功,但不返回文件信息
            resolve(null)
          }
        } else {
          try {
            const error: unknown = JSON.parse(xhr.responseText)
            const message =
              error && typeof error === "object" && "message" in error && typeof error.message === "string"
                ? error.message
                : "Upload failed"
            reject(new Error(message))
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
      }

      // 监听错误事件
      xhr.onerror = () => {
        reject(new Error("Network error during upload"))
      }

      // 监听中断事件（例如调用 xhr.abort）
      xhr.onabort = () => {
        reject(new Error("Upload aborted"))
      }

      // 监听超时事件
      xhr.ontimeout = () => {
        reject(new Error("Upload timeout"))
      }

      // 准备表单数据
      const formData = new FormData()
      formData.append("file", file)

      // 新上传链路要求先创建服务端任务，以 task_id 作为取消和进度订阅中心
      let url = `${apiUrl}/sftp/${serverId}/upload/stream?path=${encodeURIComponent(path)}&size=${encodeURIComponent(file.size.toString())}`
      if (wsTaskId) {
        url += `&task_id=${encodeURIComponent(wsTaskId)}`
      }

      // 发送请求
      xhr.open("POST", url)
      // 附带 Bearer Token（与其他 API 一致）
      const token = getCurrentAccessToken()
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      }
      xhr.send(formData)
    })
  },

  /**
   * 旧版上传文件（保留兼容，不再由前端上传入口默认接入）
   */
  async uploadFileLegacy(
    serverId: string,
    path: string,
    file: File,
    onProgress?: (loaded: number, total: number) => void,
    wsTaskId?: string,
    onXhr?: (xhr: XMLHttpRequest) => void
  ): Promise<FileInfo | null> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const apiUrl = getApiUrl()

      if (onXhr) {
        onXhr(xhr)
      }

      if (onProgress) {
        xhr.upload.onprogress = (event: ProgressEvent) => {
          if (event.lengthComputable) {
            onProgress(event.loaded, event.total)
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const raw = xhr.responseText
            if (!raw) {
              resolve(null)
              return
            }
            const parsed: unknown = JSON.parse(raw)
            if (parsed && typeof parsed === "object" && "data" in parsed) {
              const { data } = parsed as { data?: FileInfo | null }
              resolve(data ?? null)
            } else {
              resolve(null)
            }
          } catch {
            resolve(null)
          }
        } else {
          try {
            const error: unknown = JSON.parse(xhr.responseText)
            const message =
              error && typeof error === "object" && "message" in error && typeof error.message === "string"
                ? error.message
                : "Upload failed"
            reject(new Error(message))
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
      }

      xhr.onerror = () => {
        reject(new Error("Network error during upload"))
      }
      xhr.onabort = () => {
        reject(new Error("Upload aborted"))
      }
      xhr.ontimeout = () => {
        reject(new Error("Upload timeout"))
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("path", path)

      let url = `${apiUrl}/sftp/${serverId}/upload`
      if (wsTaskId) {
        url += `?ws_task_id=${encodeURIComponent(wsTaskId)}`
      }

      xhr.open("POST", url)
      const token = getCurrentAccessToken()
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      }
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
   * 批量下载文件（打包为 ZIP 或 tar.gz）
   */
  async batchDownload(
    serverId: string,
    paths: string[],
    mode: "fast" | "compatible" = "compatible",
    excludePatterns?: string[]
  ): Promise<void> {
    const apiUrl = getApiUrl()
    const isRelativeApiUrl = apiUrl.startsWith("/")

    // 生产同域：用隐藏 form 提交，让浏览器原生流式下载（避免 response.blob 占用内存）
    if (typeof window !== "undefined" && isRelativeApiUrl) {
      const { ticket } = await createAuthTicket({
        type: "sftp_batch_download",
        server_id: serverId,
        paths,
        mode,
        exclude_patterns: excludePatterns ?? [],
      })
      const action = `${apiUrl}/sftp/${serverId}/batch-download?ticket=${encodeURIComponent(ticket)}`

      const iframeName = `easyssh-download-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const iframe = document.createElement("iframe")
      iframe.name = iframeName
      iframe.style.display = "none"
      document.body.appendChild(iframe)

      const form = document.createElement("form")
      form.method = "POST"
      form.action = action
      form.target = iframeName
      form.style.display = "none"

      document.body.appendChild(form)
      form.submit()
      document.body.removeChild(form)

      // 延迟清理 iframe（留给下载握手）
      window.setTimeout(() => {
        document.body.removeChild(iframe)
      }, 30_000)
      return
    }

    // 开发/跨域：保留 fetch 下载（注意大文件会占用内存）
    const { ticket } = await createAuthTicket({
      type: "sftp_batch_download",
      server_id: serverId,
      paths,
      mode,
      exclude_patterns: excludePatterns ?? [],
    })

    const response = await fetch(`${apiUrl}/sftp/${serverId}/batch-download?ticket=${encodeURIComponent(ticket)}`, {
      method: "POST",
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Batch download failed" }))
      throw new Error(error.message || "Batch download failed")
    }

    // 获取文件名（从响应头）
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = mode === "fast" ? "files.tar.gz" : "files.zip"
    if (contentDisposition) {
      const matches = /filename=([^;]+)/.exec(contentDisposition)
      if (matches && matches[1]) {
        filename = matches[1].trim()
      }
    }

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

  /**
   * 单文件下载（直接触发浏览器下载，使用浏览器原生下载管理器显示进度）
   */
  downloadFile(serverId: string, path: string): void {
    void (async () => {
      try {
        const apiUrl = getApiUrl()
        const { ticket } = await createAuthTicket({
          type: "sftp_download",
          server_id: serverId,
          path,
        })
        const url = `${apiUrl}/sftp/${serverId}/download?ticket=${encodeURIComponent(ticket)}`

        // 使用隐藏 iframe 触发下载，避免顶层页面导航导致终端/SFTP 面板卸载
        const iframeName = `easyssh-download-single-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const iframe = document.createElement("iframe")
        iframe.name = iframeName
        iframe.style.display = "none"
        document.body.appendChild(iframe)
        iframe.src = url

        // 延迟清理，给浏览器留出完成下载握手的时间
        window.setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe)
          }
        }, 30_000)
      } catch (err) {
        console.error("[sftpApi.downloadFile] Failed to create download ticket:", err)
      }
    })()
  },

  /**
   * 跨服务器文件传输（流式中转）
   * 用于在两个不同服务器之间传输文件
   */
  async transferBetweenServers(
    sourceServerId: string,
    sourcePath: string,
    targetServerId: string,
    targetPath: string
  ): Promise<TransferResponse> {
    return apiFetch<TransferResponse>(`/sftp/transfer`, {
      method: "POST",
      body: {
        source_server_id: sourceServerId,
        source_path: sourcePath,
        target_server_id: targetServerId,
        target_path: targetPath,
      },
      timeout: 600000, // 10分钟超时（大文件传输可能需要更长时间）
      retry: false,    // 禁用重试（传输操作不应重试）
    })
  },

  /**
   * 跨服务器直连传输（rsync/scp）
   * 启动后台传输任务，通过 WebSocket 推送进度
   * @returns 任务 ID，用于连接 WebSocket 获取进度
   */
  async directTransfer(
    sourceServerId: string,
    sourcePath: string,
    targetServerId: string,
    targetPath: string,
  ): Promise<DirectTransferResponse> {
    return apiFetch<DirectTransferResponse>(`/sftp/transfer/direct`, {
      method: "POST",
      body: {
        source_server_id: sourceServerId,
        source_path: sourcePath,
        target_server_id: targetServerId,
        target_path: targetPath,
      },
    })
  },

  /**
   * 取消跨服务器传输任务
   */
  async cancelTransfer(taskId: string): Promise<void> {
    return apiFetch<void>(`/sftp/transfer/${taskId}/cancel`, {
      method: "POST",
    })
  },

  /**
   * 获取跨服务器传输 WebSocket URL
   */
  getTransferWebSocketUrl(taskId: string): string {
    const apiUrl = getApiUrl()
    // 将 http:// 或 https:// 替换为 ws:// 或 wss://
    const wsUrl = apiUrl.replace(/^http/, "ws")
    return `${wsUrl}/sftp/transfer/ws/${taskId}`
  },
}

/**
 * 跨服务器传输响应
 */
export interface TransferResponse {
  success: boolean
  message: string
  bytes_copied: number
  file_name: string
}

/**
 * 直连传输响应
 */
export interface DirectTransferResponse {
  success: boolean
  task_id: string
  message: string
}

/**
 * 传输进度消息（WebSocket）
 */
export interface TransferProgressMessage {
  type: "started" | "progress" | "complete" | "error" | "cancelled"
  task_id: string
  bytes_total: number
  bytes_copied: number
  progress: number  // 0-100
  speed_bps: number
  eta: string
  current_file: string
  files_total: number
  files_completed: number
  message: string
  method: "rsync" | "scp" | "sftp"
}
