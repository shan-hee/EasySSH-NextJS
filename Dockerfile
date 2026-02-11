# ============================================
# EasySSH 统一 Dockerfile
# 多阶段构建：前端静态导出 + Go 后端
# ============================================

# Stage 1: 构建前端（Next.js）
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

# 使用固定 pnpm 版本，保证构建一致性
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate

# 先安装依赖（利用 Docker 层缓存）
COPY VERSION /app/VERSION
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# 复制源码并执行静态导出构建
COPY web/ ./
RUN pnpm run build

# Stage 2: 构建后端（Go）
FROM golang:1.24-alpine AS backend-builder

WORKDIR /app/server

# git 用于拉取 go modules；ca/tz 提供基础运行能力
RUN apk add --no-cache git ca-certificates tzdata

# 先下载依赖，提升增量构建速度
COPY server/go.mod server/go.sum ./
RUN go mod download && go mod verify

# 复制后端源码，并把前端静态产物注入到 static 目录
COPY server/ ./
COPY --from=frontend-builder /app/web/out ./static

# 构建后端可执行文件（默认 amd64，可通过 TARGETARCH 覆盖）
ARG TARGETARCH
RUN CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=${TARGETARCH:-amd64} \
    go build -ldflags="-s -w" -o easyssh-api ./cmd/api

# Stage 3: 运行时镜像
FROM alpine:3.19

WORKDIR /app

# 仅保留运行时必需组件（证书/时区/健康检查工具）
RUN apk --no-cache add ca-certificates tzdata wget

# 使用非 root 用户运行
ARG APP_UID=1001
ARG APP_GID=1001
RUN addgroup -S -g ${APP_GID} appuser \
    && adduser -S -u ${APP_UID} appuser -G appuser

# 默认环境（可在运行容器时覆盖）
ENV TZ=Asia/Shanghai \
    PORT=8521

# 复制后端二进制与前端静态资源
COPY --from=backend-builder --chown=appuser:appuser /app/server/easyssh-api ./
COPY --from=backend-builder --chown=appuser:appuser /app/server/static ./static

USER appuser

EXPOSE 8521

# 健康检查：命中后端健康接口
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT}/api/v1/health" || exit 1

CMD ["./easyssh-api"]
