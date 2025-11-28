# 认证重构方案：迁移到 Authorization Code + PKCE（最佳实践版）

本文档在不考虑与现有 Cookie-only 登录兼容的前提下，规划一次性重构到「Authorization Code + PKCE」的认证方案，目标是直接落地一套更标准、更利于扩展的安全架构。

---

## 1. 重构目标

### 1.1 目标状态（To‑Be）

- 登录流程：
  - 浏览器 SPA 使用 **Authorization Code + PKCE** 登录。
  - 授权端点/登录页由当前 Go 后端内嵌提供。
- Token 策略：
  - `access_token`：
    - 短期 JWT。
    - 只存在于前端内存（state/单例 store），**不写 Cookie / localStorage**。
    - 调用 API 时通过 `Authorization: Bearer <access_token>` 发送。
  - `refresh_token`：
    - JWT，长期凭证。
    - **仅存在于 HttpOnly + Secure Cookie**（可配 `SameSite` 与 `Domain`），前端 JS 不可读。
    - 服务端数据库只保存哈希值（延用已有 `user_sessions` 表）。
    - 启用轮换（Rotation）与复用检测，并与“设备/会话管理”绑定。
- API 策略：
  - 业务 API **只信任 Header 中的 Bearer Token**，不再从 Cookie 读取 access_token。
  - 刷新/登出等少数认证端点可以使用 Cookie 读取 refresh_token，但这些端点不暴露业务数据。

### 1.2 明确不是做什么

- 不再保留“旧登录接口 + Cookie-only API 鉴权”的兼容模式；
- 可以接受上线时让所有现有会话失效（要求用户重新登录），以简化迁移复杂度。

---

## 2. 目标架构概览

### 2.1 角色划分

- **浏览器 SPA（现有 Next.js 前端）**：
  - 负责展示登录界面和业务 UI。
  - 实现 PKCE 流程、access_token 内存管理与自动刷新。
- **授权服务器（现有 Go 后端中的一部分）**：
  - 提供 `/oauth/authorize` 和 `/oauth/token`。
  - 处理用户名+密码登录、2FA（如果启用）、授权码签发与验证。
  - 负责发放 access_token 和 refresh_token，以及 refresh_token 轮换。
- **资源服务器（同一个 Go 后端的业务 API 部分）**：
  - 所有业务接口只接受 `Authorization: Bearer` 进行认证。
  - 不再从 Cookie 中读取 `easyssh_access_token`。

### 2.2 Token 与会话模型

- access_token：
  - HS256 JWT，保留当前的用户信息字段（`user_id`、`username`、`role` 等）。
  - 有效期建议 5–15 分钟（可通过 `JWT_ACCESS_EXPIRE_MINUTES` 配置）。
  - 不再写入 `easyssh_access_token` Cookie。
- refresh_token：
  - HS256 JWT，带有：
    - `TokenFamily`、`TokenVersion`、`AbsoluteExpiry`、`LastUsed` 等字段（继承现有逻辑）。
  - 闲置过期 + 绝对过期由 `JWT_REFRESH_IDLE_EXPIRE_DAYS` / `JWT_REFRESH_ABSOLUTE_EXPIRE_DAYS` 控制。
  - 每次刷新时轮换（生成新 token、更新家族版本、标记旧 token 已使用）。
- 会话表（`user_sessions`）：
  - 保留当前模型：存储 refresh_token 哈希、设备信息、IP、UserAgent、`LastActivity`、`ExpiresAt`。
  - 登录/刷新时更新该表，实现设备/会话级管理与撤销。

---

## 3. 协议与端点设计（最佳实践版）

### 3.1 授权端点：`GET /oauth/authorize`

职责：处理用户登录 + PKCE 参数校验 + 授权码签发。

请求参数（Query）：

- `response_type=code`
- `client_id`：前端 SPA 标识（固定字符串，如 `easyssh-web`）。
- `redirect_uri`：登录完成后重定向回前端的地址，必须在后端白名单中。
- `scope`：可简化为固定值，如 `openid profile easyssh`。
- `code_challenge`：由前端根据 `code_verifier` 计算的 S256 值。
- `code_challenge_method=S256`
- `state`：前端生成，用于 CSRF 防御。

