#!/bin/bash

# 生成 TypeScript 类型定义（从 OpenAPI）

set -e

echo "🔄 生成 API 类型定义..."

if [ ! -f shared/openapi.yaml ]; then
    echo "⚠️  未找到 shared/openapi.yaml 文件"
    echo "请先创建 OpenAPI 规范文件"
    exit 1
fi

cd web

# 检查是否安装了 openapi-typescript
if ! pnpm list openapi-typescript >/dev/null 2>&1; then
    echo "📦 安装 openapi-typescript..."
    pnpm add -D openapi-typescript
fi

# 生成类型
echo "📝 生成 TypeScript 类型..."
pnpm exec openapi-typescript ../shared/openapi.yaml -o src/types/openapi.ts

echo "✅ 类型生成完成！"
