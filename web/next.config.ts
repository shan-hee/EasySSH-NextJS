import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 反向代理配置 - 将 API 请求转发到后端服务
  async rewrites() {
    // 后端服务地址（统一使用 NEXT_PUBLIC_API_BASE）
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8521";

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      // WebSocket 连接（用于 SSH 终端）
      {
        source: "/ws/:path*",
        destination: `${backendUrl}/ws/:path*`,
      },
    ];
  },

  // 静态资源缓存配置
  async headers() {
    return [
      {
        // 匹配所有静态资源
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // 缓存1年
          },
        ],
      },
      {
        // logo 和 favicon 特殊处理
        source: "/(logo.svg|icon.svg|favicon.ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, must-revalidate", // 缓存24小时
          },
        ],
      },
      // 上传的文件静态资源
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // 缓存1年
          },
        ],
      },
    ];
  },

  // 生产环境优化
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,

  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // 允许优化 SVG
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 实验性功能
  experimental: {
    // 启用部分预渲染
    ppr: false,
  },
};

export default nextConfig;
