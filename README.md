<div align="center">

# EasySSH

<img src="web/public/logo.svg" alt="EasySSH Logo" width="120" />

**现代化的 SSH 管理平台**

提供直观的 Web 界面进行远程服务器管理，支持终端模拟、文件传输、系统监控等功能

[![Version](https://img.shields.io/badge/version-1.0.31-blue)](https://github.com/shan-hee/EasySSH-NextJS/releases)
[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go)](https://go.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-61DAFB?logo=react)](https://react.dev/)
[![i18n](https://img.shields.io/badge/i18n-ready-green)](https://github.com/shan-hee/EasySSH-NextJS)

[![Docker Image Version](https://img.shields.io/docker/v/shanheee/easyssh?label=Docker&logo=docker&sort=semver)](https://hub.docker.com/r/shanheee/easyssh)
[![Docker Image Size](https://img.shields.io/docker/image-size/shanheee/easyssh/latest?logo=docker)](https://hub.docker.com/r/shanheee/easyssh)
[![Docker Pulls](https://img.shields.io/docker/pulls/shanheee/easyssh?logo=docker)](https://hub.docker.com/r/shanheee/easyssh)
[![Build Status](https://img.shields.io/github/actions/workflow/status/shan-hee/EasySSH-NextJS/docker-build.yml?branch=main&logo=github)](https://github.com/shan-hee/EasySSH-NextJS/actions)
[![License](https://img.shields.io/github/license/shan-hee/EasySSH-NextJS)](LICENSE)

[快速开始](#快速开始) • [功能特性](#功能特性) • [技术栈](#技术栈) • [部署指南](#生产环境部署docker) • [开发文档](#开发指南)

</div>

---

## 功能特性

- 🖥️ **Web 终端**：基于 xterm.js 5.5.0 的全功能终端模拟器，支持多标签页、WebGL 渲染、命令补全
- 📁 **文件管理**：SFTP 文件浏览、批量操作、Monaco Editor 0.55.1 在线编辑、回收站机制
- 📊 **系统监控**：实时 CPU、内存、磁盘、网络监控，支持多数据源（EasySSH/Nezha/Komari），Protobuf 高效传输
- 🐳 **Docker 管理**：容器生命周期管理、镜像管理、Compose 项目分组（v1.0.31+）、实时日志查看
- 🤖 **AI 助手**：多提供商支持（Claude/GPT/Gemini）、流式响应、工具调用、权限模式控制
- ⚙️ **自动化任务**：定时任务（Cron）、批量执行、脚本管理、通知集成（邮件/钉钉/企业微信/Webhook）
- 🔐 **安全认证**：OAuth 2.0 + PKCE 授权流程，支持双因素认证（2FA）、账户锁定、登录检测
- 🎨 **现代 UI**：基于 Radix UI + Tailwind CSS 4 的响应式界面，支持国际化（next-intl）

## 技术栈

### 前端
- **框架**：Next.js 16 (Turbopack) + React 19.1.2 + TypeScript 5
- **UI 组件**：Radix UI + shadcn/ui + Tailwind CSS 4
- **终端**：xterm.js 5.5.0（WebGL 渲染、多主题支持）
- **代码编辑器**：Monaco Editor 0.55.1
- **状态管理**：Zustand 5.0.8 + React Query 5.90.10
- **数据可视化**：ECharts 6.0
- **国际化**：next-intl 4.4.0

### 后端
- **语言**：Go 1.25
- **框架**：Gin 1.12.0 + GORM 1.30.0
- **数据库**：SQLite（默认）/ PostgreSQL / MySQL
- **SSH/SFTP**：golang.org/x/crypto + pkg/sftp 1.13.6
- **AI 集成**：go-anthropic v2.16.3 + go-openai v1.41.2
- **WebSocket**：Gorilla WebSocket 1.5.3
- **任务调度**：robfig/cron v3.0.1

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
│           ↓                          │
│  ┌──────────────────────────┐       │
│  │ SQLite 数据文件 / 外部 DB │       │
│  └──────────────────────────┘       │
└─────────────────────────────────────┘
```


## 快速开始

### 方式一：Docker 部署（推荐）

**使用 Docker Compose（默认 SQLite 持久化）**：

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

> 💡 **说明**：`docker-compose.yml` 默认只启动 EasySSH 一个容器，SQLite 数据保存在 `docker/data/`。如需 PostgreSQL/MySQL，可通过 `DB_DRIVER` 与 `DB_DSN` 连接串切换。

**单容器部署**（默认 SQLite）：

```bash
docker run -d \
  --name easyssh \
  -p 8520:8520 \
  -v easyssh-data:/app/data \
  -v easyssh-backups:/app/backups \
  -e DB_DRIVER=sqlite \
  -e DB_DSN=/app/data/easyssh.db \
  -e JWT_SECRET=$(openssl rand -base64 48) \
  -e ENCRYPTION_KEY=$(openssl rand -base64 32) \
  shanheee/easyssh:latest
```

**外部 PostgreSQL/MySQL**：将 `DB_DRIVER` 设置为 `postgres` 或 `mysql`，并通过 `DB_DSN` 提供完整连接串，例如 `postgres://easyssh:${DB_PASSWORD:-easyssh_password}@postgres:5432/easyssh_db?sslmode=disable`。

**支持架构**：`linux/amd64`、`linux/arm64`

### 方式二：本地开发

**前置要求**：
- Node.js 24+ / pnpm 11+
- Go 1.25+
- 默认无需单独数据库服务；如需外部数据库，可使用 PostgreSQL 或 MySQL

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
│   │   └── infra/         # 基础设施（db/config）
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

# 服务地址
NEXT_PUBLIC_BACKEND_URL=http://localhost:8520  # 后端服务地址；后端监听端口从这里解析
WEB_PORT=3000                                  # 前端开发端口（仅开发环境）

# 数据库
DB_DRIVER=sqlite               # sqlite | postgres(pgsql) | mysql
DB_DSN=./data/easyssh.db       # SQLite 文件路径或外部数据库连接串

# 外部 PostgreSQL/MySQL 时启用
# DB_DRIVER=postgres
# DB_DSN="postgres://easyssh:${DB_PASSWORD:-easyssh_password}@localhost:5432/easyssh_db?sslmode=disable"
# DB_DRIVER=mysql
# DB_DSN="mysql://easyssh:${DB_PASSWORD:-easyssh_password}@localhost:3306/easyssh_db?charset=utf8mb4&parseTime=true"

# 安全配置 ⚠️ 生产环境必须修改
JWT_SECRET=CHANGE_ME           # 生成: openssl rand -base64 48
ENCRYPTION_KEY=CHANGE_ME       # 生成: openssl rand -base64 32

# Cookie 策略
COOKIE_SECURE=true             # HTTPS: true | HTTP: false
COOKIE_SAMESITE=lax            # 同域: lax | 跨域+HTTPS: none
```

### 关键环境变量说明

| 变量名 | 说明 | 默认值 | 必需 | 生成方式/示例 |
|--------|------|--------|------|--------------|
| NEXT_PUBLIC_BACKEND_URL | 后端服务地址 | http://localhost:8520 | 否 | 开发环境前端请求地址，后端监听端口也从这里解析 |
| DB_DRIVER | 数据库驱动 | sqlite | 否 | sqlite / postgres(pgsql) / mysql |
| DB_DSN | 数据库连接串 | ./data/easyssh.db | 否 | SQLite 路径 / PostgreSQL URL / MySQL URL |
| JWT_SECRET | JWT 签名密钥 | - | 是 | `openssl rand -base64 48` |
| ENCRYPTION_KEY | 数据加密密钥（2FA等） | - | 是 | `openssl rand -base64 32` |
| COOKIE_SECURE | Cookie 安全标志 | true | 否 | HTTPS: true / HTTP: false |
| COOKIE_SAMESITE | Cookie 同站策略 | lax | 否 | lax / none / strict |

### 配置说明

- **开发环境**：使用 `./scripts/dev.sh` 自动配置，或手动编辑 `.env`
- **生产环境**：务必修改 `JWT_SECRET`、`ENCRYPTION_KEY`；使用外部数据库时同时修改 `DB_DSN`
- **Docker 部署**：配置已内置在 `docker-compose.yml` 中

完整配置项请参考 [.env.example](.env.example)

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
