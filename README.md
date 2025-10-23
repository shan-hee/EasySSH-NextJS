# EasySSH

现代化的 SSH 管理平台，提供直观的 Web 界面进行远程服务器管理。

## 项目架构

```
EasySSH-NextJS/
├── web/                    # Next.js 前端应用
├── server/                 # Go 后端服务
├── shared/                 # 共享资源（OpenAPI 规范等）
├── docker/                 # Docker 配置
├── scripts/                # 自动化脚本
└── docs/                   # 项目文档
```

## 技术栈

### 前端
- **框架**: Next.js 15.5.4 (App Router) + React 19.1.0
- **UI**: Radix UI + Shadcn/ui + Tailwind CSS 4.x
- **特性组件**:
  - xterm.js - 终端模拟器
  - Monaco Editor - 代码编辑器
- **AI集成**: Vercel AI SDK

### 后端
- **语言**: Go 1.21+
- **框架**: Gin + GORM
- **数据存储**: PostgreSQL 14+ / Redis 7+
- **SSH管理**: golang.org/x/crypto/ssh

## 快速开始

### 前置要求
- Node.js 20+
- pnpm 9+
- Go 1.21+ (可选，后端开发需要)
- Docker & Docker Compose (可选，本地开发推荐)

### 1. 初始化项目

```bash
# 安装依赖并配置环境
./scripts/setup.sh
```

### 2. 启动开发环境

#### 方式 A: 使用一键脚本（推荐）
```bash
# 同时启动前后端和基础设施服务
./scripts/dev.sh
```

#### 方式 B: 手动启动

```bash
# 1. 启动基础设施（PostgreSQL + Redis）
docker-compose -f docker/docker-compose.dev.yml up -d

# 2. 启动后端
cd server
go run cmd/api/main.go

# 3. 启动前端（新终端）
cd web
pnpm dev
```

### 3. 访问应用

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8080
- **数据库**: postgresql://easyssh:easyssh_dev_password@localhost:5432/easyssh
- **Redis**: redis://localhost:6379

## 项目结构详解

### Web 目录（前端）

```
web/
├── src/
│   ├── app/                # App Router 页面
│   │   ├── (auth)/        # 认证相关页面组
│   │   └── dashboard/     # 主应用界面
│   ├── components/        # React 组件
│   │   ├── ui/           # shadcn/ui 基础组件
│   │   ├── terminal/     # xterm.js 终端组件
│   │   └── editor/       # Monaco 编辑器组件
│   ├── lib/              # 工具函数
│   ├── hooks/            # React Hooks
│   ├── contexts/         # React Contexts
│   └── types/            # TypeScript 类型定义
├── public/               # 静态资源
└── package.json
```

### Server 目录（后端）

```
server/
├── cmd/api/              # 应用入口
├── internal/             # 内部代码
│   ├── api/             # HTTP/WebSocket 处理器
│   │   ├── rest/        # RESTful APIs
│   │   └── ws/          # WebSocket (SSH)
│   ├── domain/          # 业务领域
│   │   ├── server/      # 服务器管理
│   │   ├── ssh/         # SSH 连接池
│   │   └── auth/        # 认证授权
│   ├── infra/           # 基础设施
│   │   ├── db/          # PostgreSQL
│   │   ├── cache/       # Redis
│   │   └── config/      # 配置管理
│   └── pkg/             # 内部共享包
├── migrations/          # 数据库迁移
├── go.mod
└── Makefile
```

## 开发指南

### 前端开发

```bash
cd web

# 开发模式
pnpm dev

# 构建
pnpm build

# 代码检查
pnpm lint

# 生成 API 类型（从 OpenAPI）
pnpm openapi:gen
```

### 后端开发

```bash
cd server

# 运行开发服务器
make dev

# 或直接运行
go run cmd/api/main.go

# 构建
make build

# 运行测试
make test
```

### API 类型同步

当修改 `shared/openapi.yaml` 后，运行以下命令同步类型定义：

```bash
./scripts/gen-types.sh
```

## Docker 部署

### 生产环境部署

```bash
# 构建并启动所有服务
docker-compose -f docker/docker-compose.yml up -d

# 查看日志
docker-compose -f docker/docker-compose.yml logs -f

# 停止服务
docker-compose -f docker/docker-compose.yml down
```

### 仅启动基础设施

```bash
# 用于本地开发，只启动数据库和 Redis
docker-compose -f docker/docker-compose.dev.yml up -d
```

## 环境变量

### 前端 (web/.env.local)

```bash
# API 地址
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1

# AI 配置（可选）
OPENAI_API_KEY=your_api_key
```

### 后端 (server/.env)

```bash
# 数据库
DATABASE_URL=postgresql://easyssh:password@localhost:5432/easyssh?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379/0

# 服务配置
GIN_MODE=debug
PORT=8080
```

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

```
Copyright 2024 EasySSH Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## 支持

如有问题，请提交 [Issue](https://github.com/your-repo/issues)。
