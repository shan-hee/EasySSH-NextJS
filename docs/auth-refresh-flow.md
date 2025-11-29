# 认证与会话刷新流程说明（前端视角）

本文件描述 Web 前端在新的认证体系下如何处理：

- 首次加载 / 刷新
- 页面级业务请求的触发时机
- Access Token 的自动刷新与定时刷新
- 401 未授权时的统一处理

便于后续在开发新的 Dashboard 页面或重构登录逻辑时保持一致行为。

---

## 1. 全局参与者

### 1.1 `SystemConfigProvider`（`web/src/contexts/system-config-context.tsx`）

- 组件挂在应用根布局 `app/layout.tsx` 下，全局唯一。
- 启动时调用 `authApi.checkStatus()`：
  - 首先请求 `/auth/status`：
    - 若已认证（存在有效的 access_token），返回用户信息与系统配置；
    - 若未认证，则尝试静默刷新一次。
  - 静默刷新通过 `performRefreshToken()` 调用 `/oauth/token`（`grant_type=refresh_token`）：
    - 成功：写入新的 access_token 到 `useAuthStore`，再重新请求 `/auth/status`；
    - 失败：保持未认证状态。
- 将返回的 `system_config` 写入全局配置，并在 `authStatus` 中保存当前认证信息。

### 1.2 `useAuthReady`（`web/src/hooks/use-auth-ready.ts`）

统一的「认证就绪」 Hook，用于业务页面判断何时可以安全发起接口请求：

- 依赖 `SystemConfigProvider` 和 `ClientAuthProvider`：
  - 从 `useSystemConfig()` 中读取 `authStatus` 与 `isLoading`；
  - 从 `useClientAuth()` 中读取 `isAuthenticated`。
- 返回：
  - `ready`：
    - `!isLoading && !!authStatus && authStatus.is_authenticated && isAuthenticated`；
    - 即：全局 `/auth/status` 已加载完毕，并且会话已通过认证。
  - `isAuthenticated`：客户端认证上下文中的布尔值（由 DashboardLayout 初始化）。
  - `authStatus`：最近一次 `/auth/status` 返回值。
  - `isInitializing`：是否仍在加载 `/auth/status`。

**使用约定：**

- 所有需要登录态的 Dashboard 子页面/客户端组件，首轮业务请求都应当在 `ready === true` 时触发。
- 典型写法：

```ts
const { ready } = useAuthReady()

useEffect(() => {
  if (!ready) return
  loadData()
}, [ready])
```

### 1.3 `performRefreshToken`（`web/src/lib/session-refresh.ts`）

统一的 refresh_token 刷新工具，所有 `/oauth/token`（`grant_type=refresh_token`）调用都通过它完成。

- 限定在浏览器端执行（服务端调用会抛错）。
- 步骤：
  1. 基于 `getApiBase()` 或 `window.location.origin` 构造 `/oauth/token` 完整 URL；
  2. 根据是否跨域选择 `credentials`：`same-origin` 或 `include`；
  3. 发送 `POST` 请求，`body: { grant_type: "refresh_token" }`；
  4. 解析响应（兼容 `{ access_token, expires_in }` 与 `{ data: { ... } }`）；
  5. 调用 `useAuthStore.getState().setToken(accessToken, expiresIn)` 更新内存中的 access_token；
  6. 返回 `{ accessToken, expiresIn }`。

**当前使用位置：**

- `authApi.checkStatus()`：启动/刷新时的静默刷新。
- `apiFetch` 在收到 401 时的自动刷新流程。
- `SessionRefreshProvider` 中的定时刷新（根据 TTL 安排下一次刷新）。

### 1.4 `apiFetch` 与 401 处理（`web/src/lib/api-client.ts`）

所有前端调用后端 REST API 都通过 `apiFetch` 封装，功能包括：

- 动态选择 API 基础 URL（`getApiUrl()`）；
- 自动附加 `Authorization: Bearer <access_token>` 头（除 `/oauth/*` 端点外）；
- 超时控制、重试逻辑（针对网络错误和 5xx）。

**401 处理逻辑：**

1. 若在浏览器端收到 401：
   - 调用 `refreshSession()`：
     - 内部使用 `performRefreshToken()` 执行一次刷新；
     - 使用全局 `refreshPromise` 锁避免并发重复刷新。
   - 刷新成功后，重放原请求一次：
     - 若仍然 401，则认为会话失效，调用 `handleGlobalUnauthorized()`。
2. 若刷新失败：
   - 调用 `handleGlobalUnauthorized()`。

**`handleGlobalUnauthorized()`：**

