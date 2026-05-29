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

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

get_port_pids() {
    local port="$1"

    {
        if command_exists ss; then
            ss -H -ltnp "sport = :${port}" 2>/dev/null \
                | grep -oE 'pid=[0-9]+' \
                | cut -d '=' -f2 || true
        fi

        if command_exists lsof; then
            lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
        fi
    } | awk '/^[0-9]+$/ { print }' | sort -u
}

collect_child_pids() {
    local pid="$1"
    local child=""

    echo "$pid"
    if command_exists pgrep; then
        while read -r child; do
            [ -n "$child" ] && collect_child_pids "$child"
        done < <(pgrep -P "$pid" 2>/dev/null || true)
    fi
}

expand_pids_with_children() {
    local pid=""

    for pid in "$@"; do
        collect_child_pids "$pid"
    done | awk '/^[0-9]+$/ { print }' | sort -u
}

get_url_port() {
    local url="$1"
    local host_port="$url"
    if [[ "$host_port" == *"://"* ]]; then
        host_port="${host_port#*://}"
    fi
    host_port="${host_port%%/*}"
    host_port="${host_port%%\?*}"
    host_port="${host_port%%\#*}"

    local port=""
    if [[ "$host_port" =~ ^\[.*\]:([0-9]+)$ ]]; then
        port="${BASH_REMATCH[1]}"
    elif [[ "$host_port" =~ :([0-9]+)$ ]]; then
        port="${BASH_REMATCH[1]}"
    fi

    if [[ -n "$port" && "$port" -ge 1 && "$port" -le 65535 ]]; then
        echo "$port"
    else
        echo "8520"
    fi
}

# 读取根目录的 .env 文件
ROOT_ENV="$PROJECT_ROOT/.env"
if [ -f "$ROOT_ENV" ]; then
    # 从后端服务地址读取端口
    BACKEND_URL=$(grep "^NEXT_PUBLIC_BACKEND_URL=" "$ROOT_ENV" | cut -d '=' -f2- | tr -d ' "\r\n')
    SERVER_PORT=$(get_url_port "${BACKEND_URL:-http://localhost:8520}")
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
    mapfile -t pids < <(get_port_pids "$port")

    if [ "${#pids[@]}" -gt 0 ]; then
        mapfile -t kill_pids < <(expand_pids_with_children "${pids[@]}")
        echo -e "${RED}杀死端口 ${port} 的进程: ${kill_pids[*]}${NC}"
        kill "${kill_pids[@]}" 2>/dev/null || true
        sleep 1

        mapfile -t alive_pids < <(get_port_pids "$port")
        if [ "${#alive_pids[@]}" -gt 0 ]; then
            kill -9 "${alive_pids[@]}" 2>/dev/null || true
        fi

        mapfile -t alive_pids < <(get_port_pids "$port")
        if [ "${#alive_pids[@]}" -gt 0 ]; then
            echo -e "${RED}✗ 端口 ${port} 仍被占用: ${alive_pids[*]}${NC}"
        else
            echo -e "${GREEN}✓ 端口 ${port} 已释放${NC}"
        fi
    else
        echo -e "${GREEN}✓ 端口 ${port} 未被占用${NC}"
    fi
done

echo -e "${GREEN}完成!${NC}"
