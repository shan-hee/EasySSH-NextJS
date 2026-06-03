/// <reference types="vite/client" />

declare const process: {
  env: {
    NODE_ENV?: string
    NEXT_PUBLIC_BACKEND_URL?: string
    NEXT_PUBLIC_WS_HOST?: string
    [key: string]: string | undefined
  }
}

declare namespace NodeJS {
  type Timeout = ReturnType<typeof setTimeout>
}
