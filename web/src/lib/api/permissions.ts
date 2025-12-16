import { apiFetch } from "@/lib/api-client"
import type { UserRole } from "./users"

export type PermissionModule = "server" | "file" | "terminal" | "audit" | "system"

export interface Permission {
  id: string
  name: string
  code: string
  description: string
  module: PermissionModule
  roles: UserRole[]
  created_at: string
  updated_at?: string
}

export interface PermissionListResponse {
  data: Permission[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface CreatePermissionRequest {
  name: string
  code: string
  description: string
  module: PermissionModule
  roles: UserRole[]
}

export type UpdatePermissionRequest = CreatePermissionRequest

export const permissionsApi = {
  async list(params?: { page?: number; limit?: number; module?: string; q?: string }): Promise<PermissionListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.module) queryParams.append("module", params.module)
    if (params?.q) queryParams.append("q", params.q)
    const query = queryParams.toString()
    return apiFetch<PermissionListResponse>(`/permissions${query ? `?${query}` : ""}`)
  },

  async create(data: CreatePermissionRequest): Promise<{ data: Permission; message: string }> {
    return apiFetch<{ data: Permission; message: string }>(`/permissions`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: UpdatePermissionRequest): Promise<{ data: Permission; message: string }> {
    return apiFetch<{ data: Permission; message: string }>(`/permissions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  async delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/permissions/${id}`, {
      method: "DELETE",
    })
  },
}
