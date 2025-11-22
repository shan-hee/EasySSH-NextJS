# 终端命令补全功能

## 功能概述

WebSSH 终端现已支持智能命令补全功能,提供类似 IDE 的补全体验。

## Phase 1: 本地命令补全 (已实现)

### 功能特性

- ✅ **Tab 键触发**: 按 Tab 键触发补全
- ✅ **本地命令库**: 内置 200+ 常用 Linux/Unix 命令
- ✅ **子命令补全**: 支持 git、docker、npm 等工具的子命令补全
- ✅ **键盘导航**: 使用 ↑↓ 键导航,Enter 确认,Esc 关闭
- ✅ **智能排序**: 前缀匹配优先,按优先级和字母顺序排序
- ✅ **可视化 UI**: 显示命令类型图标、描述和来源标签

### 使用方法

1. **触发补全**
   - 在终端中输入命令前缀,例如 `gi`
   - 按 `Tab` 键触发补全
   - 补全弹窗会显示匹配的命令列表

2. **导航和选择**
   - `↑` / `↓`: 在补全列表中上下移动
   - `Enter`: 确认选择当前高亮的补全项
   - `Esc`: 关闭补全弹窗
   - 鼠标点击: 直接点击补全项

3. **示例**
   ```bash
   # 输入 "gi" 然后按 Tab
   gi<Tab>
   # 显示: git, gzip 等命令

   # 输入 "git a" 然后按 Tab
   git a<Tab>
   # 显示: add 子命令

   # 输入 "doc" 然后按 Tab
   doc<Tab>
   # 显示: docker 命令
   ```

### 支持的命令类别

#### 文件系统操作
- `ls`, `cd`, `pwd`, `mkdir`, `rm`, `cp`, `mv`, `touch`, `find`, `tree`

#### 文本处理
- `cat`, `grep`, `sed`, `awk`, `sort`, `uniq`, `wc`, `less`, `vim`, `nano`

#### 系统管理
- `ps`, `top`, `htop`, `kill`, `chmod`, `chown`, `sudo`, `systemctl`

#### 网络工具
- `ping`, `curl`, `wget`, `ssh`, `scp`, `rsync`, `netstat`, `ip`

#### 开发工具
- `git` (20+ 子命令)
- `docker` (15+ 子命令)
- `npm`, `yarn`, `pnpm` (各 10+ 子命令)
- `python`, `node`, `go`, `cargo`

#### 压缩归档
- `tar`, `gzip`, `zip`, `unzip`, `bzip2`, `xz`

### 技术架构

```
CompletionEngine (引擎核心)
    ├── LocalCommandProvider (本地命令)
    ├── RemoteShellProvider (远端 Shell - Phase 2)
    └── HistoryProvider (历史记录 - Phase 3)
```

### 文件结构

```
src/lib/completion/
├── types.ts                    # 类型定义
├── utils.ts                    # 工具函数
├── completion-engine.ts        # 补全引擎
├── providers/
│   ├── local-command-provider.ts   # 本地���令提供者
│   ├── remote-shell-provider.ts    # 远端补全 (Phase 2)
│   └── history-provider.ts         # 历史补全 (Phase 3)
└── index.ts                    # 导出

src/components/terminal/
├── completion-item.tsx         # 补全项组件
├── completion-popup.tsx        # 补全弹窗组件
└── web-terminal.tsx            # 终端组件 (已集成)
```

## Phase 2: 远端 Shell 补全 (计划中)

### 功能规划

- [ ] 通过 WebSocket 请求远端 shell 补全
- [ ] 支持 Bash `compgen` 命令
- [ ] 支持 Zsh completion 系统
- [ ] 补全结果缓存 (LRU)
- [ ] 超时和降级机制

### 实现步骤

1. **后端改造**
   - 扩展 WebSocket 消息协议
   - 实现 Shell 补全服务
   - 添加补全消息处理

2. **前端集成**
   - 创建远端补全提供者
   - 更新 WebSocket 客户端
   - 合并本地和远端结果

## Phase 3: 增强功能 (计划中)

### 功能规划

- [ ] 历史命令补全
- [ ] 模糊匹配算法
- [ ] 补全配置界面
- [ ] 自动触发模式
- [ ] 虚拟滚动优化

### 配置选项

```typescript
interface CompletionConfig {
  enabled: boolean              // 是否启用
  trigger: "tab" | "auto"       // 触发方式
  autoTriggerDelay: number      // 自动触发延迟
  maxItems: number              // 最大显示数量
  providers: {
    local: boolean              // 本地命令
    remote: boolean             // 远端 Shell
    history: boolean            // 历史记录
  }
}
```

## 开发指南

### 添加新命令

编辑 `local-command-provider.ts`:

```typescript
const COMMON_COMMANDS: CommandDefinition[] = [
  // 添加新命令
  {
    name: "mycommand",
    description: "我的自定义命令",
    subcommands: ["sub1", "sub2"]
  },
  // ...
]
```

### 创建自定义提供者

```typescript
import type { CompletionProvider, CompletionContext, CompletionItem } from "../types"

export class MyCustomProvider implements CompletionProvider {
  name = "my-provider"
  priority = 5
  enabled = true

  async getCompletions(context: CompletionContext): Promise<CompletionItem[]> {
    // 实现补全逻辑
    return [
      {
        text: "completion",
        type: "command",
        source: "local",
        description: "描述",
        priority: 5
      }
    ]
  }
}
```

### 注册提供者

在 `web-terminal.tsx` 中:

```typescript
const engine = new CompletionEngine()
engine.registerProvider(new LocalCommandProvider())
engine.registerProvider(new MyCustomProvider())  // 添加自定义提供者
```

## 性能优化

- ✅ 使用 `Map` 数据结构提高查找效率
- ✅ 补全结果去重和排序
- ✅ Portal 渲染避免 DOM 层级问题
- ✅ `requestAnimationFrame` 优化滚动
- 🔄 LRU 缓存 (Phase 2)
- 🔄 虚拟滚动 (Phase 3)

## 已知限制

1. **当前仅支持命令和子命令补全**
   - 文件路径补全需要 Phase 2 (远端支持)
   - 参数补全需要命令特定的逻辑

2. **补全位置计算**
   - 依赖 xterm.js 内部 API
   - 可能在某些终端主题下位置偏移

3. **Prompt 解析**
   - 使用正则匹配常见 prompt 格式
   - 复杂的自定义 prompt 可能解析失败

## 故障排除

### 补全不显示

1. 检查是否按了 Tab 键
2. 确认输入的是命令前缀(不是空格)
3. 查看浏览器控制台是否有错误

### 补全位置不正确

1. 尝试调整终端字体大小
2. 检查终端容器是否有 CSS transform
3. 刷新页面重新初始化

### 补全项不匹配

1. 确认输入的前缀正确
2. 检查命令是否在 `COMMON_COMMANDS` 中
3. 尝试输入更多字符缩小范围

## 贡献指南

欢迎贡献新的命令定义或提供者实现!

1. Fork 项目
2. 创建功能分支
3. 添加命令或实现提供者
4. 提交 Pull Request

## 许可证

与主项目保持一致
