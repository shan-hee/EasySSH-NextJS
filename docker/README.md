# EasySSH Docker 部署指南

## 📋 架构说明

本项目采用**前后端分离**的 Docker 部署架构，包含以下服务：

```
┌─────────────────────────────────────────────────┐
│              Docker Compose 网络                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐      ┌──────────────┐        │
│  │   Frontend   │      │   Backend    │        │
│  │  (Next.js)   │─────▶│    (Go)      │        │
│  │   :8520      │      │   :8521      │        │
│  └──────────────┘      └──────┬───────┘        │
│                                │                 │
│                        ┌───────┴────────┐       │
│                        │                 │       │
│                   ┌────▼────┐     ┌────▼────┐  │
│                   │PostgreSQL│     │  Redis  │  │
│                   │  :5432   │     │  :6379  │  │
│                   └──────────┘     └─────────┘  │
└─────────────────────────────────────────────────┘
```

### 服务列表

| 服务名 | 容器名 | 镜像 | 端口 | 说明 |
|--------|--------|------|------|------|
| backend | easyssh-backend | easyssh-backend:latest | 8521 | Go API 后端服务 |
| frontend | easyssh-frontend | easyssh-frontend:latest | 8520 | Next.js 前端服务 |
| postgres | easyssh-postgres | postgres:16-alpine | 5432 | PostgreSQL 数据库 |
| redis | easyssh-redis | redis:7-alpine | 6379 | Redis 缓存 |

## 🚀 快速开始

### 1. 准备环境变量（可选）

在 `docker` 目录下创建 `.env` 文件（或使用默认配置）：

```bash
cd docker
cp ../.env.example .env
```

编辑 `.env` 文件，修改以下关键配置：

```bash
# 端口配置（可选，默认值已设置）
PORT=8521              # 后端端口
WEB_PORT=8520          # 前端端口

# 数据库配置
DB_PASSWORD=your_secure_password_here

# 安全配置（生产环境必须修改）
JWT_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -base64 24)
```

### 2. 启动服务

```bash
cd docker

# 构建并启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 3. 访问应用

- **前端界面**: http://localhost:8520
- **后端 API**: http://localhost:8521

### 4. 停止服务

```bash
# 停止服务
docker compose stop

# 停止并删除容器
docker compose down

# 停止并删除容器、网络、数据卷
docker compose down -v
```

## 🔧 端口配置

### 修改端口

如果需要修改默认端口，有两种方式：

#### 方式一：通过环境变量（推荐）

在 `docker/.env` 文件中设置：

```bash
PORT=9521              # 后端端口
WEB_PORT=9520          # 前端端口
```

#### 方式二：直接修改 docker-compose.yml

编辑 `docker/docker-compose.yml`：

```yaml
services:
  backend:
    ports:
      - "9521:8521"    # 宿主机端口:容器端口

  frontend:
    ports:
      - "9520:8520"    # 宿主机端口:容器端口
```

⚠️ **注意**：容器内部端口（冒号后）保持不变，只修改宿主机端口（冒号前）。

## 📦 镜像仓库

### Docker Hub 镜像

本项目提供两个独立的 Docker 镜像：

- **后端镜像**: [`shanheee/easyssh-backend`](https://hub.docker.com/r/shanheee/easyssh-backend)
- **前端镜像**: [`shanheee/easyssh-frontend`](https://hub.docker.com/r/shanheee/easyssh-frontend)

### 拉取镜像

```bash
# 拉取最新版本
docker pull shanheee/easyssh-backend:latest
docker pull shanheee/easyssh-frontend:latest

# 拉取指定版本
docker pull shanheee/easyssh-backend:v1.0.0
docker pull shanheee/easyssh-frontend:v1.0.0
```

### 本地构建镜像（可选）

如果需要自定义构建：

```bash
cd /path/to/EasySSH-NextJS

# 构建后端镜像
docker build -f docker/Dockerfile.server -t easyssh-backend:latest .

# 构建前端镜像
docker build -f docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_BASE=http://backend:8521 \
  -t easyssh-frontend:latest .
```

⚠️ **重要**：前端镜像需要在构建时指定 `NEXT_PUBLIC_API_BASE`，因为 Next.js 会在构建时注入环境变量。

## 🔍 健康检查

所有服务都配置了健康检查：

```bash
# 查看服务健康状态
docker compose ps

# 手动检查后端健康
curl http://localhost:8521/api/health

# 手动检查前端健康
curl http://localhost:8520/api/health
```

## 📊 日志管理

### 查看所有服务日志

```bash
docker compose logs -f
```

### 查看特定服务日志

```bash
# 后端日志
docker compose logs -f backend