- 计算当前路径（含 query/hash），若在 `/login` 上则仅记录日志，不做跳转；
- 使用全局标记 `hasRedirectedFor401` 避免多次重定向；
- 将用户重定向到 `/login`，附带 `next` 参数保存原始路径。

### 1.5 401 重定向标记生命周期

文件：`web/src/lib/api-client.ts`

- 变量：

```ts
let hasRedirectedFor401 = false
```

- 导出工具函数：

```ts
export function resetUnauthorizedRedirectFlag() {
  hasRedirectedFor401 = false
}
```

- 使用场景：
  - 在登录页面挂载时（`web/src/components/login-form.tsx`）调用：

  ```ts
  useEffect(() => {
    resetUnauthorizedRedirectFlag()
  }, [])
  ```

  表示进入登录页后开始新的认证周期，下次遇到 401 时可以再次触发一次重定向。

---

## 2. 页面级认证约定

### 2.1 Dashboard 子页面

凡是挂在 `/dashboard/**` 下、需要登录态并会访问后端 API 的页面或 CSR 客户端组件，应遵循：

1. 在组件内部调用 `useAuthReady()`；
2. 使用 `ready` 作为首轮数据加载的触发条件；
3. `ready === false` 期间，页面可以：
   - 显示骨架屏或「页面级加载中」占位；
   - 或者在某些静态页面中暂时 `return null`（不推荐，建议使用轻量占位）。

示例（以脚本库页面为例，`web/src/app/dashboard/scripts/page.tsx`）：

```ts
const { ready } = useAuthReady()

const [scripts, setScripts] = useState<Script[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  if (!ready) return
  setLoading(true)
  loadScripts()
}, [ready, page, pageSize])
```

### 2.2 纯静态 / mock 页面

对于当前仍使用 mock 数据或纯静态 UI 的页面（例如：

- AI 助手：`app/dashboard/ai-assistant/page.tsx`
- 存储空间：`app/dashboard/storage/page.tsx`
- 自动化历史：`app/dashboard/automation/history/page.tsx`
- 告警规则：`app/dashboard/monitoring/alerts/page.tsx`

已预先接入 `useAuthReady`，并在 `!ready` 时暂时不渲染内容，以便未来接入真实接口时可以直接在 `ready` 基础上增加数据请求逻辑。

约定：

- 将来改为真实数据时，遵循与其他页面一致的模式：
  - 把 mock 数据替换为从 API 获取的数据；
  - 保持现有骨架/占位 UI；
  - 数据加载的 `useEffect` 必须依赖 `ready`。

---

## 3. 登录 / 登出与全局状态

### 3.1 登录成功后的行为

文件：`web/src/components/login-form.tsx`

- 登录流程完成并拿到 access_token 后，前端会：
  - 写入 access_token 到 `useAuthStore`；
  - 调用 `refreshConfig()` 重新触发 `/auth/status`；
  - 重定向到目标页面（`next` 或 `/dashboard`）。
- 其中 `refreshConfig()` 会再次调用 `authApi.checkStatus()`，确保：
  - `authStatus` 与 `system_config` 更新；
  - `SessionRefreshProvider` 可以根据最新 TTL 安排定时刷新。

### 3.2 登出行为

文件：`web/src/components/client-auth-provider.tsx`

- 前端 `logout()` 会：
  - 调用 `authApi.logout()` 通知后端清理 Cookie / 会话；
  - 清空前端 `useAuthStore` 中的 access_token；
  - 调用 `refreshConfig()` 更新全局 `authStatus`；
  - 跳转到 `/login`。

**建议：**

- 如需在前端手动重置 401 重定向标记，可调用 `resetUnauthorizedRedirectFlag()`（例如在登录页挂载时或特定场景下）。

---

## 4. 为新页面接入认证与刷新时的 Checklist

1. 页面是否在 `/dashboard/**` 下并需要登录态？
   - 是：必须使用 `useAuthReady()` 作为首轮加载 gating。
2. 页面是否在首屏就发起后端请求？
   - 是：将请求放入依赖 `ready` 的 `useEffect`。
3. 页面是否需要在刷新后自动续期 access_token？
   - 全局自动处理，无需单独关注，只需使用 `apiFetch`。
4. 页面是否可能收到 401？
   - 是：正常使用 `apiFetch`，401 将自动尝试刷新并在失败时跳转到 `/login`。
5. 页面是否使用 mock 数据，未来会接真实数据？
   - 建议现在就接入 `useAuthReady()`，
   - 并在文档/注释中标明：未来的数据请求应放到 `ready` 之后执行。

