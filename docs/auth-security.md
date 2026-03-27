# 认证与安全

本文档说明 EasySSH 当前版本的认证模型、安全边界与部署注意事项。

> 说明
>
> - 本文以当前源码实现为准，重点参考 `server/cmd/api/main.go`、`server/internal/api/rest/auth.go`、`server/internal/domain/auth/*`、`server/internal/api/middleware/*`、`web/src/lib/api-client.ts`。
> - 仓库内部分历史文档或注释仍可能出现 `/oauth/*`、`Path=/oauth`、`Cookie-only` 等旧表述。当前主链路以实际代码为准：
>   - OAuth 路由实际挂载在 `/api/v1/oauth/*`
>   - 业务请求实际使用 `Authorization: Bearer <access_token>`
>   - `refresh_token` 通过 HttpOnly Cookie 续期

## 1. 认证模型总览

EasySSH 当前采用的是：

- `Authorization Code + PKCE` 作为账号密码登录的主流程
- `Bearer Access Token` 作为业务 API 认证方式
- `HttpOnly Refresh Token Cookie` 作为静默续期机制
- `TOTP 2FA` 作为可选的双因素认证
- `一次性 Ticket` 作为 WebSocket、下载等不便携带 `Authorization` 头场景下的握手凭证

### 1.1 凭证类型

| 类型 | 用途 | 存储位置 | 默认有效期 | 说明 |
| --- | --- | --- | --- | --- |
| `access_token` | 业务 API 认证 | 前端内存 `useAuthStore` | 15 分钟 | 仅通过 `Authorization: Bearer` 传输，不落地 `localStorage` |
| `refresh_token` | 静默刷新 access token | HttpOnly Cookie `easyssh_refresh_token` | 闲置 7 天，绝对 30 天 | Cookie Path 为 `/api/v1/oauth`，支持轮换与复用检测 |
| `authorization_code` | PKCE 授权码 | Redis | 5 分钟 | 一次性使用，校验 `code_verifier` 与 `code_challenge` |
| `temp_token` | 2FA 登录中间态 | JWT + Redis | 5 分钟 | 仅用于 `/api/v1/auth/2fa/verify`，且只能使用一次 |
| `ticket` | WebSocket / 下载握手 | Redis | 30 秒 | 一次性消费，避免在 URL 中暴露 access token |

### 1.2 当前主链路

当前真实主链路不是纯 Cookie 鉴权，而是：

1. 登录成功后，后端返回 `access_token` 到响应体。
2. 前端把 `access_token` 仅保存到内存状态，不写入浏览器持久化存储。
3. 后端把 `refresh_token` 写入 HttpOnly Cookie，供后续静默刷新使用。
4. 普通 API 请求统一携带 `Authorization: Bearer <access_token>`。
5. 当 access token 过期时，前端自动调用 `/api/v1/oauth/token` 刷新并重放原请求。

这种设计的目标是：

- 降低 `access_token` 被前端脚本长期持久化读取的风险
- 避免业务 API 直接依赖 Cookie 自动发送
- 将刷新动作收敛到单独的 Cookie 通道中

## 2. 核心认证流程

## 2.1 用户名密码 + PKCE 登录

账号密码登录采用 OAuth 2.0 Authorization Code + PKCE 的简化 JSON 版流程：

1. 前端生成 `code_verifier`、`code_challenge(S256)`、`state`。
2. 调用 `POST /api/v1/oauth/authorize`，提交邮箱、密码与 PKCE 参数。
3. 若用户未开启 2FA，后端在 Redis 中生成一次性授权码并返回。
4. 前端调用 `POST /api/v1/oauth/token`，携带 `grant_type=authorization_code`、授权码、`code_verifier`。
5. 后端校验 PKCE 后签发：
   - 响应体中的 `access_token`
   - HttpOnly Cookie 中的 `refresh_token`
   - 非 HttpOnly Cookie `easyssh_csrf_token`

当前仅接受内置 SPA 客户端：

- `client_id` 必须为 `easyssh-web`
- `code_challenge_method` 仅支持 `S256`

## 2.2 启用 2FA 的登录

当用户启用双因素认证后，登录会变成两段式：

1. `POST /api/v1/oauth/authorize`
2. 后端完成账号密码校验后，不直接返回授权码，而是返回：
   - `requires_2fa=true`
   - `temp_token`
