import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { join } from "path";

const isProd = process.env.NODE_ENV === "production";

// 读取 VERSION 文件
let version = "1.0.0"; // 默认版本
try {
  const versionPath = join(__dirname, "..", "VERSION");
  version = readFileSync(versionPath, "utf-8").trim();
} catch {
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


  // 静态导出不支持图片优化
  images: {
    unoptimized: true,
  },

};

export default nextConfig;
