.PHONY: dev build test clean

# 开发模式运行
dev:
	go run cmd/api/main.go

# 构建
build:
	go build -o bin/easyssh-api cmd/api/main.go

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
