# @easyssh/ssh-workspace

`@easyssh/ssh-workspace` 是 EasySSH 内部的 SSH/SFTP Workspace 包名入口。

当前阶段它是一个 facade：实际实现仍位于 `web/src/components/ssh-workspace`、`web/src/lib/session` 与相关 runtime store，包入口提供稳定导入名，供 Web Dashboard 与 Desktop Shell 对齐依赖边界。

入口约定：

- `@easyssh/ssh-workspace`：Web/UI Kit 主入口，暴露 Workspace context、UI building blocks、session/transfer core 与 Web 当前 adapters。
- `@easyssh/ssh-workspace/desktop`：Desktop Shell 轻量入口，只暴露桌面挂载所需的 Workspace 根组件、context、基础 settings、capabilities helper 和 adapter/types，避免把 Web/Next 专属 UI barrel 带入 Wails 前端。

当前公开边界覆盖：

- `SshWorkspace` 根组件、Workspace context 和 UI building blocks。
- SFTP API/session core、目录加载、文件操作、传输任务映射和非 React transfer controller。
- adapters/capabilities：i18n、notifier、settings、preferences、theme、panes、auth ticket、transfer manager、transfer history、session store、session controller 和 runtime capability 映射。
- Web 当前 SFTP/Terminal store 的 Workspace adapter，以及 Desktop Shell 本地 adapter 接入边界。

后续迁移原则：

- 保持 `@easyssh/ssh-workspace` 包名稳定。
- 先迁移纯 session/core、adapter 合约和无 Dashboard 外壳 UI。
- 不把 Dashboard 侧边栏、导航、权限、系统设置页或 Web 专属路由逻辑迁入包内。
- Wails/Desktop Shell 通过 adapters、capabilities、runtime profile 和 pane/theme/preference 注入挂载 Workspace；真实 server picker、导航、设置注册表和运行形态能力继续留在 Shell 层。
