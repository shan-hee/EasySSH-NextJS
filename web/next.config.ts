import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { join } from "path";

const isProd = process.env.NODE_ENV === "production";

// 读取 VERSION 文件
let version = "1.0.0"; // 默认版本
try {
  const versionPath = join(__dirname, "..", "VERSION");
  version = readFileSync(versionPath, "utf-8").trim();
} catch (error) {
  console.warn("无法读取 VERSION 文件，使用默认版本:", version);
}

// 生成构建日期（UTC 时区的 ISO 格式）
// 前端会根据系统配置的时区动态转换显示
const buildDate = new Date().toISOString();

const nextConfig: NextConfig = {
  // 注入版本号和构建日期到环境变量
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
  // 生产环境：纯 CSR 静态导出模式
  // 开发环境：使用默认配置
  ...(isProd && {
    output: "export",
    trailingSlash: true,
  }),

  // 开发环境自定义响应头：支持 Google OAuth
  // 注意：静态导出模式下 headers 不生效，因此仅在开发环境启用
  ...(!isProd && {
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Cross-Origin-Opener-Policy",
              value: "unsafe-none",
            },
            {
              key: "Cross-Origin-Embedder-Policy",
              value: "unsafe-none",
            },
          ],
        },
      ]
    },
  }),

  // 静态导出不支持图片优化
  images: {
    unoptimized: true,
  },

  // TypeScript 配置：在构建时忽略类型错误
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
