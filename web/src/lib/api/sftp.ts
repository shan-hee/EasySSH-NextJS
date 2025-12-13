import { apiFetch } from "@/lib/api-client"
import { getApiUrl } from "../config"
import { getCurrentAccessToken } from "@/stores/auth-store"

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

export interface TrashItem {
  trash_name: string
  trash_path: string
  original_name: string
  restore_path: string
  size: number
  mode: number
  is_dir: boolean
  is_link: boolean
  mod_time: string
  permission: string
}

export interface TrashListingResponse {
  parent_dir: string
  trash_dir: string
  items: TrashItem[]
  total: number
}

/**
 * 全局回收站项目（索引表记录）
 */
export type TrashItemStatus = "active" | "restored" | "purged" | "missing"

export interface GlobalTrashItem {
  id: string
  user_id: string
  server_id: string
  parent_dir: string
  original_path: string
  original_name: string
  trash_dir: string
  trash_path: string
  trash_name: string
  is_dir: boolean
  size: number
  mode: number
  deleted_at: string
  status: TrashItemStatus
  restored_at?: string
  restored_path?: string
  purged_at?: string
  created_at: string
  updated_at: string
  // 前端关联的服务器信息（需要在前端组合）
  server_name?: string
  server_host?: string
}

export interface GlobalTrashListResponse {
  items: GlobalTrashItem[]
  total: number
  limit: number
  offset: number
}

export interface GlobalTrashFilters {
  server_id?: string
  parent_dir?: string
  status?: TrashItemStatus
  limit?: number
  offset?: number
}

/**
 * 回收站设置响应
 */
export interface TrashSettingsResponse {
  id?: string
  retention_hours: number
  max_entries_per_dir: number
  max_bytes_per_dir_mb: number
  auto_clean_enabled: boolean
  is_default: boolean
}

/**
 * 回收站设置更新请求
 */
export interface TrashSettingsUpdate {
  retention_hours: number
  max_entries_per_dir: number
  max_bytes_per_dir_mb: number
  auto_clean_enabled: boolean
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
   * 列出指定目录同级 .trash 下的条目
   */
  async listTrash(serverId: string, parentDir: string): Promise<TrashListingResponse> {
    return apiFetch<TrashListingResponse>(`/sftp/${serverId}/trash/list?path=${encodeURIComponent(parentDir)}`)
  },

  /**
   * 从 .trash 恢复条目到同级目录
   */
  async restoreTrash(serverId: string, trashPath: string, renameIfExists: boolean = false): Promise<unknown> {
    return apiFetch(`/sftp/${serverId}/trash/restore`, {
      method: "POST",
      body: { trash_path: trashPath, rename_if_exists: renameIfExists },
    })
  },

  /**
   * 永久删除 .trash 中的条目（不会再次进入 .trash）
   */
  async purgeTrash(serverId: string, trashPath: string): Promise<unknown> {
    return apiFetch(`/sftp/${serverId}/trash/purge`, {
      method: "DELETE",
      body: { trash_path: trashPath },
      retry: false,
    })
  },

