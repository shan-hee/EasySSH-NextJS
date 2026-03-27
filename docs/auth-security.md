# 认证与安全

本文档描述 EasySSH 当前版本的认证模型、安全边界与部署注意事项。内容以当前源码实现为准，重点对应：

- `server/cmd/api/main.go`
- `server/internal/api/rest/auth.go`
- `server/internal/api/rest/oauth_handler.go`
- `server/internal/domain/auth/*`
- `server/internal/api/middleware/*`
- `web/src/lib/api-client.ts`

## 1. 总体模型

EasySSH 当前采用的是一套明确的 `Bearer-only + Refresh Cookie` 方案：

- 业务 API 统一使用 `Authorization: Bearer <access_token>`
- `access_token` 只通过响应体下发，前端仅保存在内存中
- `refresh_token` 只保存在 HttpOnly Cookie `easyssh_refresh_token`
- 刷新 Cookie 的 Path 固定为 `/api/v1/oauth`
- 登录采用 `Authorization Code + PKCE`
- 2FA 采用 `TOTP + 备份码`
- WebSocket / 下载等不便携带 Bearer 的场景，使用一次性 `ticket`

这意味着：

- 正常业务请求不再依赖 Cookie 自动鉴权
- 服务端不再维护 `access_token` Cookie 主链路
- 服务端不再对业务 API 使用 CSRF 双提交方案

## 2. 凭证与存储位置

| 类型 | 用途 | 存储位置 | 默认有效期 | 说明 |
| --- | --- | --- | --- | --- |
| `access_token` | 业务 API 认证 | 前端内存 `useAuthStore` | 15 分钟 | 仅通过 Bearer 头传输，不写入本地持久化 |
| `refresh_token` | 静默刷新 access token | HttpOnly Cookie `easyssh_refresh_token` | 闲置 7 天，绝对 30 天 | Path 为 `/api/v1/oauth`，支持轮换与复用检测 |
| `authorization_code` | PKCE 授权码 | Redis | 5 分钟 | 一次性使用，校验 `code_verifier` |
| `temp_token` | 2FA 登录中间态 | JWT + Redis | 5 分钟 | 仅用于 `/api/v1/auth/2fa/verify`，且只能消费一次 |
| `ticket` | WebSocket / 下载握手 | Redis | 30 秒 | 一次性消费，避免在 URL 中暴露 access token |

当前真实启用的认证 Cookie 只有一个：

| Cookie 名称 | HttpOnly | Path | 用途 |
| --- | --- | --- | --- |
| `easyssh_refresh_token` | 是 | `/api/v1/oauth` | 刷新 access token、主登出路径下撤销 refresh token |

另外，服务端仍会主动清理历史遗留的 `easyssh_access_token` Cookie，但它不再参与认证。

## 3. 核心认证流程

### 3.1 邮箱密码 + PKCE 登录

账号密码登录采用 OAuth 2.0 Authorization Code + PKCE 的 JSON 化流程：

1. 前端生成 `code_verifier`、`code_challenge(S256)`、`state`
2. 调用 `POST /api/v1/oauth/authorize`
3. 提交邮箱、密码与 PKCE 参数
4. 若用户未开启 2FA，后端返回一次性授权码
5. 前端调用 `POST /api/v1/oauth/token`
6. 使用 `grant_type=authorization_code`、授权码和 `code_verifier` 换取令牌

后端返回：

- 响应体中的 `access_token`
- HttpOnly Cookie 中的 `refresh_token`

当前仅接受内置 SPA 客户端：

- `client_id` 必须为 `easyssh-web`
- `code_challenge_method` 仅支持 `S256`

### 3.2 启用 2FA 的登录

当用户启用双因素认证后，登录会变成两段式：

1. 前端先调用 `POST /api/v1/oauth/authorize`
2. 账号密码校验通过后，如果用户启用了 2FA，后端返回：
   - `requires_2fa=true`
   - `temp_token`
3. 前端调用 `POST /api/v1/auth/2fa/verify`
4. 后端校验 TOTP 或备份码成功后，再返回授权码
5. 前端继续调用 `POST /api/v1/oauth/token` 换取 `access_token`

`temp_token` 的特点：

- 有效期 5 分钟
- 存储在 Redis 中
- 通过 Lua 脚本实现“验证并删除”的原子消费

### 3.3 自动刷新

前端刷新策略有两层：

- 定时刷新：根据 access token TTL 提前刷新
- 失败兜底：业务请求收到 `401` 后，自动尝试刷新一次再重放原请求

