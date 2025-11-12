import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 注意：HTTP API 和 WebSocket 代理已由 Nginx 统一处理
  // - HTTP API: 通过 Route Handler (app/api/[...path]/route.ts) 转发到后端
  // - WebSocket: 通过 Nginx 直接代理到后端

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
