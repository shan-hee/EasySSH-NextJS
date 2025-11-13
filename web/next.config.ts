import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // 生产环境：纯 CSR 静态导出模式
  // 开发环境：使用默认配置
  ...(isProd && {
    output: "export",
    distDir: "../server/static",
    trailingSlash: true,
  }),

  // 静态导出不支持图片优化
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