刷新接口固定为：

- `POST /api/v1/oauth/token`
- 请求体：`{ "grant_type": "refresh_token" }`

刷新时：

- `refresh_token` 由浏览器自动从 HttpOnly Cookie 发送
- 后端返回新的 `access_token`
- 如果开启轮换，后端会同时下发新的 `refresh_token` Cookie

### 3.4 登出

推荐登出端点：

- `POST /api/v1/oauth/logout`

兼容别名：

- `POST /api/v1/auth/logout`

区别是：

- `/api/v1/oauth/logout` 能收到 Path 为 `/api/v1/oauth` 的 `refresh_token` Cookie，因此可以完整撤销 refresh token
- `/api/v1/auth/logout` 仍可作为兼容别名，但浏览器通常不会把 refresh cookie 发送到这个路径，所以不应再作为主流程使用

登出时，服务端会：

- 优先从 `Authorization` 头读取 access token
- 从 `easyssh_refresh_token` Cookie 读取 refresh token
- 尝试根据 token 中的 `session_id` 撤销当前会话
- 将 access token / refresh token 加入黑名单
- 清除 refresh cookie
- 清理历史遗留的 `easyssh_access_token` Cookie

## 4. 会话与刷新安全

### 4.1 会话模型

每次登录都会创建一条 `user_sessions` 记录，包含：

- `session_id`
- 用户 ID
- refresh token 哈希值
- 设备信息、IP、User-Agent
- 最近活动时间
- 会话过期时间

同时，`session_id` 会写入 access token 和 refresh token claims，用于：

- 精确撤销单个会话
- 将 ticket 与会话上下文关联起来

### 4.2 Refresh Token 轮换与复用检测

当前实现默认启用：

- `JWT_REFRESH_ROTATE=true`
- `JWT_REFRESH_REUSE_DETECTION=true`

刷新过程中的关键保护如下：

- 数据库只保存 refresh token 的哈希值，不保存明文
- 刷新前先校验 session 是否存在且未过期
- Redis 使用 Lua 脚本原子执行“已用标记 + family 撤销”
- 一旦检测到 refresh token 被重复使用，会立即撤销整个 token family
- 如果 session 同步失败，会把这次刷新当作认证失效处理，前端需要重新登录

也就是说，当前不会再出现“refresh 成功但 session 状态没写回，客户端继续带着不一致状态运行”的宽松分支。

## 5. 2FA 安全存储

2FA 当前采用更严格的存储策略：

- `TwoFactorSecret` 使用 `ENCRYPTION_KEY` 做 AES-256-GCM 加密后保存
- `BackupCodes` 不再保存可逆明文，而是使用基于 `ENCRYPTION_KEY` 的 HMAC-SHA256 哈希列表保存
- 验证成功后，被使用的备份码会立即从哈希列表中移除
- 不再保留旧版明文 / 可逆格式兼容读取逻辑

这意味着：

- 数据库泄露时，备份码无法被直接还原
- TOTP secret 的明文不会以裸值形式持久化
- 当前部署假设“没有旧数据需要兼容”，所以所有 2FA 数据都会按新格式写入和读取

## 6. Bearer-only 边界

### 6.1 服务端

服务端当前的认证边界是：

- 业务 API 只认 Bearer Token
- `refresh_token` Cookie 只用于 `/api/v1/oauth/token` 与推荐的 `/api/v1/oauth/logout`
- 已停用 CSRF 中间件
- 不再发放 `easyssh_csrf_token`
- 不再支持通过 `easyssh_access_token` Cookie 完成业务认证

### 6.2 前端

前端当前遵循这些固定约定：

- `access_token` 只保存在 Zustand 内存中
- `apiFetch` 会自动给业务 API 加 `Authorization: Bearer`
- 跨域场景下，不再给所有 API 自动携带 Cookie
- 只有会建立、刷新或清理 refresh cookie 的端点，才会在跨域时显式使用 `credentials: include`

典型需要 Cookie 的端点包括：

