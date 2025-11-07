# ============================================
# EasySSH 单一统一镜像 Dockerfile
# 整合 Next.js 前端 + Go 后端
# 支持多架构: linux/amd64, linux/arm64
# ============================================

# ============================================
# Stage 1: 构建 Go 后端
# ============================================
FROM golang:1.23-alpine AS backend-builder

WORKDIR /build

# 安装构建依赖
RUN apk add --no-cache git ca-certificates

# 复制 VERSION 文件
COPY VERSION /build/

# 复制 go mod 文件并下载依赖
COPY server/go.mod server/go.sum ./
RUN go mod download

# 复制后端源代码
COPY server/ ./

# 构建后端二进制文件
# CGO_ENABLED=0: 静态编译，提高兼容性
# -ldflags: 减小二进制文件体积，注入版本信息
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
    -a -installsuffix cgo \
    -ldflags="-w -s -X main.Version=${VERSION}" \
    -o easyssh-api ./cmd/api

# ============================================
# Stage 2: 构建 Next.js 前端
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# 启用 Corepack 并安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 VERSION 文件
COPY VERSION /app/

# 复制前端依赖文件
COPY web/package.json web/pnpm-lock.yaml ./

# 安装依赖（使用 frozen-lockfile 确保一致性）
RUN pnpm install --frozen-lockfile --production=false

# 复制前端源代码
COPY web/ ./

# 构建前端（启用 standalone 输出模式）
ARG VERSION=dev
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_VERSION=${VERSION}
RUN pnpm build

# ============================================
# Stage 3: 运行时镜像
# ============================================
FROM alpine:3.19

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    supervisor \
    nodejs \
    && rm -rf /var/cache/apk/*

# 设置时区
ENV TZ=Asia/Shanghai

# 创建非 root 用户
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# 创建必要的目录
RUN mkdir -p /app/backend /app/frontend /var/log/supervisor /app/data && \
    chown -R appuser:appuser /app /var/log/supervisor

# 从后端构建阶段复制二进制文件
COPY --from=backend-builder --chown=appuser:appuser /build/easyssh-api /app/backend/

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder --chown=appuser:appuser /app/public /app/frontend/public
COPY --from=frontend-builder --chown=appuser:appuser /app/.next/standalone /app/frontend/
COPY --from=frontend-builder --chown=appuser:appuser /app/.next/static /app/frontend/.next/static

# 复制 supervisord 配置
COPY --chown=appuser:appuser docker/supervisord.conf /etc/supervisord.conf

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 8520 8521

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8520/api/health || exit 1

# 使用 supervisord 管理多进程
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
