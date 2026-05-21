.PHONY: dev dev-simple build desktop-build desktop-run test clean deps mock migrate-up migrate-down help

# 默认目标 - 显示帮助
.DEFAULT_GOAL := help

# 显示帮助信息
help:
	@echo "EasySSH 服务端 Makefile 命令:"
	@echo ""
	@echo "  make dev         - 开发模式运行 (支持热重载)"
	@echo "  make dev-simple  - 开发模式运行 (无热重载)"
	@echo "  make build       - 构建二进制文件"
	@echo "  make desktop-build - 构建 Wails v3 桌面端二进制"
	@echo "  make desktop-run - 运行 Wails v3 桌面端"
	@echo "  make test        - 运行测试"
	@echo "  make clean       - 清理构建文件"
	@echo "  make deps        - 安装依赖"
	@echo "  make mock        - 生成 mock 文件"
	@echo ""

# 开发模式运行 - 支持热重载
dev:
	@if [ -f /root/go/bin/air ]; then \
		/root/go/bin/air; \
	elif command -v air >/dev/null 2>&1; then \
		air; \
	else \
		echo "⚠️  Air 未安装,使用普通模式 (无热重载)"; \
		echo "💡 安装 Air: go install github.com/cosmtrek/air@latest"; \
		go run cmd/api/main.go; \
	fi

# 开发模式运行 - 无热重载
dev-simple:
	go run cmd/api/main.go

# 构建
build:
	go build -o bin/easyssh-api cmd/api/main.go

# 构建桌面端
desktop-build:
	mkdir -p bin
	go build -tags production -ldflags="-s -w" -o bin/easyssh-desktop ./cmd/desktop

# 运行桌面端
desktop-run:
	go run ./cmd/desktop

# 运行测试
test:
	go test -v ./...

# 清理构建文件
clean:
	rm -rf bin/

# 安装依赖
deps:
	go mod download
	go mod tidy

# 生成 mock 文件
mock:
	mockgen -source=internal/domain/repository.go -destination=internal/mock/repository.go

# 数据库迁移
migrate-up:
	# TODO: 添加迁移工具

migrate-down:
	# TODO: 添加迁移工具
