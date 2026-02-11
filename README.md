<div align="center">

# EasySSH

**现代化的 SSH 管理平台**

提供直观的 Web 界面进行远程服务器管理，支持终端模拟、文件传输、系统监控等功能

[![Docker Image Version](https://img.shields.io/docker/v/shanheee/easyssh?label=Docker&logo=docker&sort=semver)](https://hub.docker.com/r/shanheee/easyssh)
[![Docker Image Size](https://img.shields.io/docker/image-size/shanheee/easyssh/latest?logo=docker)](https://hub.docker.com/r/shanheee/easyssh)
[![Docker Pulls](https://img.shields.io/docker/pulls/shanheee/easyssh?logo=docker)](https://hub.docker.com/r/shanheee/easyssh)
[![Build Status](https://img.shields.io/github/actions/workflow/status/shan-hee/EasySSH-NextJS/docker-build.yml?branch=main&logo=github)](https://github.com/shan-hee/EasySSH-NextJS/actions)
[![License](https://img.shields.io/github/license/shan-hee/EasySSH-NextJS)](LICENSE)

[快速开始](#快速开始) • [功能特性](#功能特性) • [技术栈](#技术栈) • [部署指南](#生产环境部署docker) • [开发文档](#开发指南)

</div>

---

## 功能特性

- 🖥️ **Web 终端**：基于 xterm.js 的全功能终端模拟器，支持多标签页
- 📁 **文件管理**：SFTP 文件浏览、上传下载、在线编辑（Monaco Editor）
- 📊 **系统监控**：实时 CPU、内存、磁盘、网络监控（WebSocket）
- 🔐 **安全认证**：OAuth 2.0 + PKCE 授权流程，支持双因素认证（2FA）
- 🎨 **现代 UI**：基于 Radix UI + Tailwind CSS 的响应式界面
- 🐳 **容器化部署**：单容器部署，支持 amd64/arm64 架构
- 🤖 **AI 集成**：Vercel AI SDK 支持（可选）

## 技术栈

### 前端
- **框架**：Next.js 16 (App Router + 静态导出) + React 19
- **UI**：Radix UI + Shadcn/ui + Tailwind CSS 4.x
- **终端**：xterm.js
- **编辑器**：Monaco Editor

### 后端
- **语言**：Go 1.24+
- **框架**：Gin + GORM
- **数据库**：PostgreSQL 16+ / Redis 7+
- **SSH**：golang.org/x/crypto/ssh

### 架构设计

**纯 CSR 架构**：前端静态文件由 Go 后端托管，单容器部署

```
┌─────────────────────────────────────┐
│         Docker 容器                  │
│  ┌──────────────────────────────┐  │
│  │   Go 后端 (:8520)            │  │
│  │  ├─ API 服务                 │  │
│  │  ├─ WebSocket (SSH)          │  │
│  │  └─ 静态文件托管             │  │
│  └──────────────────────────────┘  │
│           ↓         ↓                │
│  ┌──────────┐  ┌──────────┐        │
│  │PostgreSQL│  │  Redis   │        │
│  └──────────┘  └──────────┘        │
└─────────────────────────────────────┘
```


## 快速开始

### 方式一：Docker 部署（推荐）

**使用 Docker Compose（包含数据库）**：

```bash
# 1. 下载配置文件
mkdir easyssh && cd easyssh
wget https://raw.githubusercontent.com/shan-hee/EasySSH-NextJS/main/docker/docker-compose.yml

# 2. 编辑配置（可选，修改端口、密码等）
vi docker-compose.yml

# 3. 启动服务
docker compose up -d

# 4. 访问应用
# http://your-server:8520
```

> 💡 **说明**：`docker-compose.yml` 包含默认配置和自动生成的安全密钥，可直接启动。如需自定义端口、密码等，请编辑配置文件。

**单容器部署**（需要外部数据库）：

```bash
docker run -d \
  --name easyssh \
  -p 8520:8520 \
  -e DB_HOST=your-postgres-host \
  -e DB_PORT=5432 \
  -e DB_USER=easyssh \
  -e DB_PASSWORD=your-secure-password \
  -e DB_NAME=easyssh_db \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e JWT_SECRET=$(openssl rand -base64 48) \
  -e ENCRYPTION_KEY=$(openssl rand -base64 24) \
  shanheee/easyssh:latest
```

**支持架构**：`linux/amd64`、`linux/arm64`

### 方式二：本地开发

**前置要求**：
- Node.js 20+ / pnpm 9+
- Go 1.24+
- PostgreSQL 16+ / Redis 7+

**一键启动**：

```bash
# 在项目根目录运行
./scripts/dev.sh
```

脚本会自动完成环境配置、依赖安装、服务启动（前端 :3000，后端 :8520）

**手动启动**：

```bash
# 后端（支持热重载）
cd server && make dev

# 前端
cd web && pnpm dev
```

访问 http://localhost:3000

### Docker 常用命令

```bash
# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 升级版本
docker compose pull && docker compose up -d

# 备份数据
tar -czf easyssh-backup-$(date +%Y%m%d).tar.gz docker/data/
```

## 项目结构

```
EasySSH-NextJS/
├── web/                    # Next.js 前端（静态导出）
│   ├── src/
│   │   ├── app/           # App Router 页面
│   │   ├── components/    # React 组件（ui/terminal/editor）
│   │   ├── lib/           # 工具函数与 API 客户端
│   │   └── hooks/         # React Hooks
│   └── public/            # 静态资源
│
├── server/                 # Go 后端服务
│   ├── cmd/api/           # 应用入口
│   ├── internal/
│   │   ├── api/           # HTTP/WebSocket 处理器
│   │   ├── domain/        # 业务领域（server/ssh/auth）
│   │   └── infra/         # 基础设施（db/cache/config）
│   └── migrations/        # 数据库迁移
│
├── docker/                 # Docker 配置与数据持久化
├── scripts/                # 自动化脚本
└── docs/                   # 项目文档
```

## 开发指南

### 常用命令

```bash
# 前端开发
cd web
pnpm dev          # 开发服务器
pnpm build        # Turbopack 构建生产版本（静态导出到 web/out）
pnpm lint         # 代码检查

# 后端开发
cd server
make dev          # 开发服务器（热重载）
make build        # 构建二进制
make test         # 运行测试

# API 类型同步（修改 OpenAPI 后）
./scripts/gen-types.sh
```

## 环境变量配置

项目使用统一的 `.env` 文件（位于项目根目录）进行配置。

### 核心配置项

```bash
# 运行模式
ENV=production                 # development | production

# 服务端口
PORT=8520                      # 后端服务端口
WEB_DEV_PORT=3000              # 前端开发端口（仅开发环境）

# 数据库 (PostgreSQL)
DB_HOST=postgres               # Docker: postgres | 开发: localhost
DB_PORT=5432
DB_USER=easyssh
DB_PASSWORD=CHANGE_ME          # ⚠️ 生产环境必须修改
DB_NAME=easyssh_db

# 缓存 (Redis)
REDIS_HOST=redis               # Docker: redis | 开发: localhost
REDIS_PORT=6379

# 安全配置 ⚠️ 生产环境必须修改
JWT_SECRET=CHANGE_ME           # 生成: openssl rand -base64 48
ENCRYPTION_KEY=CHANGE_ME       # 生成: openssl rand -base64 24

# Cookie 策略
COOKIE_SECURE=true             # HTTPS: true | HTTP: false
COOKIE_SAMESITE=lax            # 同域: lax | 跨域+HTTPS: none
```

### 配置说明

- **开发环境**：使用 `./scripts/dev.sh` 自动配置，或手动编辑 `.env`
- **生产环境**：务必修改 `JWT_SECRET`、`ENCRYPTION_KEY`、`DB_PASSWORD`
- **Docker 部署**：配置已内置在 `docker-compose.yml` 中

完整配置项请参考 [.env.example](.env.example)

## 认证与安全

### OAuth 2.0 + PKCE 流程

- **登录**：`POST /oauth/authorize` + `POST /oauth/token`（支持 2FA）
- **Token 策略**：
  - `access_token`：短期 JWT，存储在内存，用于 API 和 WebSocket 鉴权
  - `refresh_token`：长期 JWT，HttpOnly Cookie，用于自动续期
- **自动续期**：`/api/v1/auth/status` 检测到 access_token 失效时自动刷新

### WebSocket 鉴权

- 终端：`/api/v1/ssh/terminal/:server_id?token=<access_token>`
- 监控：`/api/v1/monitor/server/:server_id?interval=2`

详细文档请参考 [docs/auth-pkce-migration-plan.md](docs/auth-pkce-migration-plan.md)

## 贡献指南

欢迎贡献代码！请遵循以下流程：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

## 支持与反馈

- 🐛 **问题反馈**：[提交 Issue](https://github.com/shan-hee/EasySSH-NextJS/issues)
- 📖 **文档**：[docs/](docs/)
- 🐳 **Docker Hub**：[shanheee/easyssh](https://hub.docker.com/r/shanheee/easyssh)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！**

</div>
