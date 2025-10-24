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

**开发环境**:
- Node.js 20+
- pnpm 9+
- Go 1.21+
- PostgreSQL 14+ 和 Redis 7+（或通过 Docker 运行）

**生产环境**（Docker 部署）:
- Docker 20+
- Docker Compose 2+

### 开发环境启动

#### 1. 配置数据库连接

编辑 `server/.env` 配置数据库连接：

```bash
cd server
cp .env.example .env
# 编辑 .env 文件，配置数据库信息
```

#### 2. 安装依赖

```bash
# 安装前端依赖
cd web
pnpm install

# 后端依赖会在运行时自动下载
```

#### 3. 启动服务

```bash
# 在项目根目录运行
./scripts/dev.sh
```

脚本会自动：
- ✅ 检查必需的工具（Go、pnpm）
- ✅ 检查配置文件是否存在
- ✅ 安装前端依赖（如果需要）
- ✅ 启动后端服务（端口 8521）
- ✅ 启动前端服务（端口 8520）

## 如果脚本无法运行，可以手动启动：
```bash
# 启动后端
cd server
make dev # 或者 go run cmd/api/main.go
```
```bash
# 启动前端
cd web
pnpm dev
```

#### 4. 访问应用

- **前端**: http://localhost:8520
- **后端 API**: http://localhost:8521

按 `Ctrl+C` 停止所有服务。

### 生产环境部署（Docker）

```bash
cd docker
docker compose up -d
```

**部署后访问**: http://your-server:8520

#### 自定义配置

编辑 `docker/docker-compose.yml` 修改以下配置：

1. **修改密码和密钥**（生产环境必改）:
```yaml
environment:
  DB_PASSWORD: your-secure-password        # 数据库密码
  JWT_SECRET: your-long-random-secret      # JWT 密钥
  ENCRYPTION_KEY: your-32-byte-key         # 加密密钥
```

2. **使用外部数据库**（可选）:
```yaml
environment:
  DB_HOST: your-postgres-host              # 外部 PostgreSQL 地址
  DB_PORT: 5432
  DB_USER: your-username
  DB_PASSWORD: your-password
  DB_NAME: your-database
  REDIS_HOST: your-redis-host              # 外部 Redis 地址
  REDIS_PORT: 6379
  REDIS_PASSWORD: your-redis-password
```

如果使用外部数据库，可以注释掉 `docker-compose.yml` 中的 `postgres` 和 `redis` 服务。

#### 常用命令

```bash
# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看状态
docker compose ps
```

#### 数据持久化

数据存储在 `docker/data/` 目录：
- `data/postgres/` - PostgreSQL 数据
- `data/redis/` - Redis 数据

**备份数据**:
```bash
# 备份整个 data 目录
tar -czf easyssh-backup-$(date +%Y%m%d).tar.gz data/
```

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

## 环境变量配置

### 前端 (web/.env.local)

```bash
# API 地址
NEXT_PUBLIC_API_URL=http://localhost:8521/api/v1

# AI 配置（可选）
OPENAI_API_KEY=your_api_key
```

### 后端 (server/.env)

```bash
# 服务器配置
PORT=8521
ENV=development
ENCRYPTION_KEY=easyssh-encryption-key-32bytes!!

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=easyssh
DB_PASSWORD=easyssh_dev_password
DB_NAME=easyssh
DB_SSLMODE=disable
DB_DEBUG=true

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT 配置
JWT_SECRET=easyssh-secret-change-in-production
JWT_ACCESS_EXPIRE_HOURS=1
JWT_REFRESH_EXPIRE_HOURS=168
```

**注意**: 生产环境请务必修改 `JWT_SECRET` 和 `ENCRYPTION_KEY`！

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
