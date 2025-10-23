import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 反向代理配置 - 将 API 请求转发到后端服务
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      // WebSocket 连接（用于 SSH 终端）
      {
        source: "/ws/:path*",
        destination: `${apiUrl}/ws/:path*`,
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
  },

  // 实验性功能
  experimental: {
    // 启用部分预渲染
    ppr: false,
  },
};

export default nextConfig;
