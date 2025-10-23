#!/bin/bash

# EasySSH 初始化脚本

set -e

echo "🔧 EasySSH 项目初始化..."

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查必要工具
echo -e "${BLUE}检查环境依赖...${NC}"

command -v node >/dev/null 2>&1 || { echo -e "${YELLOW}❌ Node.js 未安装${NC}"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${YELLOW}❌ pnpm 未安装，请运行: npm install -g pnpm${NC}"; exit 1; }
command -v go >/dev/null 2>&1 || { echo -e "${YELLOW}⚠️  Go 未安装，后端功能将不可用${NC}"; }
command -v docker >/dev/null 2>&1 || { echo -e "${YELLOW}⚠️  Docker 未安装，数据库功能将不可用${NC}"; }

# 安装前端依赖
echo -e "${BLUE}📦 安装前端依赖...${NC}"
cd web
pnpm install
cd ..

# 安装后端依赖
if command -v go >/dev/null 2>&1; then
    echo -e "${BLUE}📦 安装后端依赖...${NC}"
    cd server
    go mod download
    go mod tidy
    cd ..
fi

# 复制环境变量模板
if [ ! -f web/.env.local ]; then
    echo -e "${BLUE}📝 创建环境变量文件...${NC}"
    cp web/.env.example web/.env.local
    echo -e "${YELLOW}⚠️  请编辑 web/.env.local 配置环境变量${NC}"
fi

# 创建 go.sum 如果不存在
if [ -f server/go.mod ] && [ ! -f server/go.sum ]; then
    cd server
    go mod download
    cd ..
fi

echo -e "\n${GREEN}✅ 初始化完成！${NC}"
echo -e "${BLUE}运行 './scripts/dev.sh' 启动开发环境${NC}"
