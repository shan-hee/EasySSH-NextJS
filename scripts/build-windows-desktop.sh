#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
RESOURCE_DIR="$SERVER_DIR/cmd/desktop/resources"
ICON_SOURCE="$ROOT_DIR/web/public/favicon.ico"
RC_FILE="$SERVER_DIR/cmd/desktop/windows.rc"
SYSO_FILE="$SERVER_DIR/cmd/desktop/windows.syso"
VERSION="$(tr -d '[:space:]' < "$ROOT_DIR/VERSION")"
OUTPUT_FILE="${1:-$SERVER_DIR/bin/easyssh-desktop-v${VERSION}-windows-amd64.exe}"
ZIP_FILE="${OUTPUT_FILE%.exe}.zip"

if ! command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
  echo "错误: 未找到 x86_64-w64-mingw32-gcc，无法交叉编译 Windows 版本"
  exit 1
fi

if ! command -v x86_64-w64-mingw32-windres >/dev/null 2>&1; then
  echo "错误: 未找到 x86_64-w64-mingw32-windres，无法生成 Windows 图标资源"
  exit 1
fi

if [ ! -f "$ICON_SOURCE" ]; then
  echo "错误: 未找到图标文件 $ICON_SOURCE"
  exit 1
fi

mkdir -p "$RESOURCE_DIR" "$(dirname "$OUTPUT_FILE")"
cp "$ICON_SOURCE" "$RESOURCE_DIR/easyssh.ico"
trap 'rm -f "$SYSO_FILE"' EXIT

cat >"$RC_FILE" <<'RC'
3 ICON "resources/easyssh.ico"
RC

(
  cd "$SERVER_DIR/cmd/desktop"
  x86_64-w64-mingw32-windres \
    -i "$(basename "$RC_FILE")" \
    -O coff \
    -o "$(basename "$SYSO_FILE")"
)

(
  cd "$SERVER_DIR"
  GOOS=windows GOARCH=amd64 CGO_ENABLED=1 CC=x86_64-w64-mingw32-gcc \
    go build -tags production -ldflags="-s -w -H windowsgui -X main.version=${VERSION}" -o "$OUTPUT_FILE" ./cmd/desktop
)

if command -v zip >/dev/null 2>&1; then
  (
    cd "$(dirname "$OUTPUT_FILE")"
    rm -f "$(basename "$ZIP_FILE")"
    zip -q "$(basename "$ZIP_FILE")" "$(basename "$OUTPUT_FILE")"
  )
  echo "Windows 桌面端压缩包已生成: $ZIP_FILE"
else
  echo "提示: 未找到 zip，跳过压缩包生成"
fi

echo "Windows 桌面端已构建: $OUTPUT_FILE"