3. 前端调用 `POST /api/v1/auth/2fa/verify`
4. 后端校验 TOTP 或备份码成功后，再签发授权码
5. 前端继续调用 `POST /api/v1/oauth/token` 换取 access token

`temp_token` 的特点：

- 有效期 5 分钟
- 通过 Redis + Lua 脚本保证一次性消费
- 只允许用于 2FA 验证流程

## 2.3 自动刷新与 401 兜底

前端刷新策略分为两层：

- 定时刷新：`SessionRefreshProvider` 会根据 access token TTL 的 80% 提前刷新
- 失败兜底：`apiFetch` 收到 `401` 后，会自动调用 `/api/v1/oauth/token`，使用 Cookie 中的 `refresh_token` 刷新一次，再重放原请求

刷新请求特点：

- 请求体只需传 `grant_type=refresh_token`
- 实际 refresh token 从 HttpOnly Cookie 读取
- 前端在跨源场景下会自动使用 `credentials: include`

## 2.4 登出与会话撤销

登出通过 `POST /api/v1/auth/logout` 完成，后端会：

- 尝试从 `Authorization` 头读取 access token
- 兼容性地尝试从 `easyssh_access_token` Cookie 读取旧 access token
- 从 `easyssh_refresh_token` Cookie 读取 refresh token
- 根据 access token 中的 `session_id` 撤销当前会话
- 将 access token 与 refresh token 加入黑名单
- 清理认证相关 Cookie

此外还支持会话管理：

- `GET /api/v1/users/me/sessions` 查看当前用户活跃会话
- `DELETE /api/v1/users/me/sessions/:session_id` 撤销指定会话
- `POST /api/v1/users/me/sessions/revoke-others` 撤销除当前会话外的所有会话

密码修改或重置后，系统也会主动撤销该用户全部会话，强制重新登录。

## 2.5 WebSocket 与下载握手

浏览器原生 WebSocket 握手、原生下载、批量下载等场景不适合直接携带 Bearer Token，因此 EasySSH 使用一次性 `ticket`：

1. 已登录用户调用 `POST /api/v1/auth/ticket`
2. 后端签发一个 30 秒有效、一次性消费的 ticket
3. 前端在 WebSocket URL 或下载请求参数中附带 `ticket`
4. 后端在认证中间件中消费该 ticket，完成一次性鉴权

目前支持的 ticket 类型包括：

- `ws_terminal`
- `ws_monitor`
- `ws_sftp_upload`
- `ws_sftp_transfer`
- `sftp_download`
- `sftp_batch_download`

## 3. 会话与授权

## 3.1 会话模型

每次登录都会创建一条 `user_sessions` 记录，包含：

- `session_id`
- 用户 ID
- refresh token 哈希值
- 设备类型与设备名称
- IP 地址与 User-Agent
- 最近活动时间
- 会话过期时间

同时，`session_id` 会写入 access token claims 中，用于：

- 标记当前会话
- 精确撤销某一个会话
- 在 ticket 模式下把会话上下文传递给 WebSocket / 下载场景

## 3.2 角色与权限

系统内置角色：

- `admin`
- `user`
- `viewer`

路由层会同时使用：

- `AuthMiddleware` 做认证
- `RequireRole` 做角色限制
- `RequirePermission` 做权限码校验

也就是说，EasySSH 的授权不是单纯“是否登录”，而是“是否登录 + 当前角色是否具备目标权限”。

## 4. 安全机制

## 4.1 密码与敏感数据保护

- 用户密码使用 `bcrypt` 哈希后存储
- 默认密码策略要求：
  - 最少 8 位
  - 至少一个大写字母
  - 至少一个小写字母
  - 至少一个数字
  - 拒绝常见弱密码
- 2FA 备份码使用 `ENCRYPTION_KEY` 对应的 AES-256-GCM 加密后存储
- SSH 凭据、私钥、部分第三方数据源 Token 也通过统一加密器进行加密存储

说明：

- 当前实现中，2FA `secret` 本身保存在用户字段中
- 备份码是加密存储并在使用后立即从备份码集合中移除

## 4.2 Token 安全