- `POST /api/v1/oauth/token`
- `POST /api/v1/oauth/logout`
- `POST /api/v1/oauth/google/verify`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/initialize-admin`

其他业务接口默认只走 Bearer。

## 7. Ticket 场景

对于 WebSocket、原生下载、批量下载等无法稳定附带 Bearer 头的场景，EasySSH 仍然使用一次性 `ticket`：

1. 已登录用户调用 `POST /api/v1/auth/ticket`
2. 后端签发短期 ticket
3. 前端在下载 URL 或 WS 握手参数中附带该 ticket
4. 后端在中间件中一次性消费 ticket

当前常见 ticket 类型包括：

- `ws_terminal`
- `ws_monitor`
- `ws_sftp_upload`
- `ws_sftp_transfer`
- `sftp_download`
- `sftp_batch_download`

## 8. CORS、Cookie 与部署建议

### 8.1 Cookie 配置

与认证相关的 Cookie 行为受以下配置影响：

- `COOKIE_SECURE`
- `COOKIE_DOMAIN`
- `COOKIE_SAMESITE`

推荐值：

- 同源部署：`COOKIE_SECURE=true`，`COOKIE_SAMESITE=lax`
- 跨域 HTTPS 部署：`COOKIE_SECURE=true`，`COOKIE_SAMESITE=none`
- 本地 HTTP 开发：`COOKIE_SECURE=false`，`COOKIE_SAMESITE=lax`

### 8.2 CORS

服务端采用白名单式 CORS：

- 默认允许开发端口对应的本地来源
- 可从安全配置中追加允许源、方法和头
- 默认允许的认证请求头以 `Authorization` 为主

由于当前是 Bearer-only 主链路，跨域时不需要再为业务 API 额外开放 CSRF 相关头部。

## 9. 关键接口

| 接口 | 说明 |
| --- | --- |
| `POST /api/v1/oauth/authorize` | 邮箱密码 + PKCE 创建授权码 |
| `POST /api/v1/oauth/token` | 使用授权码或 refresh token 换取 access token |
| `POST /api/v1/oauth/logout` | 推荐登出端点，能携带 refresh cookie |
| `POST /api/v1/auth/logout` | 兼容别名，不建议作为主流程 |
| `POST /api/v1/auth/2fa/verify` | 登录场景下验证 2FA，并继续签发授权码 |
| `GET /api/v1/users/me/2fa/generate` | 生成 2FA secret 与二维码 URL |
| `POST /api/v1/users/me/2fa/enable` | 启用 2FA |
| `POST /api/v1/users/me/2fa/disable` | 禁用 2FA |
| `GET /api/v1/users/me/sessions` | 查看当前用户活跃会话 |
| `DELETE /api/v1/users/me/sessions/:session_id` | 撤销指定会话 |
| `POST /api/v1/users/me/sessions/revoke-others` | 撤销其他会话 |
| `POST /api/v1/auth/ticket` | 创建一次性 Ticket |
| `GET /api/v1/auth/status` | 获取系统初始化状态、认证状态与公共配置 |
| `POST /api/v1/oauth/google/verify` | 验证 Google ID Token 并建立本地会话 |

## 10. 关键配置项

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 必填 | JWT 签名密钥，生产环境必须替换 |
| `ENCRYPTION_KEY` | 必填 | Base64 编码的 32 字节密钥，用于 2FA secret 加密与备份码 HMAC |
| `JWT_ACCESS_EXPIRE_MINUTES` | `15` | access token 过期时间 |
| `JWT_REFRESH_IDLE_EXPIRE_DAYS` | `7` | refresh token 闲置过期时间 |
| `JWT_REFRESH_ABSOLUTE_EXPIRE_DAYS` | `30` | refresh token 绝对过期时间 |
| `JWT_REFRESH_ROTATE` | `true` | 是否启用 refresh token 轮换 |
| `JWT_REFRESH_REUSE_DETECTION` | `true` | 是否启用 refresh token 复用检测 |
| `COOKIE_SECURE` | `true` | HTTPS 环境必须为 `true` |
| `COOKIE_DOMAIN` | 空 | Cookie 域名，留空表示当前域 |
| `COOKIE_SAMESITE` | `lax` | `lax` / `none` / `strict` |

配置校验要点：

- `JWT_SECRET` 生产环境必须替换为高强度随机值
- `ENCRYPTION_KEY` 必须是 Base64 编码后的 32 字节密钥
- `JWT_REFRESH_ABSOLUTE_EXPIRE_DAYS` 必须大于等于 `JWT_REFRESH_IDLE_EXPIRE_DAYS`

## 11. 当前实现的几个关键事实

- OAuth 路由实际挂载在 `/api/v1/oauth/*`
- 主链路是“内存 access token + HttpOnly refresh token Cookie”
- 业务 API 是 Bearer-only
- refresh cookie 只绑定到 `/api/v1/oauth`
- 不再依赖 CSRF 双提交方案
- `easyssh_access_token` 只作为历史遗留清理目标，不再参与认证
