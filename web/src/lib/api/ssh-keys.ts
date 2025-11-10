import { apiFetch } from "@/lib/api-client"

export interface SSHKey {
  id: number
  created_at: string
  user_id: number
  name: string
  public_key: string
  fingerprint: string
  algorithm: string
  key_size?: number
}

export interface SSHKeyWithPrivateKey extends SSHKey {
  private_key: string // 仅在生成/导入时返回
}

export interface GenerateSSHKeyRequest {
  name: string
  algorithm: "rsa" | "ed25519"
  key_size?: number // 仅RSA需要，默认2048
}

export interface ImportSSHKeyRequest {
  name: string
  private_key: string
}

/**
 * 获取当前用户的SSH密钥列表
 */
export async function getSSHKeys(): Promise<SSHKey[]> {
  return apiFetch<SSHKey[]>("/ssh-keys")
}

/**
 * 生成新的SSH密钥对
 */
export async function generateSSHKey(
  data: GenerateSSHKeyRequest
): Promise<SSHKeyWithPrivateKey> {
  return apiFetch<SSHKeyWithPrivateKey>("/ssh-keys/generate", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/**
 * 导入已有的SSH密钥
 */
export async function importSSHKey(
  data: ImportSSHKeyRequest
): Promise<SSHKeyWithPrivateKey> {
  return apiFetch<SSHKeyWithPrivateKey>("/ssh-keys/import", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

/**
 * 删除SSH密钥
 */
export async function deleteSSHKey(id: number): Promise<void> {
  await apiFetch(`/ssh-keys/${id}`, {
    method: "DELETE",
  })
}
