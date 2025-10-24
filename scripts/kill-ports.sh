#!/bin/bash

# EasySSH 端口释放脚本
# 自动从 .env 文件读取端口配置并释放占用的进程

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 存储需要释放的端口
declare -a PORTS_TO_KILL

# 读取根目录的 .env 文件
ROOT_ENV="$PROJECT_ROOT/.env"
if [ -f "$ROOT_ENV" ]; then
    # 读取后端端口
    SERVER_PORT=$(grep "^PORT=" "$ROOT_ENV" | cut -d '=' -f2 | tr -d ' \r\n')
    if [ ! -z "$SERVER_PORT" ]; then
        PORTS_TO_KILL+=($SERVER_PORT)
    fi

    # 读取前端端口
    WEB_PORT=$(grep "^WEB_PORT=" "$ROOT_ENV" | cut -d '=' -f2 | tr -d ' \r\n')
    if [ ! -z "$WEB_PORT" ]; then
        PORTS_TO_KILL+=($WEB_PORT)
    fi
fi

# 去重
UNIQUE_PORTS=($(echo "${PORTS_TO_KILL[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))

echo -e "${YELLOW}释放端口: ${UNIQUE_PORTS[*]}${NC}"

# 释放端口
for port in "${UNIQUE_PORTS[@]}"; do
    pids=$(lsof -ti:$port 2>/dev/null || true)

    if [ ! -z "$pids" ]; then
        echo -e "${RED}杀死端口 ${port} 的进程${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✓ 端口 ${port} 已释放${NC}"
    else
        echo -e "${GREEN}✓ 端口 ${port} 未被占用${NC}"
    fi
done

echo -e "${GREEN}完成!${NC}"
