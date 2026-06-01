# Session Core Boundary

`web/src/lib/session` 是后续 SSH/SFTP Workspace 的第一层共享边界。这里先收拢连接身份类型、纯 SFTP 目录加载逻辑、SFTP 操作内核，以及可注入的 Workspace 合约；现阶段不移动终端和 SFTP 的现有 UI。

## 纯内核

- `types.ts`：终端与 SFTP 会话共享的服务器连接身份类型。
- `sftp-directory.ts`：SFTP 页面与终端文件管理器共用的目录列表归一化逻辑，支持显式注入 `api`。
- `sftp-operations.ts`：删除、创建、重命名、保存、批量删除等 SFTP 操作的共享执行逻辑，使用显式 `notifier`、`setFiles` 和可选 `api` 注入。
- `sftp-session-api.ts`：Workspace 级 SFTP API 合约，聚合目录加载、文件操作、下载、读文件、批量下载、chmod 和连接关闭；默认合并当前 Web `sftpApi`，外部 adapter 只需覆盖需要替换的方法。
- `workspace-settings.ts`：Workspace 级设置 helper，目前只承接 SFTP 批量下载排除规则的默认值与解析逻辑；Shell 通过 `settings.sftp.downloadExcludePatterns` 注入，不把整套系统设置放入 Workspace。
- `transfer-tasks.ts`：上传任务状态到 `WorkspaceTransferTask` 的映射、上传/跨服务器传输任务对象构造、任务进度合并，以及上传/传输 WebSocket 消息到任务 update 的归一化。
- `transfer-runtime.ts`：传输进度 WebSocket 的 ticket/url 建连、active 判断、等待打开、取消消息发送、关闭，XHR/WebSocket handle store、取消标记、任务取消、批量清理，以及上传并发 limiter；`useFileTransfer` 已可注入 SFTP API、ticket provider、WebSocket URL resolver、WebSocket 构造器和上传 limiter，`useSftpUploadWebSocket` 已可注入 ticket provider、WebSocket URL resolver 和 WebSocket 构造器。当前 hook 仍负责 React 状态和 API 调用时序编排。
- `workspace.ts`：Workspace 的能力声明、终端/SFTP 会话快照、传输任务和 Shell adapter 合约；其中 `apiClient.sftp` 可替换 Workspace 内目录加载、文件操作、读写、下载、批量下载、chmod 和连接关闭，`settings.sftp.downloadExcludePatterns` 承接批量下载排除规则，`preferences` 承接工作台内部的小型 UI 偏好，`notifier.action` 承接带操作按钮的提示，`authTicketProvider` 与 `apiClient.terminal.createWebSocketUrl` 可替换终端 WebSocket ticket/url runtime，`apiClient.terminal.saveVerifiedCredential` 承接终端补充凭据保存。
- `workspace-adapters.ts`：Web 当前 i18n、notifier、settings、preferences、auth ticket provider 和 transfer manager 到 Workspace adapter/runtime provider 的轻量适配工厂，避免页面反复手写 adapter 对象；其中 `createBrowserWorkspacePreferenceAdapter` 只把浏览器存储包装为窄接口，Desktop Shell 后续可替换为自己的偏好存储。
- `websocket-terminal.ts`、`api/sftp.ts`、`sftp-file-utils.ts`：现有底层能力的聚合导出入口。

## 仍需解耦

`performXxx` SFTP 操作函数已经离开 hook，当前通过显式传入 `notifier`、翻译函数和文件列表更新器复用。它们仍处于应用内共享操作层，但已经可以被 Workspace runtime 组合。

`TerminalWebSocket` 已支持注入 ticket provider、WebSocket URL resolver 和 WebSocket 构造器，`WebTerminal` 会优先消费 Workspace adapters；未注入时仍回退到当前 Web 默认实现。

终端内文件管理器的 `useSftpSession` 已可接收 SFTP API、notifier、i18n 翻译函数和 `useFileTransfer` runtime 注入项；`TabTerminalContent` 会优先从 Workspace `apiClient.sftp`、`notifier`、`i18n` 和 `authTicketProvider` 派生这些依赖。`/sftp` 页面也已通过同一 `SftpSessionApi` adapter 处理目录加载、文件操作、读文件、下载和批量下载，并暴露到 Workspace `apiClient.sftp`。SFTP UI Kit 文案已通过 Workspace `i18n` adapter 解析，批量下载排除规则已通过 Workspace `settings` adapter 注入，SFTP 视图模式和终端内文件面板宽度已通过 Workspace `preferences` adapter 持久化；Web Dashboard 负责用当前 `next-intl` 翻译函数、系统配置和浏览器存储创建 adapter，Desktop Shell 后续可直接替换这些 adapter。

导航、Dashboard 侧边栏、Runtime Profile 判断、设置、服务器选择器、权限等 Shell 专属依赖应继续留在本目录外。Workspace 只通过 adapters 或 capabilities 消费这些能力；当某个 Web 默认实现仍保留在组件内时，应同时提供可注入 adapter，保证后续 Desktop Shell 可以替换。