交互流程：

1. 未登录用户访问 `/oauth/authorize` 时：
   - 返回登录页（可复用现有登录 UI 或 Go 模板页面）。
   - 提交用户名/密码（+2FA）后验证通过。
2. 验证通过后：
   - 生成 `authorization_code`，绑定：
     - 用户 ID、client_id、redirect_uri、code_challenge、过期时间（如 5 分钟）、一次性使用标记。
   - 将授权码存储到 Redis 或数据库表中。
   - 重定向回 `redirect_uri`：
     - `redirect_uri?code=<auth_code>&state=<state>`

### 3.2 Token 端点：`POST /oauth/token`

职责：发放 access_token 与 refresh_token，处理刷新请求。

#### 3.2.1 授权码模式：`grant_type=authorization_code`

请求（x-www-form-urlencoded 或 JSON）：

- `grant_type=authorization_code`
- `code`：授权码。
- `redirect_uri`
- `client_id`
- `code_verifier`

处理步骤：

1. 根据 `code` 查询授权码记录：
   - 验证未过期、未使用、client_id 与 redirect_uri 匹配。
2. 使用 `code_verifier` 计算 `code_challenge` 并与记录中的值比对。
3. 验证通过后：
   - 标记授权码为已使用。
   - 基于用户信息调用现有 `GenerateTokens` 生成：
     - access_token（短期）。
     - refresh_token（长期，带 token family 信息）。
   - 写入/更新会话表（`user_sessions`）：
     - 存储 refresh_token 哈希、设备信息（从 User-Agent/IP 提取）、过期时间等。
   - 通过 `Set-Cookie` 写入 HttpOnly refresh_token Cookie（例如 `easyssh_refresh_token`）。
4. 响应 JSON：

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

不在 JSON 中返回 refresh_token，确保它只存在于 Cookie 中。

#### 3.2.2 刷新模式：`grant_type=refresh_token`

请求：

- `grant_type=refresh_token`
- 不要求在请求体中携带 refresh_token 字段，由后端从 HttpOnly Cookie 中读取（符合“refresh_token 仅在 Cookie”这一要求）。

处理步骤：

1. 从 Cookie 中读取 refresh_token（`easyssh_refresh_token`）。
2. 复用现有 `RefreshToken` + `RefreshAccessToken` 逻辑：
   - 验证签名、audience、绝对/闲置过期。
   - 轮换（如启用）：生成新 refresh_token，标记旧 token 已使用。
   - 通过哈希在 `user_sessions` 中查找会话记录，验证会话未撤销且未过期。
   - 更新 `LastActivity` 和 `ExpiresAt`（滑动闲置过期）。
3. 返回：

