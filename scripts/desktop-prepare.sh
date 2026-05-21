#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_OUT_DIR="$ROOT_DIR/web/out"
DESKTOP_EXPORT_DIR="$ROOT_DIR/server/cmd/desktop/assets/export"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if ! command_exists node; then
  echo "错误: Node.js 未安装，请先安装 Node.js 24+"
  exit 1
fi

if ! command_exists pnpm; then
  echo "错误: pnpm 未安装，请先安装 pnpm 11+"
  echo "建议运行: corepack enable && corepack prepare pnpm@11.1.3 --activate"
  exit 1
fi

if [ ! -d "$ROOT_DIR/web/node_modules" ]; then
  echo "安装前端依赖..."
  (cd "$ROOT_DIR/web" && pnpm install)
fi

echo "构建 Next.js 静态资源..."
(cd "$ROOT_DIR/web" && pnpm build)

if [ ! -f "$WEB_OUT_DIR/index.html" ]; then
  echo "错误: 未找到 $WEB_OUT_DIR/index.html"
  exit 1
fi

rm -rf "$DESKTOP_EXPORT_DIR"
mkdir -p "$DESKTOP_EXPORT_DIR"
cp -R "$WEB_OUT_DIR"/. "$DESKTOP_EXPORT_DIR"/

echo "桌面端静态资源已更新: $DESKTOP_EXPORT_DIR"
