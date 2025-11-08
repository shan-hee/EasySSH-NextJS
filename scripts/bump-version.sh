#!/bin/bash

# EasySSH 版本号管理脚本
# 用于统一更新前后端版本号

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 检查参数
if [ -z "$1" ]; then
  echo -e "${RED}❌ 错误: 请提供版本号${NC}"
  echo -e "${YELLOW}用法: $0 <version>${NC}"
  echo -e "${YELLOW}示例: $0 1.0.1${NC}"
  exit 1
fi

VERSION=$1

# 验证版本号格式 (x.y.z)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo -e "${RED}❌ 错误: 版本号格式不正确${NC}"
  echo -e "${YELLOW}格式应为: x.y.z (例如: 1.0.1)${NC}"
  exit 1
fi

echo -e "${BLUE}🚀 更新版本号到: ${VERSION}${NC}\n"

# 1. 更新 VERSION 文件
echo -e "${YELLOW}📝 更新 VERSION 文件...${NC}"
echo "$VERSION" > "$PROJECT_ROOT/VERSION"
echo -e "${GREEN}✅ VERSION 文件已更新${NC}\n"

# 2. 更新 web/package.json (可选)
if [ -f "$PROJECT_ROOT/web/package.json" ]; then
  echo -e "${YELLOW}📝 更新 web/package.json...${NC}"
  cd "$PROJECT_ROOT/web"

  # 使用 npm version 命令更新版本号（不创建 git tag）
  if command -v npm >/dev/null 2>&1; then
    npm version "$VERSION" --no-git-tag-version --allow-same-version
    echo -e "${GREEN}✅ web/package.json 已更新${NC}\n"
  else
    echo -e "${YELLOW}⚠️  npm 未安装，跳过 package.json 更新${NC}\n"
  fi

  cd "$PROJECT_ROOT"
fi

# 3. 显示变更
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📋 变更摘要:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
git diff VERSION web/package.json 2>/dev/null || true
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 4. 询问是否提交
echo -e "${YELLOW}是否提交并推送这些变更? (y/n)${NC}"
read -r CONFIRM

if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
  echo -e "\n${YELLOW}📦 提交变更...${NC}"

  # 添加文件
  git add VERSION
  if [ -f "$PROJECT_ROOT/web/package.json" ]; then
    git add web/package.json
  fi

  # 提交
  git commit -m "chore: bump version to $VERSION"

  echo -e "${GREEN}✅ 变更已提交${NC}\n"

  # 询问是否推送
  echo -e "${YELLOW}是否推送到远程仓库? (y/n)${NC}"
  read -r PUSH_CONFIRM

  if [ "$PUSH_CONFIRM" = "y" ] || [ "$PUSH_CONFIRM" = "Y" ]; then
    echo -e "\n${YELLOW}🚀 推送到远程仓库...${NC}"
    git push
    echo -e "${GREEN}✅ 已推送到远程仓库${NC}\n"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🎉 版本号更新完成！${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📌 新版本: ${VERSION}${NC}"
    echo -e "${YELLOW}🔨 GitHub Actions 将自动构建以下镜像:${NC}"
    echo -e "   - shanheee/easyssh-backend:v${VERSION}"
    echo -e "   - shanheee/easyssh-backend:latest"
    echo -e "   - shanheee/easyssh-frontend:v${VERSION}"
    echo -e "   - shanheee/easyssh-frontend:latest"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    echo -e "${YELLOW}💡 查看构建进度:${NC}"
    echo -e "   https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions\n"
  else
    echo -e "${YELLOW}⏭️  跳过推送${NC}\n"
    echo -e "${BLUE}💡 稍后可以手动推送:${NC}"
    echo -e "   git push\n"
  fi
else
  echo -e "${YELLOW}⏭️  跳过提交${NC}\n"
  echo -e "${BLUE}💡 稍后可以手动提交:${NC}"
  echo -e "   git add VERSION web/package.json"
  echo -e "   git commit -m \"chore: bump version to $VERSION\""
  echo -e "   git push\n"
fi

echo -e "${GREEN}✨ 完成！${NC}"
