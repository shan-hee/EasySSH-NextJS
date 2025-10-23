#!/bin/bash

# EasySSH 开发环境启动脚本

set -e

echo "🚀 启动 EasySSH 开发环境..."

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

# 启动基础设施服务（PostgreSQL + Redis）
echo -e "${BLUE}📦 启动基础设施服务...${NC}"
docker-compose -f docker/docker-compose.dev.yml up -d

# 等待服务就绪
echo -e "${BLUE}⏳ 等待数据库就绪...${NC}"
sleep 5

# 启动后端
echo -e "${GREEN}🔧 启动 Go 后端服务 (http://localhost:8080)...${NC}"
cd server
go run cmd/api/main.go &
SERVER_PID=$!
cd ..

# 启动前端
echo -e "${GREEN}⚛️  启动 Next.js 前端 (http://localhost:3000)...${NC}"
cd web
pnpm dev &
WEB_PID=$!
cd ..

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}🛑 停止服务...${NC}"
    kill $SERVER_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    docker-compose -f docker/docker-compose.dev.yml down
    echo -e "${GREEN}✅ 服务已停止${NC}"
}

# 捕获退出信号
trap cleanup EXIT INT TERM

echo -e "\n${GREEN}✅ 开发环境启动完成！${NC}"
echo -e "${BLUE}前端: http://localhost:3000${NC}"
echo -e "${BLUE}后端: http://localhost:8080${NC}"
echo -e "${BLUE}数据库: postgresql://easyssh:easyssh_dev_password@localhost:5432/easyssh${NC}"
echo -e "${BLUE}Redis: redis://localhost:6379${NC}"
echo -e "\n${YELLOW}按 Ctrl+C 停止所有服务${NC}\n"

# 保持脚本运行
wait