# 前端日志
docker compose logs -f frontend

# 数据库日志
docker compose logs -f postgres

# Redis 日志
docker compose logs -f redis
```

### 限制日志输出

```bash
# 只显示最后 100 行
docker compose logs --tail=100 backend

# 显示最近 10 分钟的日志
docker compose logs --since=10m frontend
```

## 🔄 更新部署

### 拉取最新镜像并重启

```bash
cd docker

# 拉取最新镜像
docker compose pull

# 重启服务
docker compose up -d
```

### 更新到指定版本

```bash
# 编辑 docker-compose.yml，修改镜像标签
# backend:
#   image: shanheee/easyssh-backend:v1.0.1
# frontend:
#   image: shanheee/easyssh-frontend:v1.0.1

# 拉取并重启
docker compose pull
docker compose up -d
```

### 本地构建并部署（开发者）

```bash
cd docker

# 重新构建镜像
docker compose build

# 重启服务
docker compose up -d

# 或者一步完成
docker compose up -d --build
```

### 仅更新特定服务

```bash
# 仅更新后端
docker compose pull backend
docker compose up -d backend

# 仅更新前端
docker compose pull frontend
docker compose up -d frontend
```

## 💾 数据持久化

数据通过 Docker 卷持久化存储：

```bash
# 查看数据卷
docker volume ls | grep easyssh

# 数据卷列表
# - easyssh-postgres-data: PostgreSQL 数据
# - easyssh-redis-data: Redis 数据

# 备份数据库
docker exec easyssh-postgres pg_dump -U easyssh Easyssh_db > backup.sql

# 恢复数据库
docker exec -i easyssh-postgres psql -U easyssh Easyssh_db < backup.sql
```

## 🐛 故障排查

### 服务无法启动

1. **检查端口占用**：
   ```bash
   # Linux/macOS
   lsof -i :8520
   lsof -i :8521

   # Windows
   netstat -ano | findstr :8520
   netstat -ano | findstr :8521
   ```

2. **检查容器日志**：
   ```bash
   docker compose logs backend
   docker compose logs frontend
   ```

3. **检查健康状态**：
   ```bash
   docker compose ps
   ```

### 前端无法连接后端

1. **检查环境变量**：
   ```bash
   docker exec easyssh-frontend env | grep NEXT_PUBLIC
   ```

2. **验证网络连通性**：
   ```bash
   # 从前端容器访问后端
   docker exec easyssh-frontend wget -O- http://backend:8521/api/health
   ```

3. **检查 docker-compose.yml 配置**：
   - 确保 `NEXT_PUBLIC_API_BASE=http://backend:8521`
   - 确保两个服务在同一网络 `easyssh-network`

### 数据库连接失败

1. **检查数据库是否就绪**：
   ```bash
   docker exec easyssh-postgres pg_isready -U easyssh
   ```

2. **验证密码配置**：
   - 确保 `DB_PASSWORD` 与 `POSTGRES_PASSWORD` 一致

3. **手动连接测试**：
   ```bash
   docker exec -it easyssh-postgres psql -U easyssh -d Easyssh_db
   ```

## 🔐 安全建议

### 生产环境部署

1. **修改默认密码**：
   ```bash
   # 生成强密码
   DB_PASSWORD=$(openssl rand -base64 32)
   REDIS_PASSWORD=$(openssl rand -base64 32)
   ```

2. **修改安全密钥**：
   ```bash
   # 生成 JWT 密钥
   JWT_SECRET=$(openssl rand -base64 48)

   # 生成加密密钥
   ENCRYPTION_KEY=$(openssl rand -base64 24)
   ```

3. **启用 HTTPS**：
   - 使用 Nginx 反向代理
   - 配置 SSL 证书（Let's Encrypt）

4. **限制端口暴露**：
   - 仅暴露前端端口 8520
   - 后端端口 8521 仅供容器内部访问

### 网络隔离

修改 `docker-compose.yml`，移除后端端口暴露：

```yaml
services:
  backend:
    # 注释掉端口映射，仅允许容器内部访问
    # ports:
    #   - "${PORT:-8521}:8521"
```

## 🆚 架构对比

### 旧架构（单容器）

- ❌ 前后端在同一容器中运行
- ❌ 使用 supervisord 管理多进程
- ❌ 日志混在一起，难以调试
- ❌ 无法独立扩展前后端
- ❌ 更新需要重启整个容器

### 新架构（前后端分离）