  /**
   * 清空指定目录同级 .trash（可选仅清理超过一定时间的条目）
   */
  async emptyTrash(serverId: string, parentDir: string, opts?: { olderThanHours?: number; maxDeletes?: number }): Promise<unknown> {
    return apiFetch(`/sftp/${serverId}/trash/empty`, {
      method: "POST",
      body: {
        path: parentDir,
        older_than_hours: opts?.olderThanHours ?? 0,
        max_deletes: opts?.maxDeletes ?? 500,
      },
      retry: false,
      timeout: 300000,
    })
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
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === "object" && "data" in parsed && (parsed as any).data) {
              resolve((parsed as any).data as FileInfo)
            } else {
              resolve(null)
            }
          } catch {
            // 解析失败时仍视为成功,但不返回文件信息
            resolve(null)
          }
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
      formData.append("path", path)

      // 构建 URL，如果提供了 wsTaskId 则添加查询参数
      let url = `${apiUrl}/sftp/${serverId}/upload`
      if (wsTaskId) {
        url += `?ws_task_id=${encodeURIComponent(wsTaskId)}`
      }

      // 发送请求
      xhr.open("POST", url)
      // 附带 Bearer Token（与其他 API 一致）
      const token = getCurrentAccessToken()
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      }
      // 保留 Cookie 认证（用于跨域场景下的刷新等）
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
      const action = `${apiUrl}/sftp/${serverId}/batch-download`

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

      // CSRF token（Cookie + Form）
      const csrf = document.cookie
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith("easyssh_csrf_token="))
      if (csrf) {
        const csrfValue = decodeURIComponent(csrf.split("=").slice(1).join("="))
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = "csrf_token"
        input.value = csrfValue
        form.appendChild(input)
      }

      const modeInput = document.createElement("input")
      modeInput.type = "hidden"
      modeInput.name = "mode"
      modeInput.value = mode
      form.appendChild(modeInput)

      for (const p of paths) {
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = "paths"
        input.value = p
        form.appendChild(input)
      }

      for (const pattern of excludePatterns ?? []) {
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = "excludePatterns"
        input.value = pattern
        form.appendChild(input)
      }

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
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }
    const token = getCurrentAccessToken()
    if (token) {
      ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
    }
    // CSRF（若存在）
    if (typeof document !== "undefined") {
      const csrf = document.cookie
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith("easyssh_csrf_token="))
      if (csrf) {
        ;(headers as Record<string, string>)["X-CSRF-Token"] = decodeURIComponent(csrf.split("=").slice(1).join("="))
      }
    }

    const response = await fetch(`${apiUrl}/sftp/${serverId}/batch-download`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        paths,
        mode,
        excludePatterns,
      }),
      credentials: "include",
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
  downloadFile(serverId: string, path: string, fileName?: string): void {
    const apiUrl = getApiUrl()
    // Cookie 鉴权：不再在 URL 中附带 token
    const params = new URLSearchParams()
    params.set("path", path)
    const url = `${apiUrl}/sftp/${serverId}/download?${params.toString()}`

    // 使用 <a> 标签触发下载，避免页面跳转
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || path.split('/').pop() || 'download'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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

  /**
   * 主动关闭该用户对该服务器的 SFTP 池连接
   */

  // ============= 全局回收站 API（基于索引表） =============

  /**
   * 列出全局回收站项目（跨服务器）
   */
  async listGlobalTrash(filters?: GlobalTrashFilters): Promise<GlobalTrashListResponse> {
    const params = new URLSearchParams()
    if (filters?.server_id) params.set("server_id", filters.server_id)
    if (filters?.parent_dir) params.set("parent_dir", filters.parent_dir)
    if (filters?.status) params.set("status", filters.status)
    if (filters?.limit) params.set("limit", filters.limit.toString())
    if (filters?.offset) params.set("offset", filters.offset.toString())

    const queryString = params.toString()
    const url = `/sftp/trash/items${queryString ? `?${queryString}` : ""}`
    return apiFetch<GlobalTrashListResponse>(url)
  },

  /**
   * 恢复全局回收站项目（通过 item_id）
   */
  async restoreGlobalTrashItem(itemId: string, renameIfExists: boolean = false): Promise<{ message: string; restored_path: string }> {
    return apiFetch<{ message: string; restored_path: string }>(`/sftp/trash/items/${itemId}/restore`, {
      method: "POST",
      body: { rename_if_exists: renameIfExists },
    })
  },

  /**
   * 永久删除全局回收站项目（通过 item_id）
   */
  async purgeGlobalTrashItem(itemId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/sftp/trash/items/${itemId}`, {
      method: "DELETE",
      retry: false,
    })
  },

  /**
   * 批量清空回收站
   */
  async emptyGlobalTrash(opts?: {
    server_id?: string
    parent_dir?: string
    older_than_hours?: number
    max_deletes?: number
  }): Promise<{ message: string; deleted_count: number }> {
    return apiFetch<{ message: string; deleted_count: number }>(`/sftp/trash/items/empty`, {
      method: "POST",
      body: {
        server_id: opts?.server_id,
        parent_dir: opts?.parent_dir,
        older_than_hours: opts?.older_than_hours ?? 0,
        max_deletes: opts?.max_deletes ?? 500,
      },
      retry: false,
      timeout: 300000,
    })
  },

  // ============= 回收站设置 API =============

  /**
   * 获取用户回收站设置
   */
  async getTrashSettings(): Promise<TrashSettingsResponse> {
    return apiFetch<TrashSettingsResponse>(`/sftp/trash/settings`)
  },

  /**
   * 更新用户回收站设置
   */
  async updateTrashSettings(settings: TrashSettingsUpdate): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/sftp/trash/settings`, {
      method: "PUT",
      body: settings,
    })
  },

  /**
   * 重置用户回收站设置为默认值
   */
  async resetTrashSettings(): Promise<TrashSettingsResponse> {
    return apiFetch<TrashSettingsResponse>(`/sftp/trash/settings`, {
      method: "DELETE",
    })
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