```json
{
  "access_token": "<new_jwt>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

并通过 `Set-Cookie` 更新 refresh_token Cookie（如产生了新值）。

### 3.3 业务 API 端点

重构目标：

- 所有需要认证的 REST API：
  - **不再从 Cookie 读取 access_token**。
  - 只从 `Authorization: Bearer <access_token>` 中取 token。
- WebSocket：
  - 统一通过查询参数 `token=<access_token>` 进行鉴权。

认证中间件（新）：

- 逻辑：
  1. 从 `Authorization` 头解析出 Bearer token。
  2. 调用 `ValidateToken` 验证 JWT（签名、过期、黑名单、family 撤销等）。
  3. 向 Gin Context 写入用户信息（`user_id`、`role` 等）。
  4. 若无 token 或无效，返回 `401`。

### 3.4 登出与撤销

端点示例：

- `POST /auth/logout`

行为：

1. 从 `Authorization` 头取 access_token，解析出 `TokenFamily`（如有）。
2. 从 Cookie 取 refresh_token（若存在）。
3. 执行：
   - 将当前 access_token 加入黑名单（保持已有逻辑）。
   - 将对应 refresh_token（及其家族）标记为撤销：
     - 在 Redis 中记录 family 撤销标记。
     - 删除/失效 `user_sessions` 中关联的会话记录。
4. 清除 refresh_token Cookie（`Set-Cookie Max-Age=-1`）。

---

## 4. 后端重构方案（一次性切换）

### 4.1 移除旧的 Cookie-only 访问令牌策略

- 删除/停用：
  - `easyssh_access_token` Cookie 的写入逻辑。
  - 从 Cookie 读取 access_token 的认证中间件实现。
- 保留：
  - refresh_token 的 Cookie 配置与会话管理逻辑（将在新方案中复用）。

### 4.2 新增 OAuth 相关模型与存储

- 新增 `authorization_codes` 表或使用 Redis：
  - 字段：`code`、`user_id`、`client_id`、`redirect_uri`、`code_challenge`、`expires_at`、`used` 等。
  - 也可增加 `scopes` 字段，方便未来扩展。
- 保留现有 `user_sessions` 表，用于 refresh_token 绑定设备/会话。

### 4.3 实现 `/oauth/authorize`

- 在 REST 层新增控制器：
  - 校验 `client_id` 与 `redirect_uri`（仅允许预配置的白名单）。
  - 校验 `code_challenge` 和 `code_challenge_method`（只支持 S256）。
  - 未登录时展示登录页（可通过服务器端渲染的简单页面或重用前端的 `/login` 组件）。
  - 登录成功后生成授权码并重定向。

### 4.4 实现 `/oauth/token`

- 在 REST 层新增控制器：
  - 解析表单/JSON，区分 `grant_type`。
  - 对授权码模式与刷新模式各自调用已有的 auth 服务与 JWT 服务。
  - 负责：
    - 将 refresh_token 写入 HttpOnly Cookie（沿用 `CookieConfig`）。
    - 构造返回的 access_token JSON。

### 4.5 替换认证中间件为 Bearer-only

- 新写一个 Bearer Auth 中间件：
  - 支持对所有 `/api/v1/**` 资源路由启用。
  - 不再依赖 Cookie 中的 access_token。
- 如有必要，可为少数无需登录但可选择性带 token 的接口（例如 `/users/me`）添加“可选认证”分支。

### 4.6 调整登出与会话撤销逻辑

- 更新 `/auth/logout`：
  - 改为同时处理：
    - access_token 黑名单。
    - token family 撤销（Redis + user_sessions）。
  - 清除 refresh_token Cookie。
- 确保“从 UI 手动注销某个设备/会话”时：
  - 对应的 refresh_token family 被撤销。
  - 后续刷新请求都会失败，要求用户重新登录。

---

## 5. 前端重构方案（一次性切换）

### 5.1 PKCE 登录流程

1. 在前端 Auth 模块中实现 PKCE 工具：
   - 生成随机 `code_verifier`（高熵字符串）。
   - 使用 `SHA-256` + Base64URL 编码得到 `code_challenge`。
   - 将 `code_verifier` 与 `state` 保存在内存或 `sessionStorage` 中（仅在当前标签页有效）。
2. 构造授权请求 URL：

```ts
const url = new URL('/oauth/authorize', window.location.origin);
url.searchParams.set('response_type', 'code');
url.searchParams.set('client_id', 'easyssh-web');
url.searchParams.set('redirect_uri', window.location.origin + '/auth/callback');
url.searchParams.set('scope', 'openid profile easyssh');
url.searchParams.set('code_challenge_method', 'S256');
url.searchParams.set('code_challenge', codeChallenge);
url.searchParams.set('state', state);
window.location.href = url.toString();
```

3. 在 `/auth/callback` 路由中：
   - 读取 URL 中的 `code`、`state`。
   - 从 `sessionStorage` 取出对应的 `code_verifier` 与原始 `state`，校验一致。
   - 调用 `POST /oauth/token (grant_type=authorization_code)` 获取 access_token。
   - 将 access_token 存入内存（全局 store），然后重定向到原目标页面。

### 5.2 access_token 管理与 API 客户端

- 新建一个轻量的 token store（例如 React context 或单例模块）：
  - `setAccessToken(token, expiresAt)`
  - `getAccessToken()`
  - `clearAccessToken()`
- 修改 `api-client`：
  - 在每次请求前，从 store 中读取 access_token。
  - 在 `fetch` 的 `headers` 中添加：

```ts
if (accessToken) {
  headers['Authorization'] = `Bearer ${accessToken}`;
}
```

  - 除了 `/oauth/token` 和刷新端点外，所有请求默认 `credentials: 'omit'`，不再依赖 Cookie（可根据具体跨域情况决定）。

### 5.3 刷新策略

- 在 `apiFetch` 中保留统一的 401 处理逻辑，但改造为：
  1. 若收到 401 且当前有 access_token：
     - 调用 `POST /oauth/token`，`grant_type=refresh_token`（请求体中只需要 `grant_type`，refresh_token 由 Cookie 提供）。
     - 刷新成功后更新内存中的 access_token。
     - 重放一次原请求。
  2. 如果刷新失败（401 或其他错误）：
     - 清空本地 access_token。
     - 跳转到登录（PKCE 流程的起点），可附带 `next` 参数。

### 5.4 登出流程

- 前端登出操作：
  - 调用带 Bearer 的 `POST /auth/logout`。
  - 不管返回成功与否，清空本地 access_token store。
  - 重定向到登录页面或首页。

---

## 6. 安全加固要点（最佳实践要求）

### 6.1 XSS 防御

由于 access_token 将存在于 JS 内存中，XSS 风险需要被视为最高级别威胁之一：

- 启用并收紧 CSP（Content Security Policy），限制脚本来源。
- 避免危险 API（`innerHTML`、`eval` 等），严格审查第三方依赖。
- 对可视化输出进行统一的转义/编码处理。
- 使用现代框架最佳实践（React/Next 默认就相对安全，但仍需避免把用户输入直接插入为 HTML）。

### 6.2 CSRF 防御

虽然业务 API 不再依赖 Cookie，但以下端点仍会读取 Cookie 中的 refresh_token：

- `/oauth/token`（`grant_type=refresh_token`）
- 可能存在的其他“会话管理”端点

建议：

- 使用 `SameSite` 属性（`lax` 或在跨站场景下结合 Origin 校验）。
- 对这些端点检查 `Origin`/`Referer` 是否为可信站点。
- 如仍有担心，可为刷新端点引入 CSRF Token 机制。

### 6.3 速率限制与风控

- 对 `/oauth/authorize` 登录提交、`/oauth/token` 和刷新端点添加速率限制：
  - 基于 IP、用户名、deviceId 等维度。
- 将异常行为（短时间大量刷新失败、复用检测触发等）作为风控信号：
  - 自动撤销相关 token family。
  - 标记账号需要额外验证（如强制重新登录或 2FA）。

### 6.4 审计与日志

- 登录成功/失败、刷新失败、复用检测触发、登出与会话撤销都应写入审计日志。
- 便于事后排查“token 泄露或异常登录”场景。

---

## 7. 上线与迁移策略（不兼容切换）

既然不要求兼容旧方案，可以采用一次性切换，但仍建议按以下步骤控制风险：

1. **数据库与配置准备**
   - 创建 `authorization_codes` 存储（表或 Redis）。
   - 确认 `user_sessions` 表结构满足需求，如需额外字段一并迁移。
   - 配置好新的环境变量（`JWT_*`、`COOKIE_*`、`ALLOWED_ORIGINS` 等）。
2. **后端重构完成并单独联调**
   - 本地或测试环境用简单 SPA/脚本模拟 PKCE 流程，确保 `/oauth/authorize` 与 `/oauth/token` 工作正常。
   - 使用 Postman/HTTPie 验证 Bearer 认证的 API 与 WebSocket。
3. **前端接入 PKCE 并联调**
   - 在测试环境完成前后端整体联调：登录 → 刷新 → 登出 → 会话管理。
4. **停机（或短暂维护窗口）切换**
   - 停止旧版本服务。
   - 部署新版本后端与前端。
   - 可选：清空旧的 session/token 黑名单相关数据，强制所有用户重新登录。
5. **上线后监控**
   - 重点监控：
     - 登录成功率、刷新失败率。
     - 401 返回占比。
     - 授权码使用异常（重用、过期被用）情况。

通过以上步骤，可以在不引入兼容层/开关的情况下，直接将 EasySSH 的认证体系升级为基于 Authorization Code + PKCE 的现代方案，同时保留现有 refresh_token 会话管理与安全强化能力。 

