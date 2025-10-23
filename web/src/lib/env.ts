export const env = {
  // 优先使用 NEXT_PUBLIC_API_URL，如果没有则使用 NEXT_PUBLIC_API_BASE_URL，最后默认为 /api
  apiBaseUrl: (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "/api"
  ).toString(),
}

