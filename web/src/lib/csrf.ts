let csrfToken: string | null = null

export function getCSRFToken(): string | null {
  return csrfToken
}

export function updateCSRFTokenFromHeaders(headers: Headers): string | null {
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

  const response = await fetch(`${apiBase}/auth/status`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })

  updateCSRFTokenFromHeaders(response.headers)
  if (!csrfToken) {
    throw new Error("Missing CSRF token")
  }

  return csrfToken
}