- `access_token` 不写入 `localStorage` / `sessionStorage`
- `refresh_token` 只放入 HttpOnly Cookie，前端脚本无法直接读取
- 数据库中的 refresh token 保存的是哈希值，不保存明文
- Redis 黑名单用于让已登出或已撤销的 token 立即失效
- refresh token 默认启用：
  - 轮换 `JWT_REFRESH_ROTATE=true`
  - 复用检测 `JWT_REFRESH_REUSE_DETECTION=true`

复用检测的含义：

- 某个 refresh token 一旦被用过，就会被标记为已消费
- 如果同一个 token 再次被使用，系统会判定为复用攻击
- 一旦触发，会撤销整个 token family

## 4.3 速率限制与账户锁定

系统默认启用 Redis 分布式限流，失败时降级为内存限流。

默认阈值如下：

| 项目 | 默认值 | 维度 |
| --- | --- | --- |
| 登录接口限流 | 5 次/分钟 | IP |
| 2FA 验证限流 | 5 次/分钟 | IP |
| 通用 API 限流 | 100 次/分钟 | IP |

账户锁定默认配置：

| 项目 | 默认值 |
| --- | --- |
| IP 最大失败次数 | 10 |
| IP 锁定时长 | 30 分钟 |
| 账户最大失败次数 | 5 |
| 账户锁定时长 | 60 分钟 |

登录时还会结合 IP 与设备信息进行登录检测，可用于新设备/新地点通知。

## 4.4 Cookie、CSRF 与跨域

当前认证相关 Cookie：

| Cookie 名称 | HttpOnly | Path | 用途 |
| --- | --- | --- | --- |
| `easyssh_refresh_token` | 是 | `/api/v1/oauth` | 刷新 access token |
| `easyssh_csrf_token` | 否 | `/` | 双提交 CSRF Token |
| `easyssh_access_token` | 是 | `/api/v1` | 兼容旧逻辑，当前主流程会主动清理 |

Cookie 行为可通过以下配置控制：

- `COOKIE_SECURE`
- `COOKIE_DOMAIN`
- `COOKIE_SAMESITE`

推荐值：

- 同源部署：`COOKIE_SECURE=true`，`COOKIE_SAMESITE=lax`
- 跨域 HTTPS 部署：`COOKIE_SECURE=true`，`COOKIE_SAMESITE=none`
- 本地 HTTP 开发：`COOKIE_SECURE=false`，`COOKIE_SAMESITE=lax`

关于 CSRF，需要特别说明：

- 系统实现了双提交 Cookie 方案：服务端发 `easyssh_csrf_token`，客户端在非安全方法请求头中附带 `X-CSRF-Token`
- 但当前主链路使用的是 Bearer Token，而不是 access token Cookie
- `CSRFMiddleware` 只有在存在 `easyssh_access_token` Cookie 时才会强制校验

因此可以把当前状态理解为：

- Bearer 主链路主要依靠“非 Cookie 鉴权”本身降低 CSRF 风险
- `easyssh_csrf_token` 与 CSRF 中间件更多承担兼容场景支持，尤其是原生表单或历史 Cookie 鉴权路径

跨域方面：

- 服务端使用白名单式 CORS
- 默认允许开发端口对应的 localhost 源
- 可从安全配置中追加允许的源、方法、头部
- 对跨域认证请求会返回 `Access-Control-Allow-Credentials: true`

## 4.5 安全响应头

服务端统一设置常见安全响应头，包括：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

在生产环境下还会启用：

- `Strict-Transport-Security`

说明：

- 为兼容 Google OAuth、Monaco Worker 与部分第三方资源，默认 CSP、COOP、COEP 不是最激进配置
- 如需更严格控制，可通过 `CONTENT_SECURITY_POLICY` 覆盖默认 CSP

## 5. 可选 Google OAuth 登录

系统支持可选的 Google 登录能力。

启用条件：

- 系统配置中开启 `oauth_enabled`
- 配置 `google_client_id`
- 配置 `google_client_secret`

流程概览：

1. 前端走 Google 登录重定向或 FedCM 流程，拿到 `id_token`
2. 调用 `POST /api/v1/oauth/google/verify`
3. 后端校验 Google ID Token 与邮箱已验证状态
4. 若用户不存在且系统允许注册，则自动创建本地用户
5. 后续仍沿用同一套本地会话、access token、refresh token 机制

