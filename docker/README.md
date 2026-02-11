# EasySSH Docker 部署指南

## 📋 架构说明

本项目采用**纯 CSR (Client-Side Rendering)** 架构，前端静态文件由 Go 后端托管，单容器部署。

```
┌─────────────────────────────────────┐
│         Docker 容器                  │
│  ┌──────────────────────────────┐  │
│  │   Go 后端 (:8521)            │  │
│  │  ├─ API 服务                 │  │
│  │  ├─ WebSocket (SSH)          │  │
│  │  └─ 静态文件托管 (Next.js)   │  │
│  └──────────────────────────────┘  │
│           ↓         ↓                │
│  ┌──────────┐  ┌──────────┐        │
│  │PostgreSQL│  │  Redis   │        │
│  └──────────┘  └──────────┘        │
└─────────────────────────────────────┘
```

### 服务列表

| 服务名 | 容器名 | 镜像 | 端口 | 说明 |
|--------|--------|------|------|------|
| easyssh | easyssh | shanheee/easyssh:latest | 8521 | Go API + 前端静态文件 |
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
# 数据库配置
DB_PASSWORD=your_secure_password_here

# 安全配置（生产环境必须修改）
JWT_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -base64 32)
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

- **Web 界面**: http://localhost:8521

### 4. 停止服务

```bash
# 停止服务
docker compose stop

# 停止并删除容器
docker compose down

# 停止并删除容器、网络、数据卷
docker compose down -v
```

## 📦 镜像仓库

### Docker Hub 镜像

本项目提供单一的 Docker 镜像（包含前后端）：

- **镜像**: [`shanheee/easyssh`](https://hub.docker.com/r/shanheee/easyssh)

### 拉取镜像

```bash
# 拉取最新版本
docker pull shanheee/easyssh:latest

# 拉取指定版本
docker pull shanheee/easyssh:v1.0.0
```

### 本地构建镜像（可选）

如果需要自定义构建：

```bash
cd /path/to/EasySSH-NextJS

# 构建镜像
docker build -t easyssh:latest .
```

## 🔍 健康检查

所有服务都配置了健康检查：

```bash
# 查看服务健康状态
docker compose ps

# 手动检查后端健康
curl http://localhost:8521/api/v1/health
```

## 📊 日志管理

### 查看所有服务日志

```bash
docker compose logs -f
```

### 查看特定服务日志

```bash
# 后端日志
docker compose logs -f easyssh

# 数据库日志
docker compose logs -f postgres

# Redis 日志
docker compose logs -f redis
```

### 限制日志输出

```bash
# 只显示最后 100 行
docker compose logs --tail=100 easyssh

# 显示最近 10 分钟的日志
docker compose logs --since=10m easyssh
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
# easyssh:
#   image: shanheee/easyssh:v1.0.1

# 拉取并重启
docker compose pull
docker compose up -d
```

### 本地构建并部署（开发者）

```bash
cd docker

# 使用开发配置构建
docker compose -f docker-compose.dev.yml up -d --build
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
docker exec easyssh-postgres pg_dump -U easyssh easyssh_db > backup.sql

# 恢复数据库
docker exec -i easyssh-postgres psql -U easyssh easyssh_db < backup.sql
```

## 🐛 故障排查

### 服务无法启动

1. **检查端口占用**：
   ```bash
   # Linux/macOS
   lsof -i :8521

   # Windows
   netstat -ano | findstr :8521
   ```

2. **检查容器日志**：
   ```bash
   docker compose logs easyssh
   ```

3. **检查健康状态**：
   ```bash
   docker compose ps
   ```

### Redis 内存警告

如果看到 Redis 的 `WARNING Memory overcommit must be enabled!` 警告：

**临时解决方案**（重启后失效）：
```bash
sudo sysctl vm.overcommit_memory=1
```

**永久解决方案**：
```bash
# 添加到系统配置
echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf

# 应用配置
sudo sysctl -p
```

### 数据库连接失败

1. **检查数据库是否就绪**：
   ```bash
   docker exec easyssh-postgres pg_isready -U easyssh
   ```

2. **验证密码配置**：
   - 确保 `DB_PASSWORD` 与 `POSTGRES_PASSWORD` 一致

3. **手动连接测试**：
   ```bash
   docker exec -it easyssh-postgres psql -U easyssh -d easyssh_db
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

   # 生成加密密钥（32 字节，Base64 表示）
   ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

3. **启用 HTTPS**：
   - 使用 Nginx 反向代理
   - 配置 SSL 证书（Let's Encrypt）

4. **限制端口暴露**：
   - 仅暴露必要的端口 8521
   - 数据库和 Redis 端口仅供容器内部访问

## 📚 环境变量说明

### 数据库配置

```bash
DB_HOST=postgres              # 数据库主机（Docker: postgres | 开发: localhost）
DB_PORT=5432                  # 数据库端口
DB_USER=easyssh               # 数据库用户名
DB_PASSWORD=***               # 数据库密码（必须修改）
DB_NAME=easyssh_db            # 数据库名称
DB_SSLMODE=disable            # SSL 模式
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
PORT=8521                     # 后端服务端口
```

### 安全配置（必须修改）

```bash
# JWT 签名密钥（至少 64 字符）
JWT_SECRET=***

# JWT 令牌过期时间
JWT_ACCESS_EXPIRE_MINUTES=15
JWT_REFRESH_IDLE_EXPIRE_DAYS=7
JWT_REFRESH_ABSOLUTE_EXPIRE_DAYS=30

# 数据加密密钥（必须是 32 字节）
ENCRYPTION_KEY=***

# Cookie 安全策略
COOKIE_SECURE=true            # HTTPS: true | HTTP: false
COOKIE_SAMESITE=lax           # lax | none | strict
```

## ❓ 常见问题

### Q: 如何修改端口？

A: 在 `docker/.env` 文件中设置 `PORT` 环境变量，或直接修改 `docker-compose.yml` 中的端口映射。

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
docker exec -it easyssh sh
```

### Q: 如何限制资源使用？

A: 在 `docker-compose.yml` 中添加资源限制：

```yaml
services:
  easyssh:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Q: 为什么只需要一个端口？

A: 本项目采用纯 CSR 架构，前端静态文件由 Go 后端托管，因此只需要暴露后端端口 8521。

## 📞 获取帮助

如遇到问题，请：

1. 查看日志：`docker compose logs -f`
2. 检查健康状态：`docker compose ps`
3. 查看本文档的故障排查部分
4. 提交 Issue：[GitHub Issues](https://github.com/shan-hee/EasySSH-NextJS/issues)

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
构建 Docker 镜像（多架构）
    ↓
推送到 Docker Hub
    ↓
shanheee/easyssh:v1.0.1
shanheee/easyssh:latest
```

### 查看构建状态

- [Docker 构建](https://github.com/shan-hee/EasySSH-NextJS/actions/workflows/docker-build.yml)

---

## 📄 许可证

Apache License 2.0
