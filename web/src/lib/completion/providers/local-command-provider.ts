/**
 * 本地命令补全提供者
 * 提供常用 Linux/Unix 命令的补全
 */

import type {
  CompletionProvider,
  CompletionContext,
  CompletionItem,
} from "../types"

/**
 * 命令定义
 */
interface CommandDefinition {
  name: string
  description?: string
  subcommands?: string[]
}

/**
 * 常用命令库
 */
const COMMON_COMMANDS: CommandDefinition[] = [
  // 文件系统操作
  { name: "ls", description: "列出目录内容" },
  { name: "cd", description: "切换目录" },
  { name: "pwd", description: "显示当前目录" },
  { name: "mkdir", description: "创建目录" },
  { name: "rmdir", description: "删除空目录" },
  { name: "rm", description: "删除文件或目录" },
  { name: "cp", description: "复制文件或目录" },
  { name: "mv", description: "移动或重命名文件" },
  { name: "touch", description: "创建空文件或更新时间戳" },
  { name: "ln", description: "创建链接" },
  { name: "find", description: "查找文件" },
  { name: "locate", description: "快速查找文件" },
  { name: "tree", description: "树形显示目录结构" },

  // 文件查看和编辑
  { name: "cat", description: "查看文件内容" },
  { name: "less", description: "分页查看文件" },
  { name: "more", description: "分页查看文件" },
  { name: "head", description: "查看文件开头" },
  { name: "tail", description: "查看文件结尾" },
  { name: "vim", description: "Vim 编辑器" },
  { name: "vi", description: "Vi 编辑器" },
  { name: "nano", description: "Nano 编辑器" },
  { name: "emacs", description: "Emacs 编辑器" },

  // 文本处理
  { name: "grep", description: "搜索文本" },
  { name: "sed", description: "流编辑器" },
  { name: "awk", description: "文本处理工具" },
  { name: "sort", description: "排序文本" },
  { name: "uniq", description: "去除重复行" },
  { name: "wc", description: "统计字数" },
  { name: "cut", description: "剪切文本" },
  { name: "paste", description: "合并文本" },
  { name: "tr", description: "转换字符" },

  // 系统信息
  { name: "uname", description: "显示系统信息" },
  { name: "hostname", description: "显示主机名" },
  { name: "uptime", description: "显示系统运行时间" },
  { name: "whoami", description: "显示当前用户" },
  { name: "who", description: "显示登录用户" },
  { name: "w", description: "显示登录用户详情" },
  { name: "date", description: "显示或设置日期时间" },
  { name: "cal", description: "显示日历" },

  // 进程管理
  { name: "ps", description: "显示进程状态" },
  { name: "top", description: "实时显示进程" },
  { name: "htop", description: "交互式进程查看器" },
  { name: "kill", description: "终止进程" },
  { name: "killall", description: "按名称终止进程" },
  { name: "pkill", description: "按模式终止进程" },
  { name: "bg", description: "后台运行任务" },
  { name: "fg", description: "前台运行任务" },
  { name: "jobs", description: "显示任务列表" },

  // 网络工具
  { name: "ping", description: "测试网络连接" },
  { name: "curl", description: "传输数据" },
  { name: "wget", description: "下载文件" },
  { name: "ssh", description: "SSH 远程登录" },
  { name: "scp", description: "安全复制文件" },
  { name: "rsync", description: "同步文件" },
  { name: "netstat", description: "显示网络状态" },
  { name: "ss", description: "显示套接字统计" },
  { name: "ifconfig", description: "配置网络接口" },
  { name: "ip", description: "显示/操作路由和设备" },

  // 权限管理
  { name: "chmod", description: "修改文件权限" },
  { name: "chown", description: "修改文件所有者" },
  { name: "chgrp", description: "修改文件所属组" },
  { name: "sudo", description: "以超级用户执行命令" },
  { name: "su", description: "切换用户" },

  // 压缩和归档
  { name: "tar", description: "归档文件" },
  { name: "gzip", description: "压缩文件" },
  { name: "gunzip", description: "解压缩文件" },
  { name: "zip", description: "ZIP 压缩" },
  { name: "unzip", description: "ZIP 解压" },
  { name: "bzip2", description: "bzip2 压缩" },
  { name: "xz", description: "xz 压缩" },

  // Git 命令
  {
    name: "git",
    description: "版本控制系统",
    subcommands: [
      "init",
      "clone",
      "add",
      "commit",
      "push",
      "pull",
      "fetch",
      "merge",
      "rebase",
      "branch",
      "checkout",
      "status",
      "log",
      "diff",
      "reset",
      "revert",
      "stash",
      "tag",
      "remote",
      "config",
    ],
  },

  // Docker 命令
  {
    name: "docker",
    description: "容器管理",
    subcommands: [
      "run",
      "system",
      "ps",
      "images",
      "pull",
      "push",
      "build",
      "exec",
      "logs",
      "stop",
      "start",
      "restart",
      "rm",
      "rmi",
      "volume",
      "network",
      "compose",
    ],
  },

  // Node.js 包管理器
  {
    name: "npm",
    description: "Node.js 包管理器",
    subcommands: [
      "install",
      "uninstall",
      "update",
      "run",
      "start",
      "test",
      "build",
      "init",
      "publish",
      "search",
      "list",
    ],
  },
  {
    name: "yarn",
    description: "Yarn 包管理器",
    subcommands: [
      "add",
      "remove",
      "install",
      "upgrade",
      "run",
      "start",
      "test",
      "build",
      "init",
      "publish",
    ],
  },
  {
    name: "pnpm",
    description: "pnpm 包管理器",
    subcommands: [
      "add",
      "remove",
      "install",
      "update",
      "run",
      "start",
      "test",
      "build",
      "init",
      "publish",
    ],
  },

  // Python
  {
    name: "python",
    description: "Python 解释器",
  },
  {
    name: "python3",
    description: "Python 3 解释器",
  },
  {
    name: "pip",
    description: "Python 包管理器",
    subcommands: ["install", "uninstall", "list", "show", "search", "freeze"],
  },

  // 其他常用工具
  { name: "make", description: "构建工具" },
  { name: "gcc", description: "C 编译器" },
  { name: "g++", description: "C++ 编译器" },
  { name: "node", description: "Node.js 运行时" },
  { name: "go", description: "Go 语言工具" },
  { name: "rust", description: "Rust 语言工具" },
  { name: "cargo", description: "Rust 包管理器" },
  { name: "java", description: "Java 运行时" },
  { name: "javac", description: "Java 编译器" },

  // Shell 内置命令
  { name: "echo", description: "输出文本" },
  { name: "printf", description: "格式化输出" },
  { name: "export", description: "设置环境变量" },
  { name: "source", description: "执行脚本" },
  { name: "alias", description: "设置别名" },
  { name: "history", description: "显示命令历史" },
  { name: "clear", description: "清屏" },
  { name: "exit", description: "退出 Shell" },
]

