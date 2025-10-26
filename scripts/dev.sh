#!/bin/bash

# EasySSH 开发环境启动脚本
# 启动前端和后端服务，数据库配置从 .env 读取

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 启动 EasySSH 开发环境...${NC}\n"

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
    go install github.com/cosmtrek/air@latest
    if [ -f "/root/go/bin/air" ]; then
        AIR_PATH="/root/go/bin/air"
    elif [ -f "$HOME/go/bin/air" ]; then
        AIR_PATH="$HOME/go/bin/air"
    else
        echo -e "${RED}❌ 错误: Air 安装失败${NC}"
        echo -e "${YELLOW}   请手动运行: go install github.com/cosmtrek/air@latest${NC}"
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
        echo -e "${YELLOW}⚠️  请编辑 .env 文件，配置您的数据库信息${NC}"
        echo -e "${YELLOW}   配置完成后重新运行此脚本${NC}\n"
        exit 1
    else
        echo -e "${RED}❌ 错误: .env.example 文件不存在${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ 配置文件检查通过${NC}\n"

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

# 等待后端启动
sleep 3

# 检查后端是否成功启动
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}❌ 后端启动失败，请检查数据库配置${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 后端启动成功${NC}\n"

# 启动前端
echo -e "${GREEN}⚛️  启动 Next.js 前端...${NC}"
cd web
pnpm dev &
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

echo ""
echo -e "${GREEN}✅ 开发环境启动完成！${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}前端:${NC}    http://localhost:8520"
echo -e "${GREEN}后端:${NC}    http://localhost:8521"
echo -e "${GREEN}配置:${NC}   使用根目录 .env 中的配置"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${YELLOW}按 Ctrl+C 停止所有服务${NC}\n"

# 保持脚本运行
wait
