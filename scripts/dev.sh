#!/usr/bin/env bash

# EasySSH 开发环境启动脚本
# 启动前端和后端服务，数据库配置从 .env 读取

set -euo pipefail

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 启动 EasySSH 开发环境...${NC}\n"

# 加载环境变量
if [ -f ".env" ]; then
    set -a  # 自动导出所有变量
    source <(grep -v '^#' .env | grep -v '^$' | grep '=')
    set +a  # 关闭自动导出
fi

# 设置默认端口（如果环境变量未设置）
BACKEND_PORT=${PORT:-8521}
FRONTEND_PORT=${WEB_PORT:-8520}

# 函数：检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查必需的工具
if ! command_exists go; then
    echo -e "${RED}❌ 错误: Go 未安装，请先安装 Go 1.21+${NC}"
    exit 1
fi

if ! command_exists pnpm; then
    echo -e "${RED}❌ 错误: pnpm 未安装，请先安装 pnpm${NC}"
    echo -e "${YELLOW}   运行: npm install -g pnpm${NC}"
    exit 1
fi

# 检查 Air 是否存在
AIR_PATH=""
if command_exists air; then
    AIR_PATH="air"
elif [ -f "/root/go/bin/air" ]; then
    AIR_PATH="/root/go/bin/air"
elif [ -f "$HOME/go/bin/air" ]; then
    AIR_PATH="$HOME/go/bin/air"
else
    echo -e "${YELLOW}⚠️  Air 未安装，将自动安装热重载工具${NC}"
    go install github.com/air-verse/air@latest
    if [ -f "/root/go/bin/air" ]; then
        AIR_PATH="/root/go/bin/air"
    elif [ -f "$HOME/go/bin/air" ]; then
        AIR_PATH="$HOME/go/bin/air"
    else
        echo -e "${RED}❌ 错误: Air 安装失败${NC}"
        echo -e "${YELLOW}   请手动运行: go install github.com/air-verse/air@latest${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Air 安装成功${NC}"
fi

# 检查后端配置文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env 文件不存在${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ 已从 .env.example 创建 .env${NC}"
    else
        echo -e "${RED}❌ 错误: .env.example 文件不存在${NC}"
        exit 1
    fi
fi

# 开发环境：按需更新 .env 关键参数（可重复执行，幂等修改）
echo -e "${BLUE}🔧 写入开发环境建议参数到 .env...${NC}"

# 安全的 key=value 更新函数
set_kv() {
  local key="$1"; shift
  local val="$1"; shift || true
  if grep -qE "^${key}=" .env 2>/dev/null; then
    # 使用 # 作为 sed 分隔，避免 URL 中的 /
    sed -i "s#^${key}=.*#${key}=${val}#" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

# 1) 基本运行模式
set_kv ENV development

# 2) Cookie 策略（HTTP 开发环境推荐）
set_kv COOKIE_SECURE false
set_kv COOKIE_SAMESITE lax

# 3) API 基础地址（Next 重写 & SSR 使用）
set_kv NEXT_PUBLIC_API_BASE http://localhost:${BACKEND_PORT}

# 4) WS Origin 白名单（可选，明确本机前端端口）
if ! grep -qE '^ALLOWED_ORIGINS=' .env 2>/dev/null || [[ -z "${ALLOWED_ORIGINS:-}" ]]; then
  set_kv ALLOWED_ORIGINS http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}
fi

export ENV=development
export COOKIE_SECURE=false
export COOKIE_SAMESITE=lax

echo -e "${GREEN}✅ 已更新 .env。${NC}"
if [[ "${COOKIE_SECURE}" == "true" ]]; then
  echo -e "${YELLOW}⚠️  当前 COOKIE_SECURE=true 可能导致 HTTP 下 Cookie 被拒收，已建议写入 false。${NC}"
fi
# 检查前端依赖
if [ ! -d "web/node_modules" ]; then
    echo -e "${YELLOW}📦 安装前端依赖...${NC}"
    cd web
    pnpm install
    cd ..
    echo ""
fi

# 启动后端
echo -e "${GREEN}🔧 启动 Go 后端服务 (热重载模式)...${NC}"
cd server
$AIR_PATH &
SERVER_PID=$!
cd ..

# 等待后端完全启动并就绪
echo -e "${YELLOW}⏳ 等待后端服务完全启动...${NC}"
MAX_WAIT=60
WAIT_COUNT=0
BACKEND_READY=false

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # 检查后端进程是否还在运行
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${RED}❌ 后端启动失败，请检查数据库配置${NC}"
        exit 1
    fi

    # 检查后端端口是否就绪
    if command_exists curl; then
        if curl -s --connect-timeout 2 "http://localhost:${BACKEND_PORT}/api/v1/health" >/dev/null 2>&1 || \
           curl -s --connect-timeout 2 "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1 || \
           curl -s --connect-timeout 2 "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
            BACKEND_READY=true
            break
        fi
    elif command_exists nc; then
        if nc -z localhost ${BACKEND_PORT} 2>/dev/null; then
            # 再等待2秒确保服务完全就绪
            sleep 2
            BACKEND_READY=true
            break
        fi
    else
        # 如果没有 curl 或 nc，使用简单的时间等待
        if [ $WAIT_COUNT -ge 10 ]; then  # 等待10秒后认为后端已就绪
            BACKEND_READY=true
            break
        fi
    fi

    echo -n "."
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

echo ""

if [ "$BACKEND_READY" = true ]; then
    echo -e "${GREEN}✅ 后端服务已完全就绪 (等待了 ${WAIT_COUNT} 秒)${NC}\n"
else
    echo -e "${RED}❌ 后端启动超时 (等待了 ${MAX_WAIT} 秒)${NC}"
    echo -e "${YELLOW}请检查后端日志或手动启动后端服务${NC}"
    exit 1
fi

# 启动前端
echo -e "${GREEN}⚛️  启动 Next.js 前端...${NC}"
cd web
PORT=$FRONTEND_PORT pnpm dev &
WEB_PID=$!
cd ..

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}🛑 停止服务...${NC}"

    # 停止后端
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi

    # 停止前端
    if [ ! -z "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null || true
    fi

    echo -e "${GREEN}✅ 服务已停止${NC}"
}

# 捕获退出信号
trap cleanup EXIT INT TERM

# 保持脚本运行
wait
