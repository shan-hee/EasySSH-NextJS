let csrfToken: string | null = null

export function getCSRFToken(): string | null {
  return csrfToken
}

export function clearCSRFToken() {
  csrfToken = null
}

export function updateCSRFTokenFromHeaders(headers: Headers, options: { trusted?: boolean } = {}): string | null {
  if (!options.trusted) {
    return csrfToken
  }

  const token = headers.get("X-CSRF-Token")
  if (token) {
    csrfToken = token
  }
  return csrfToken
}

export async function ensureCSRFToken(apiBase: string): Promise<string> {
  if (csrfToken) {
    return csrfToken
  }

  const response = await fetch(`${apiBase}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })

  updateCSRFTokenFromHeaders(response.headers, { trusted: true })
  if (!csrfToken && response.ok) {
    const json = await response.json().catch(() => null)
    const token =
      json && typeof json === "object" && "data" in json
        ? (json.data as { csrf_token?: string } | null)?.csrf_token
        : (json as { csrf_token?: string } | null)?.csrf_token
    if (token) {
      csrfToken = token
    }
  }

  if (!csrfToken) {
    throw new Error("Missing CSRF token")
  }

  return csrfToken
}