/**
 * 本地命令补全提供者
 */
export class LocalCommandProvider implements CompletionProvider {
  name = "local"
  priority = 10
  enabled = true

  private commandMap: Map<string, CommandDefinition>

  constructor() {
    // 构建命令映射表以提高查找效率
    this.commandMap = new Map(
      COMMON_COMMANDS.map((cmd) => [cmd.name, cmd])
    )
  }

  async getCompletions(
    context: CompletionContext
  ): Promise<CompletionItem[]> {
    const { tokens, currentTokenIndex, currentWord } = context

    // 如果是第一个词,补全命令
    if (currentTokenIndex === 0) {
      return this.completeCommand(currentWord)
    }

    // 如果是第二个词,尝试补全子命令
    if (currentTokenIndex === 1) {
      const command = tokens[0]
      return this.completeSubcommand(command, currentWord)
    }

    // 其他位置暂不支持
    return []
  }

  /**
   * 补全命令
   */
  private completeCommand(prefix: string): CompletionItem[] {
    const items: CompletionItem[] = []

    for (const cmd of COMMON_COMMANDS) {
      if (cmd.name.startsWith(prefix)) {
        items.push({
          text: cmd.name,
          type: "command",
          source: "local",
          description: cmd.description,
          priority: 10,
          providerName: "local",
        })
      }
    }

    return items
  }

  /**
   * 补全子命令
   */
  private completeSubcommand(
    command: string,
    prefix: string
  ): CompletionItem[] {
    const cmdDef = this.commandMap.get(command)

    if (!cmdDef || !cmdDef.subcommands) {
      return []
    }

    const items: CompletionItem[] = []

    for (const subcmd of cmdDef.subcommands) {
      if (subcmd.startsWith(prefix)) {
        items.push({
          text: subcmd,
          type: "subcommand",
          source: "local",
          priority: 10,
          providerName: "local",
        })
      }
    }

    return items
  }
}
