# EasySSH Server

EasySSH 后端服务 - 基于 Go + Gin + GORM

## 快速开始

### 安装依赖
```bash
go mod download
```

### 运行开发服务器
```bash
go run cmd/api/main.go
```

### 构建
```bash
go build -o bin/easyssh-api cmd/api/main.go
```

## 项目结构

```
server/
├── cmd/api/           # 应用入口
├── internal/          # 内部代码（不对外暴露）
│   ├── api/          # HTTP/WebSocket 处理器
│   ├── domain/       # 业务领域逻辑
│   ├── infra/        # 基础设施（数据库、缓存等）
│   └── pkg/          # 内部共享包
├── migrations/       # 数据库迁移文件
└── go.mod
```

## 技术栈

- **框架**: Gin
- **ORM**: GORM
- **数据库**: PostgreSQL
- **缓存**: Redis
- **SSH**: golang.org/x/crypto/ssh

## API 端点

- `GET /api/v1/health` - 健康检查