也就是说，Google OAuth 只替换“身份来源”，不会替换 EasySSH 自己的会话与权限体系。

## 6. 关键接口

| 接口 | 说明 |
| --- | --- |
| `POST /api/v1/oauth/authorize` | 用户名密码 + PKCE 创建授权码 |
| `POST /api/v1/oauth/token` | 使用授权码或 refresh token 换取 access token |
| `POST /api/v1/auth/2fa/verify` | 登录场景下验证 2FA，并继续签发授权码 |
| `GET /api/v1/users/me/2fa/generate` | 生成 2FA secret 与二维码 URL |
| `POST /api/v1/users/me/2fa/enable` | 启用 2FA |
| `POST /api/v1/users/me/2fa/disable` | 禁用 2FA |
| `POST /api/v1/auth/logout` | 登出并撤销当前会话相关 token |
| `GET /api/v1/users/me/sessions` | 查看当前用户活跃会话 |
| `DELETE /api/v1/users/me/sessions/:session_id` | 撤销指定会话 |
| `POST /api/v1/users/me/sessions/revoke-others` | 撤销其他会话 |
| `POST /api/v1/auth/ticket` | 创建一次性 Ticket |
| `GET /api/v1/auth/status` | 获取系统初始化状态、认证状态与公共配置 |
| `POST /api/v1/oauth/google/verify` | 验证 Google ID Token 并建立本地会话 |

## 7. 核心配置项

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 必填 | JWT 签名密钥，生产环境必须替换 |
| `ENCRYPTION_KEY` | 必填 | Base64 编码的 32 字节密钥，用于敏感数据加密 |
| `JWT_ACCESS_EXPIRE_MINUTES` | `15` | access token 过期时间 |
| `JWT_REFRESH_IDLE_EXPIRE_DAYS` | `7` | refresh token 闲置过期时间 |
| `JWT_REFRESH_ABSOLUTE_EXPIRE_DAYS` | `30` | refresh token 绝对过期时间 |
| `JWT_REFRESH_ROTATE` | `true` | 是否启用 refresh token 轮换 |
| `JWT_REFRESH_REUSE_DETECTION` | `true` | 是否启用 refresh token 复用检测 |
| `COOKIE_SECURE` | `true` | HTTPS 环境必须为 `true` |
| `COOKIE_DOMAIN` | 空 | Cookie 域名，留空表示当前域 |
| `COOKIE_SAMESITE` | `lax` | `lax` / `none` / `strict` |
| `ENV` | `production` | 影响 HSTS 等安全策略 |

配置校验要点：

- `JWT_SECRET` 长度至少 32 字符
- `ENCRYPTION_KEY` 必须是 Base64 编码的 32 字节密钥
- refresh token 绝对过期时间必须大于等于闲置过期时间

## 8. 前端集成约定

前端认证侧的几个固定约定如下：

- 登录页负责生成 PKCE 参数
- `access_token` 只保存在 Zustand 内存状态中
- `apiFetch` 自动附加 Bearer 头
- `apiFetch` 在跨源请求中自动带 Cookie
- `apiFetch` 对非安全方法会自动附加 `X-CSRF-Token`
- `apiFetch` 遇到 `401` 会自动刷新并重放一次请求
- `SessionRefreshProvider` 会在 TTL 的 80% 时机提前刷新

开发环境下，前端 API 基地址来自 `web/src/lib/config.ts` 中的开发基地址，并由 `scripts/dev.sh` 协助同步；生产环境默认走同源 `/api/v1`。

## 9. 实现说明

为了避免维护时再次混淆，最后列出几个当前实现中的关键事实：

- OAuth 端点以 `/api/v1/oauth/*` 为准，不是根路径 `/oauth/*`
- 主链路是“内存 access token + HttpOnly refresh token Cookie”，不是纯 Cookie-only
- `easyssh_access_token` Cookie 目前主要是兼容遗留逻辑，正常登录/刷新后会被主动清理
- CSRF 中间件主要覆盖 Cookie 鉴权兼容场景，Bearer 主链路默认不依赖它
- Google 登录成功后，仍会进入 EasySSH 自己的本地会话体系，而不是直接使用 Google Token 访问业务接口

