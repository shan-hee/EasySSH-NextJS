# SSH Workspace UI Kit

`web/src/components/ssh-workspace` 是当前 Web 内部的可嵌入 SSH/SFTP Workspace 入口。它不实现 Dashboard 侧边栏、导航、权限、设置或运行形态判断，只提供工作台根组件、上下文和终端/SFTP/传输 UI building blocks。

当前导出的主要能力：

- `SshWorkspace`、`useSshWorkspace`：承接 adapters、capabilities、layout 和 session snapshot 的可嵌入根组件。
- `useWorkspaceTranslator`、`useWorkspaceSftpTranslator`、`useWorkspaceCommonTranslator`：UI Kit 内部消费 Workspace `i18n` adapter 的翻译 hook；未挂载 Workspace 时只返回 key，Web Dashboard 需通过 `createWorkspaceI18nAdapter` 注入 `common`、`terminal`、`sftp` 等 namespace。
- `createWorkspaceAdapters`、`createWorkspaceI18nAdapter`、`createWorkspaceNotifierAdapter`、`createWorkspaceSettingsAdapter`、`createBrowserWorkspacePreferenceAdapter`、`createWorkspaceAuthTicketProviderAdapter`、`createWorkspaceTerminalAuthTicketProviderAdapter`、`createWorkspaceTransferAuthTicketProviderAdapter`、`createWorkspaceTransferManagerAdapter`：把 Web 当前依赖整理成 Workspace adapter/runtime provider 的轻量工厂。
- `DEFAULT_SFTP_DOWNLOAD_EXCLUDE_PATTERNS`、`parseWorkspaceDownloadExcludePatterns`：SFTP 批量下载排除规则的默认值和解析 helper；Web Dashboard 通过 `settings.sftp.downloadExcludePatterns` 注入，UI Kit 不直接读取系统配置。
- `createUploadTransferTask`、`createServerTransferTask`、`mapUploadTaskStatusToTransferTask`、`mergeTransferTaskUpdate`、`mapUploadProgressMessageToTransferUpdate`、`mapTransferProgressMessageToTaskUpdate`：传输任务到 Workspace 合约的纯映射、构造、进度合并和 WebSocket 消息归一化 helper。
- `createTransferProgressWebSocket`、`isTransferWebSocketActive`、`waitForTransferWebSocketOpen`、`sendTransferCancelMessage`、`closeTransferWebSocket`、`createTransferRuntimeHandleStore`、`registerTransferXhr`、`registerTransferWebSocket`、`cancelTransferRuntimeTask`、`clearTransferRuntimeTaskHandles`、`releaseTransferRuntimeTaskHandles`、`createTransferConcurrencyLimiter`：传输进度 WebSocket 的建连、active 判断、等待、取消、关闭，XHR/WebSocket handle store、取消标记、批量清理和上传并发 limiter runtime helper；当前 Web hooks 已可注入 SFTP API、ticket provider、WebSocket URL resolver、WebSocket 构造器和上传 limiter，但仍负责 React 状态和 API 调用时序编排。
- `createSftpSessionApi`、`defaultSftpSessionApi`、`useSftpSession`：Workspace 级 SFTP API/session runtime 边界，覆盖目录加载、文件操作、下载、读文件、批量下载、chmod 和连接关闭；终端内文件管理器支持注入 SFTP API、notifier、i18n 翻译函数和 `useFileTransfer` runtime 选项，`/sftp` 页面也通过同一 adapter 暴露 `apiClient.sftp`。默认 SFTP API 仍合并当前 Web `sftpApi`，notifier 默认为 no-op，Web Dashboard 通过 Workspace `notifier` 与 `i18n` adapter 注入真实提示和文案。
- `createSftpWorkspaceSessionStoreAdapter`、`createTerminalWorkspaceSessionStoreAdapter`：把当前 Web SFTP/Terminal runtime store 暴露成 Workspace `sessionStore` adapter。
- `WebTerminal`、`TerminalWebSocket` runtime types、`useTerminalAuthFlow`、`useTerminalAuthFlowAdapters`、`useTerminalCompletionController`、`useTerminalConnectionController`、`useTerminalInputActions`、`useTerminalAutoFit`、`useTerminalRendererSettings`、`useTerminalConnectionErrorFormatter`、`useTerminalContainerApi`：终端 pane、可注入的 terminal WebSocket ticket/url/socket runtime，以及认证流程、认证依赖适配、补全 provider/弹窗/输入流控制、连接生命周期胶水层、输入/剪贴板动作、尺寸自适应、渲染设置同步、连接错误文案映射和容器公开方法等无 Dashboard 外壳的终端 building blocks。
- `FileManagerPanel`、`SftpManager`、`useSftpFileBrowserController`、`useSftpDragDropController`、`useSftpFileActionController`、`useSftpWorkspaceHeaderController`、`SftpWorkspaceToolbar`、`SftpFileToolbar`、`SftpFileBrowserPane`、`SftpFileBrowserState`、`SftpContextMenu`、`SftpFileTableHeader`、`SftpFileEditorPane`、`SftpCreateEntry`、`SftpFileActionDropdown`、`SftpFileTableRow`、`SftpFileGridItem`、`SftpSessionCard`：SFTP 文件管理 pane、文件浏览 controller、拖拽/上传 controller、文件动作 controller、工作区 header/path controller、顶部工具栏、搜索条、文件浏览/虚拟滚动壳、状态外壳、右键菜单、表格头、文件编辑器 pane、inline 新建项、文件动作下拉菜单、列表行、网格卡片与会话壳；`SftpManager` 会优先使用显式传入的传输任务 props，否则消费 Workspace `transferManager`，文案通过 Workspace `i18n` adapter 解析，批量下载排除规则通过 Workspace `settings` adapter 读取，SFTP 视图模式和终端内文件面板宽度通过 Workspace `preferences` adapter 持久化。
- `getSftpFileTypeInfo`、`renderSftpFileListIcon`：SFTP 文件类型图标与颜色映射。
- `TransferTaskPanel`、`UploadProgressItem`：传输任务展示。
- `SortableSession`、`DragPreviewToolbar`：多 SFTP 会话排序和跨会话拖拽辅助。
- `TerminalAuthChallengeDialog`、`TerminalHostKeyDialog`：终端连接过程中的认证和主机密钥确认 UI；凭据保存与通知通过 `TerminalAuthFlowAdapters` 或 Workspace adapters 注入。

类型和 adapter 合约来自 `@/lib/session/workspace`。`apiClient.sftp` 可替换 Workspace 内的 SFTP API，包括目录加载、文件操作、读写、下载、批量下载、chmod 和连接关闭；`i18n` 提供 UI Kit 文案，`settings.sftp.downloadExcludePatterns` 提供批量下载排除规则，`preferences` 提供视图模式、面板宽度等工作台内部小型 UI 偏好，`notifier.action` 用于带操作的提示，`authTicketProvider` 与 `apiClient.terminal.createWebSocketUrl` 可替换终端 WebSocket ticket/url runtime，`apiClient.terminal.saveVerifiedCredential` 用于保存终端补充凭据。后续如果提取到 `packages/ssh-workspace`，这里应成为迁移清单，而不是继续吸收 Dashboard 专属依赖。

当前 `/terminal` 与 `/sftp` Dashboard 入口已经挂载 `SshWorkspace`，并通过 Workspace adapters 暴露 SFTP API、auth ticket、i18n、settings、preferences、session store、notifier 和 transfer manager；页面自己的导航、服务器选择、页签编排仍保留在 Shell/page 层。
