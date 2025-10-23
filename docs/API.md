# API 接口文档

本文档说明如何使用 EasySSH 的 API 规范和前后端通信配置。

## OpenAPI 规范

项目的 API 规范定义在 `shared/openapi.yaml`，采用 OpenAPI 3.1.0 标准。

### 查看 API 文档

**方式 1：使用 Swagger UI（推荐）**

```bash
# 安装 swagger-ui-watcher
npm install -g swagger-ui-watcher

# 在项目根目录运行
swagger-ui-watcher shared/openapi.yaml
```

然后访问 http://localhost:8000 查看交互式 API 文档。

**方式 2：在线编辑器**

将 `shared/openapi.yaml` 内容复制到以下任一在线编辑器：
- https://editor.swagger.io/
- https://editor-next.swagger.io/

### 生成 TypeScript 类型

前端可以从 OpenAPI 规范自动生成类型定义：

```bash
cd web

# 生成类型文件到 src/types/openapi.ts
pnpm openapi:gen

# 或使用脚本
cd ..
./scripts/gen-types.sh
```

生成的类型可以在前端代码中使用：

```typescript
import type { components } from '@/types/openapi';

type Server = components['schemas']['Server'];
type ServerCreate = components['schemas']['ServerCreate'];
type LoginRequest = components['schemas']['LoginRequest'];
```

### API 模块划分

OpenAPI 规范定义了以下模块：

| 标签 | 描述 | 主要端点 |
|------|------|---------|
| `auth` | 用户认证 | `/auth/login`, `/auth/logout` |
| `servers` | 服务器管理 | `/servers`, `/servers/{id}` |
| `ssh` | SSH 连接 | `/ssh/sessions` |
| `sftp` | 文件传输 | `/sftp/list`, `/sftp/upload` |
| `scripts` | 脚本管理 | `/scripts`, `/scripts/execute` |
| `monitoring` | 系统监控 | `/monitoring/servers/{id}/metrics` |
| `logs` | 日志管理 | `/logs` |
| `users` | 用户管理 | `/users`, `/users/me` |

## 前后端通信

### 反向代理配置

前端通过 Next.js 的 `rewrites` 功能将 API 请求转发到后端：

**配置文件**: `web/next.config.ts:5-18`

```typescript
async rewrites() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521";

  return [
    {
      source: "/api/:path*",
      destination: `${apiUrl}/api/:path*`,
    },
    {
      source: "/ws/:path*",
      destination: `${apiUrl}/ws/:path*`,
    },
  ];
}
```

### 环境变量配置

**开发环境**: `web/.env.local`

```bash
# 后端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:8521

# AI 配置（可选）
OPENAI_API_KEY=your_api_key
```

**生产环境**:

在部署时设置环境变量：
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 前端 API 调用示例

**使用 openapi-fetch（推荐）**

```typescript
// lib/api-client.ts
import createClient from 'openapi-fetch';
import type { paths } from '@/types/openapi';

const client = createClient<paths>({
  baseUrl: '/api/v1',  // 使用反向代理
});

// 使用示例
export async function getServers() {
  const { data, error } = await client.GET('/servers', {
    params: {
      query: {
        page: 1,
        per_page: 20,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createServer(serverData: ServerCreate) {
  const { data, error } = await client.POST('/servers', {
    body: serverData,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
```

**使用 fetch API**

```typescript
// 登录示例
async function login(username: string, password: string) {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();
  return data;
}
```

### WebSocket 连接（SSH 终端）

```typescript
// 连接到 SSH 会话
const ws = new WebSocket(`ws://localhost:8520/ws/ssh/${serverId}`);

ws.onopen = () => {
  console.log('SSH connection established');
};

ws.onmessage = (event) => {
  // 处理终端输出
  console.log('Received:', event.data);
};

ws.send(JSON.stringify({
  type: 'input',
  data: 'ls -la\n',
}));
```

## 后端实现指南

### Go 代码生成

可以使用 `oapi-codegen` 从 OpenAPI 规范生成 Go 代码：

```bash
# 安装工具
go install github.com/deepmap/oapi-codegen/v2/cmd/oapi-codegen@latest

# 生成类型定义
cd server
oapi-codegen -generate types ../shared/openapi.yaml > internal/models/api.go