- ✅ 前后端独立容器，职责清晰
- ✅ 每个容器单一进程，符合最佳实践
- ✅ 日志分离，便于调试和监控
- ✅ 可独立扩展和更新
- ✅ 资源限制更精细

## 📚 环境变量说明

### 数据库配置

```bash
DB_HOST=postgres              # 数据库主机（Docker: postgres | 开发: localhost）
DB_PORT=5432                  # 数据库端口
DB_USER=easyssh               # 数据库用户名
DB_PASSWORD=***               # 数据库密码（必须修改）
DB_NAME=Easyssh_db            # 数据库名称
DB_SSLMODE=disable            # SSL 模式
DB_DEBUG=false                # SQL 调试日志
```

### Redis 配置

```bash
REDIS_HOST=redis              # Redis 主机（Docker: redis | 开发: localhost）
REDIS_PORT=6379               # Redis 端口
REDIS_DB=0                    # Redis 数据库编号
REDIS_PASSWORD=               # Redis 密码（留空表示无密码）
```

### 应用配置

```bash
ENV=production                # 运行环境（development | production）
GIN_MODE=release              # Gin 框架模式（debug | release）
PORT=8521                     # 后端服务端口
WEB_PORT=8520                 # 前端服务端口
```

### 前端配置

```bash
# 后端服务地址（必须包含完整的协议和端口）
NEXT_PUBLIC_API_BASE=http://backend:8521

# WebSocket 主机地址（可选，默认从 API_BASE 推导）
NEXT_PUBLIC_WS_HOST=
```

### 安全配置（必须修改）

```bash
# JWT 签名密钥（至少 64 字符）
JWT_SECRET=***

# JWT 令牌过期时间（小时）
JWT_ACCESS_EXPIRE_HOURS=1
JWT_REFRESH_EXPIRE_HOURS=168

# 数据加密密钥（必须是 32 字节）
ENCRYPTION_KEY=***
```

## ❓ 常见问题

### Q: 如何修改端口？

A: 在 `docker/.env` 文件中设置 `PORT` 和 `WEB_PORT` 环境变量。

### Q: 如何重置数据库？

A:
```bash
docker compose down -v  # 删除数据卷
docker compose up -d    # 重新启动
```

### Q: 如何查看容器内部文件？

A:
```bash
# 进入容器
docker exec -it easyssh-backend sh
docker exec -it easyssh-frontend sh
```

### Q: 如何限制资源使用？

A: 在 `docker-compose.yml` 中添加资源限制：

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Q: 为什么前端无法连接后端？

A: 检查以下几点：
1. 确保 `NEXT_PUBLIC_API_BASE=http://backend:8521`（容器内部通信使用服务名）
2. 确保两个服务在同一网络 `easyssh-network`
3. 检查后端健康状态：`docker compose ps`

### Q: 如何从旧的单容器架构迁移？

A:
1. 备份数据：`docker exec easyssh-postgres pg_dump -U easyssh Easyssh_db > backup.sql`
2. 停止旧容器：`docker compose down`
3. 更新 docker-compose.yml 到新版本
4. 启动新架构：`docker compose up -d`
5. 恢复数据（如需要）

## 📞 获取帮助

如遇到问题，请：

1. 查看日志：`docker compose logs -f`
2. 检查健康状态：`docker compose ps`
3. 查看本文档的故障排查部分
4. 提交 Issue：[GitHub Issues](https://github.com/yourusername/easyssh/issues)

## 🔖 版本号管理（开发者）

### 发布新版本

项目使用统一的 `VERSION` 文件管理版本号。更新版本号会自动触发 GitHub Actions 构建新的 Docker 镜像。

```bash
# 使用版本号管理脚本（推荐）
./scripts/bump-version.sh 1.0.1

# 或手动更新
echo "1.0.1" > VERSION
git add VERSION
git commit -m "chore: bump version to 1.0.1"
git push  # 触发 CI/CD 构建
```

### CI/CD 流程

```
更新 VERSION 文件 → 提交推送
    ↓
GitHub Actions 自动触发
    ↓
并行构建前后端镜像
    ↓
推送到 Docker Hub
    ↓
shanheee/easyssh-backend:v1.0.1
shanheee/easyssh-backend:latest
shanheee/easyssh-frontend:v1.0.1
shanheee/easyssh-frontend:latest
```

### 查看构建状态

- [后端构建](https://github.com/yourusername/easyssh/actions/workflows/docker-build-backend.yml)
- [前端构建](https://github.com/yourusername/easyssh/actions/workflows/docker-build-frontend.yml)

---

## 📄 许可证

Apache License 2.0
