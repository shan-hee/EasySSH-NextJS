# EasySSH Docker 部署指南

## 快速开始

### 一键部署（包含数据库）

```bash
# 下载配置文件
wget https://raw.githubusercontent.com/shanheee/easyssh/main/docker-compose.yml

# 启动服务
docker-compose up -d
```

访问：http://localhost:8520

**默认会部署**：
- EasySSH 应用（前端 + 后端）
- PostgreSQL 数据库
- Redis 缓存

## 重要提示

⚠️ **生产环境部署前必须修改以下密码**：

编辑 `docker-compose.yml`：

```yaml
# 数据库密码
DB_PASSWORD: your-strong-password
POSTGRES_PASSWORD: your-strong-password

# Redis 密码
REDIS_PASSWORD: your-redis-password
command: redis-server --requirepass your-redis-password

# JWT 密钥（至少 64 字符）
JWT_SECRET: your-very-long-random-jwt-secret-key

# 加密密钥（必须 32 字节）
ENCRYPTION_KEY: your-32-byte-encryption-key!!
```

### 方式 2: 使用环境变量

```bash
docker run -d \
  --name easyssh \
  -p 8520:8520 \
  -e DB_HOST=your-postgres-host \
  -e DB_PASSWORD=your-db-password \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PASSWORD=your-redis-password \
  -e JWT_SECRET=your-jwt-secret \
  -e ENCRYPTION_KEY=your-encryption-key \
  shanheee/easyssh:latest
```

### 环境变量

**数据库配置**：
```yaml
DB_HOST: postgres          # 数据库地址
DB_PORT: 5432             # 数据库端口
DB_USER: easyssh          # 数据库用户名
DB_PASSWORD: ***          # 数据库密码（必须修改）
DB_NAME: easyssh          # 数据库名称
DB_SSLMODE: disable       # SSL 模式
```

**Redis 配置**：
```yaml
REDIS_HOST: redis         # Redis 地址
REDIS_PORT: 6379          # Redis 端口
REDIS_PASSWORD: ***       # Redis 密码（必须修改）
REDIS_DB: 0               # Redis 数据库编号
```

**应用配置**：
```yaml
SERVER_PORT: 8521         # 后端端口
WEB_PORT: 8520           # 前端端口
ENV: production          # 环境：production/development
GIN_MODE: release        # Gin 模式
```

**安全配置**（必须修改）：
```yaml
JWT_SECRET: ***                    # JWT 密钥（64+ 字符）
JWT_ACCESS_EXPIRE_HOURS: 1        # 访问令牌过期时间（小时）
JWT_REFRESH_EXPIRE_HOURS: 168    # 刷新令牌过期时间（小时）
ENCRYPTION_KEY: ***               # 加密密钥（32 字节）
```

## 常用命令

```bash
# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f easyssh

# 停止服务
docker compose down

# 停止并删除数据
docker compose down -v

# 重启服务
docker compose restart

# 更新到最新版本
docker compose pull
docker compose up -d
```

## 数据备份

### 备份数据库

```bash
docker exec easyssh-postgres pg_dump -U easyssh easyssh > backup.sql
```

### 恢复数据库

```bash
docker exec -i easyssh-postgres psql -U easyssh easyssh < backup.sql
```

## 升级

```bash
# 拉取最新镜像
docker compose pull

# 重启服务
docker compose up -d

# 查看日志确认
docker compose logs -f easyssh
```

## 故障排查

### 无法访问应用

1. 检查容器是否运行：
```bash
docker compose ps
```

2. 查看日志：
```bash
docker compose logs easyssh
```

3. 检查端口是否被占用：
```bash
lsof -i :8520
lsof -i :8521
```

### 数据库连接失败

1. 检查数据库容器：
```bash
docker compose logs postgres
```

2. 测试数据库连接：
```bash
docker exec easyssh-postgres psql -U easyssh -d easyssh -c "SELECT 1;"
```

3. 检查环境变量配置是否正确

### Redis 连接失败

1. 检查 Redis 容器：
```bash
docker compose logs redis
```

2. 测试 Redis 连接：
```bash
docker exec easyssh-redis redis-cli -a redis123 ping
```

## 安全建议

1. ✅ 修改所有默认密码
2. ✅ 使用强随机 JWT 密钥（64+ 字符）
3. ✅ 使用 HTTPS（配置反向代理）
4. ✅ 不要暴露数据库端口到公网
5. ✅ 定期备份数据
6. ✅ 定期更新镜像
7. ✅ 使用防火墙限制访问

## 许可证

Apache License 2.0
