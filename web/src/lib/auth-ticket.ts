import { apiFetch } from "@/lib/api-client"

export type AuthTicketType =
  | "ws_terminal"
  | "ws_monitor"
  | "ws_sftp_upload"
  | "ws_sftp_transfer"
  | "sftp_download"
  | "sftp_batch_download"

export interface CreateTicketInput {
  type: AuthTicketType
  server_id?: string
  task_id?: string
  path?: string
  paths?: string[]
  mode?: string
  exclude_patterns?: string[]
}

export interface CreateTicketOutput {
  ticket: string
  expires_in: number
}

export async function createAuthTicket(input: CreateTicketInput): Promise<CreateTicketOutput> {
  return apiFetch<CreateTicketOutput>("/auth/ticket", {
    method: "POST",
    body: input,
    retry: false,
    timeout: 10000,
  })
}