# 生成 Gin 服务器代码（可选）
oapi-codegen -generate gin ../shared/openapi.yaml > internal/api/rest/generated.go
```

### 实现 API 端点示例

```go
// server/internal/api/rest/servers.go
package rest

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/easyssh/server/internal/models"
)

// GET /api/v1/servers
func (h *Handler) GetServers(c *gin.Context) {
    page := c.DefaultQuery("page", "1")
    perPage := c.DefaultQuery("per_page", "20")

    // 业务逻辑
    servers, meta, err := h.serverService.List(page, perPage)
    if err != nil {
        c.JSON(http.StatusInternalServerError, models.Error{
            Error: "internal_error",
            Message: err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, models.ServerList{
        Data: servers,
        Meta: meta,
    })
}

// POST /api/v1/servers
func (h *Handler) CreateServer(c *gin.Context) {
    var req models.ServerCreate
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, models.Error{
            Error: "validation_error",
            Message: err.Error(),
        })
        return
    }

    server, err := h.serverService.Create(&req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, models.Error{
            Error: "creation_failed",
            Message: err.Error(),
        })
        return
    }

    c.JSON(http.StatusCreated, server)
}
```

### 路由注册

```go
// server/cmd/api/main.go
func setupRoutes(r *gin.Engine, handler *rest.Handler) {
    v1 := r.Group("/api/v1")
    {
        // 健康检查
        v1.GET("/health", handler.HealthCheck)

        // 认证
        auth := v1.Group("/auth")
        {
            auth.POST("/login", handler.Login)
            auth.POST("/logout", handler.Logout)
            auth.POST("/refresh", handler.RefreshToken)
        }

        // 需要认证的路由
        protected := v1.Group("")
        protected.Use(AuthMiddleware())
        {
            // 服务器管理
            servers := protected.Group("/servers")
            {
                servers.GET("", handler.GetServers)
                servers.POST("", handler.CreateServer)
                servers.GET("/:id", handler.GetServer)
                servers.PUT("/:id", handler.UpdateServer)
                servers.DELETE("/:id", handler.DeleteServer)
                servers.POST("/:id/test", handler.TestServerConnection)
            }

            // 其他路由...
        }
    }
}
```

## 测试 API

### 使用 curl

```bash
# 健康检查
curl http://localhost:8521/api/v1/health

# 登录
curl -X POST http://localhost:8521/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'

# 获取服务器列表（需要 token）
curl http://localhost:8521/api/v1/servers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 使用 Postman / Insomnia

1. 导入 `shared/openapi.yaml` 文件
2. 设置基础 URL: `http://localhost:8521/api/v1`
3. 配置认证 token
4. 开始测试各个端点

## API 规范更新流程

1. **修改规范**：编辑 `shared/openapi.yaml`
2. **验证规范**：使用 Swagger Editor 验证语法
3. **生成类型**：
   ```bash
   # 前端
   ./scripts/gen-types.sh

   # 后端（如果使用代码生成）
   cd server
   oapi-codegen -generate types ../shared/openapi.yaml > internal/models/api.go
   ```
4. **更新实现**：根据新规范更新前后端代码
5. **测试**：确保所有端点正常工作

## 安全最佳实践

### JWT 认证

```typescript
// 前端存储 token
localStorage.setItem('access_token', data.access_token);

// 每次请求携带 token
const token = localStorage.getItem('access_token');
const response = await fetch('/api/v1/servers', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

### CORS 配置（后端）

```go
// server/cmd/api/main.go
import "github.com/gin-contrib/cors"

func main() {
    r := gin.Default()

    // CORS 配置
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:8520"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Authorization", "Content-Type"},
        ExposeHeaders:    []string{"Content-Length"},
        AllowCredentials: true,
    }))

    // 其他配置...
}
```

### 错误处理

统一的错误响应格式：

```json
{
  "error": "validation_error",
  "message": "Invalid request parameters",
  "details": {
    "field": "email",
    "issue": "invalid format"
  }
}
```

## 参考资料

- [OpenAPI 3.1 规范](https://spec.openapis.org/oas/v3.1.0)
- [openapi-fetch 文档](https://openapi-ts.pages.dev/openapi-fetch/)
- [oapi-codegen 文档](https://github.com/deepmap/oapi-codegen)
- [Next.js Rewrites](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
