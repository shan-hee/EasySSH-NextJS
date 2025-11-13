# ================================
# 阶段 1：构建前端（Next.js）
# ================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# 启用 Corepack 并安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制前端依赖文件
COPY web/package.json web/pnpm-lock.yaml* ./

# 安装依赖（包含 devDependencies，构建需要）
RUN pnpm install --frozen-lockfile --ignore-scripts && \
    pnpm store prune

# 复制前端源代码
COPY web/ ./

# 创建输出目录并构建前端（输出到 /server/static）
RUN mkdir -p /server/static && \
    pnpm run build && \
    # 清理不需要的文件
    rm -rf node_modules .next/cache src

# ================================
# 阶段 2：构建后端（Go）
# ================================
FROM golang:1.23-alpine AS backend-builder

WORKDIR /build

# 安装构建依赖
RUN apk add --no-cache git ca-certificates tzdata

# 复制 go mod 文件（利用 Docker 缓存）
COPY server/go.mod server/go.sum* ./
RUN go mod download && \
    go mod verify

# 复制源代码
COPY server/ ./

# 复制前端构建产物到 static 目录
COPY --from=frontend-builder /server/static ./static

# 构建后端（优化编译参数）
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -a -installsuffix cgo \
    -ldflags="-w -s -extldflags '-static'" \
    -o easyssh-api ./cmd/api && \
    # 验证二进制文件
    chmod +x easyssh-api && \
    # 清理不需要的文件
    rm -rf /go/pkg /root/.cache

# ================================
# 阶段 3：运行阶段（使用 scratch 或 alpine）
# ================================
FROM alpine:3.19

WORKDIR /app

# 从构建阶段复制时区数据和 CA 证书
COPY --from=backend-builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=backend-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# 安装运行时依赖（仅健康检查需要）
RUN apk --no-cache add wget && \
    rm -rf /var/cache/apk/*

# 创建非 root 用户
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser && \
    # 创建必要的目录
    mkdir -p /app/static && \
    chown -R appuser:appuser /app

# 切换到非 root 用户
USER appuser

# 复制后端构建产物
COPY --from=backend-builder --chown=appuser:appuser /build/easyssh-api .

# 复制前端静态文件
COPY --from=backend-builder --chown=appuser:appuser /build/static ./static

# 设置时区（可选）
ENV TZ=Asia/Shanghai

# 暴露端口（默认 8521，可通过环境变量 PORT 覆盖）
EXPOSE 8521

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8521/api/v1/health || exit 1

# 启动应用（端口通过环境变量 PORT 配置）
CMD ["./easyssh-api"]
