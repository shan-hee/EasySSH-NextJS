# EasySSH 后端服务

![Status](https://img.shields.io/badge/status-completed-success)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Go](https://img.shields.io/badge/go-1.21+-00ADD8?logo=go)

EasySSH 后端服务采用 Go 语言开发，提供完整的 SSH 服务器管理、终端连接、文件传输、系统监控和审计日志功能。

---

## 📊 开发进度

✅ **后端核心功能已 100% 完成**

| 模块 | 状态 | API 数量 |
|------|------|---------|
| 用户认证 | ✅ 已完成 | 5 个 |
| 服务器管理 | ✅ 已完成 | 7 个 |
| SSH 终端 | ✅ 已完成 | 4 个 |
| SFTP 文件 | ✅ 已完成 | 12 个 |
| 系统监控 | ✅ 已完成 | 6 个 |
| 审计日志 | ✅ 已完成 | 5 个 |

**总计**: 39+ REST API 端点

---

## 🚀 快速开始

### 1. 环境要求

- Go 1.21+
- PostgreSQL 12+
- Redis 6+

### 2. 配置环境

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
vim .env
```

必需配置项：
```env
# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_USER=easyssh
DB_PASSWORD=your-password
DB_NAME=easyssh

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT 密钥
JWT_SECRET=your-jwt-secret-key

# AES 加密密钥（32字节）
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

### 3. 安装依赖

```bash
go mod download
```

### 4. 运行服务

```bash
# 开发模式
go run cmd/api/main.go

# 或使用 air 热重载（需安装 air）
air
```

服务将在 `http://localhost:8521` 启动

### 5. 验证运行

```bash
curl http://localhost:8521/api/v1/health
```

预期响应：
```json
{
  "status": "ok",
  "service": "easyssh-api",
  "version": "1.0.0",
  "dependencies": {
    "database": "ok",
    "redis": "ok"
  }
}
```

---

## 🏗️ 项目结构

```
server/
├── cmd/
│   └── api/
│       └── main.go              # 应用入口
├── internal/
│   ├── api/                     # API 层
│   │   ├── middleware/          # 中间件
│   │   │   ├── auth.go          # JWT 认证
│   │   │   ├── audit.go         # 审计日志
│   │   │   ├── cors.go          # CORS
│   │   │   ├── logger.go        # 日志
│   │   │   ├── recovery.go      # 错误恢复
│   │   │   └── request_id.go    # 请求 ID
│   │   ├── rest/                # REST API 处理器
│   │   │   ├── auth.go          # 认证 API
│   │   │   ├── server.go        # 服务器管理
│   │   │   ├── ssh.go           # SSH 会话
│   │   │   ├── sftp.go          # SFTP 文件
│   │   │   ├── monitoring.go    # 监控
│   │   │   └── auditlog.go      # 审计日志
│   │   └── ws/                  # WebSocket
│   │       └── terminal.go      # SSH 终端
│   ├── domain/                  # 领域层（业务逻辑）
│   │   ├── auth/                # 认证域
│   │   │   ├── model.go         # 用户模型
│   │   │   ├── repository.go    # 数据访问
│   │   │   ├── service.go       # 业务逻辑
│   │   │   └── jwt.go           # JWT 服务
│   │   ├── server/              # 服务器域
│   │   ├── ssh/                 # SSH 域
│   │   ├── sftp/                # SFTP 域
│   │   ├── monitoring/          # 监控域
│   │   └── auditlog/            # 审计日志域
│   ├── infra/                   # 基础设施层
│   │   ├── config/              # 配置管理
│   │   ├── db/                  # 数据库
│   │   └── cache/               # Redis 缓存
│   └── pkg/                     # 公共包
│       └── crypto/              # 加密工具
├── .env.example                 # 环境变量示例
├── go.mod                       # Go 依赖
└── README.md                    # 本文件
```

---

## 🎯 API 端点

### 认证 (5 个)
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/logout` - 退出登录
- `POST /api/v1/auth/refresh` - 刷新令牌
- `GET /api/v1/users/me` - 获取当前用户信息

### 服务器管理 (7 个)
- `GET /api/v1/servers` - 服务器列表
- `POST /api/v1/servers` - 创建服务器
- `GET /api/v1/servers/:id` - 服务器详情
- `PUT /api/v1/servers/:id` - 更新服务器
- `DELETE /api/v1/servers/:id` - 删除服务器
- `POST /api/v1/servers/:id/test` - 测试连接
- `GET /api/v1/servers/statistics` - 统计信息

### SSH 终端 (4 个)
- `WS /ws/terminal/:server_id` - WebSocket 终端连接
- `GET /api/v1/ssh/sessions` - 会话列表
- `GET /api/v1/ssh/sessions/:id` - 会话详情
- `DELETE /api/v1/ssh/sessions/:id` - 关闭会话

### SFTP 文件 (12 个)
- `GET /api/v1/sftp/:server_id/list` - 列出目录
- `GET /api/v1/sftp/:server_id/stat` - 文件信息
- `POST /api/v1/sftp/:server_id/upload` - 上传文件
- `GET /api/v1/sftp/:server_id/download` - 下载文件
- `POST /api/v1/sftp/:server_id/mkdir` - 创建目录
- `DELETE /api/v1/sftp/:server_id/delete` - 删除文件/目录
- `POST /api/v1/sftp/:server_id/rename` - 重命名
- `POST /api/v1/sftp/:server_id/move` - 移动
- `POST /api/v1/sftp/:server_id/copy` - 复制
- `GET /api/v1/sftp/:server_id/read` - 读取文件
- `POST /api/v1/sftp/:server_id/write` - 写入文件
- `GET /api/v1/sftp/:server_id/disk-usage` - 磁盘使用

### 系统监控 (6 个)
- `GET /api/v1/monitoring/:server_id/system` - 系统综合信息
- `GET /api/v1/monitoring/:server_id/cpu` - CPU 信息
- `GET /api/v1/monitoring/:server_id/memory` - 内存信息
- `GET /api/v1/monitoring/:server_id/disk` - 磁盘信息
- `GET /api/v1/monitoring/:server_id/network` - 网络信息
- `GET /api/v1/monitoring/:server_id/processes` - 进程列表

### 审计日志 (5 个)
- `GET /api/v1/audit-logs` - 日志列表
- `GET /api/v1/audit-logs/me` - 我的日志
- `GET /api/v1/audit-logs/statistics` - 统计信息
- `GET /api/v1/audit-logs/:id` - 日志详情
- `DELETE /api/v1/audit-logs/cleanup` - 清理旧日志

---

## 📚 技术栈

### 核心框架
- **Web 框架**: Gin v1.10.0
- **ORM**: GORM v1.25.12
- **数据库**: PostgreSQL (驱动: gorm.io/driver/postgres)
- **缓存**: Redis (go-redis/v9)

### 认证与安全
- **JWT**: golang-jwt/jwt/v5 v5.2.1
- **密码加密**: bcrypt (golang.org/x/crypto)
- **凭证加密**: AES-256-GCM

### SSH/SFTP
- **SSH 客户端**: golang.org/x/crypto/ssh
- **SFTP**: github.com/pkg/sftp v1.13.6
- **WebSocket**: github.com/gorilla/websocket v1.5.3

### 其他
- **UUID**: github.com/google/uuid v1.6.0
- **PostgreSQL 数组**: github.com/lib/pq v1.10.9

---

## 🔒 安全特性

### 数据加密
- ✅ **密码**: bcrypt 哈希（成本因子 12）
- ✅ **服务器凭证**: AES-256-GCM 加密存储
- ✅ **传输**: 支持 HTTPS（生产环境）

### 认证授权
- ✅ **JWT 认证**: Access Token (1小时) + Refresh Token (7天)
- ✅ **令牌黑名单**: Redis 存储已注销令牌
- ✅ **RBAC**: 基于角色的访问控制（Admin/User/Viewer）
- ✅ **资源隔离**: 用户只能访问自己的资源

### 审计追踪
- ✅ 记录所有关键操作（登录、SSH 连接、文件操作等）
- ✅ 包含用户、时间、IP、User-Agent、错误信息
- ✅ 支持多维度查询和统计分析

---

## 🛠️ 开发

### 编译

```bash
# 开发模式（带调试信息）
go build -o easyssh-server cmd/api/main.go

# 生产模式（优化编译）
go build -ldflags="-s -w" -o easyssh-server cmd/api/main.go
```

### 测试

```bash
# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./internal/domain/auth

# 查看测试覆盖率
go test -cover ./...

# 生成覆盖率报告
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### 代码检查

```bash
# 格式化代码
go fmt ./...

# 代码检查
go vet ./...

# 使用 golangci-lint（需先安装）
golangci-lint run
```

---

## 📝 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `SERVER_PORT` | 服务器端口 | 8521 | 否 |
| `SERVER_ENV` | 运行环境 | development | 否 |
| `ENCRYPTION_KEY` | AES 加密密钥（32字节） | - | ✅ |
| `DB_HOST` | 数据库主机 | localhost | ✅ |
| `DB_PORT` | 数据库端口 | 5432 | ✅ |
| `DB_USER` | 数据库用户 | - | ✅ |
| `DB_PASSWORD` | 数据库密码 | - | ✅ |
| `DB_NAME` | 数据库名称 | - | ✅ |
| `DB_SSLMODE` | SSL 模式 | disable | 否 |
| `REDIS_HOST` | Redis 主机 | localhost | ✅ |
| `REDIS_PORT` | Redis 端口 | 6379 | ✅ |
| `REDIS_PASSWORD` | Redis 密码 | - | 否 |
| `REDIS_DB` | Redis 数据库编号 | 0 | 否 |
| `JWT_SECRET` | JWT 密钥 | - | ✅ |
| `JWT_ACCESS_EXPIRE_MINUTES` | Access Token 过期时间（分钟，5-1440） | 15 | 否 |
| `JWT_REFRESH_IDLE_EXPIRE_DAYS` | Refresh Token 闲置过期时间（天，1-90） | 7 | 否 |
| `JWT_REFRESH_ABSOLUTE_EXPIRE_DAYS` | Refresh Token 绝对过期时间（天，1-365） | 30 | 否 |
| `JWT_REFRESH_ROTATE` | 是否启用刷新令牌轮换 | true | 否 |
| `JWT_REFRESH_REUSE_DETECTION` | 是否启用刷新令牌复用检测 | true | 否 |

### 生成加密密钥

```bash
# 生成 32 字节随机密钥（用于 ENCRYPTION_KEY）
openssl rand -hex 32

# 生成 JWT 密钥
openssl rand -base64 64
```

---

## 📖 文档

### 完整文档
- [后端开发流程](../docs/后端开发流程.md)
- [后端开发完成总结](../docs/后端开发完成总结.md)
- [项目状态](../PROJECT_STATUS.md)

### Phase 文档
- [Phase 1 - 基础架构](../docs/Phase1-基础架构完成.md)
- [Phase 2 - 用户认证](../docs/Phase2-认证系统完成.md)
- [Phase 3 - 服务器管理](../docs/Phase3-服务器管理完成.md)
- [Phase 4 - SSH 终端](../docs/Phase4-SSH连接终端完成.md)
- [Phase 5 - SFTP 文件](../docs/Phase5-SFTP文件传输完成.md)
- [Phase 6 - 监控日志](../docs/Phase6-监控日志完成.md)

---

## 🐛 已知问题

### 安全提醒
- ⚠️ SSH 主机密钥验证当前使用 `InsecureIgnoreHostKey`（生产环境需替换为实际验证）

### 功能限制
- 监控数据仅返回实时数据，暂不支持历史记录
- WebSocket 会话超时固定为 30 分钟
- 大文件上传暂无断点续传

### 性能优化
- 监控数据需要添加缓存
- 审计日志查询需要更多索引

---

## 🚀 生产部署

### Docker 部署

```bash
# 构建镜像
docker build -t easyssh-server:1.0.0 .

# 运行容器
docker run -d \
  --name easyssh-server \
  -p 8521:8521 \
  -e DB_HOST=postgres \
  -e REDIS_HOST=redis \
  --env-file .env \
  easyssh-server:1.0.0
```

### 健康检查

```bash
# Docker Compose 配置
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8521/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

## 🤝 贡献

欢迎贡献！请参考主项目的 [README.md](../README.md) 了解贡献指南。

---

## 📄 许可证

Apache License 2.0 - 详见 [LICENSE](../LICENSE)

---

**EasySSH Backend** - 安全、高效的 SSH 管理后端服务 🚀
