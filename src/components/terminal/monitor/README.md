# WebSSH 系统监控侧边栏

高信息密度、紧凑美观的实时系统监控 React 组件,嵌入 WebSSH 终端左侧。

## 功能特性

- ✅ **系统信息**：OS、主机名、CPU型号、架构、系统负载、运行时间
- ✅ **CPU监控**：实时使用率折线图(最近20个数据点)
- ✅ **内存监控**：双圆环图显示 RAM 和 Swap 使用情况
- ✅ **网络监控**：上行/下行流量堆叠面积图
- ✅ **磁盘监控**：多分区使用率进度条
- 🎨 **主题适配**：完全支持明暗主题切换
- 📋 **点击复制**：系统信息支持点击复制到剪贴板
- ⚡ **实时更新**：
  - CPU/内存/网络: 2秒更新
  - 磁盘: 30秒更新
  - 系统信息: 60秒更新

## 组件结构

```
monitor/
├── MonitorPanel.tsx          # 主面板组件
├── components/
│   ├── SystemInfo.tsx        # 系统信息
│   ├── CPUChart.tsx          # CPU图表
│   ├── MemoryChart.tsx       # 内存图表
│   ├── NetworkChart.tsx      # 网络图表
│   └── DiskUsage.tsx         # 磁盘使用
├── hooks/
│   └── useSystemMetrics.ts   # Mock数据Hook
├── types/
│   └── metrics.ts            # 类型定义
└── README.md
```

## 使用方法

### 1. 基础使用

```tsx
import { MonitorPanel } from '@/components/terminal/monitor/MonitorPanel';

function TerminalPage() {
  const [isMonitorOpen, setIsMonitorOpen] = useState(true);

  return (
    <div className="flex h-screen">
      {/* 监控面板 */}
      {isMonitorOpen && <MonitorPanel />}

      {/* 终端区域 */}
      <div className="flex-1">
        <Terminal />
      </div>
    </div>
  );
}
```

### 2. 切换显示/隐藏

监控面板通过工具栏的"系统监控"按钮控制:

```tsx
<Button onClick={() => setIsMonitorOpen(!isMonitorOpen)}>
  <Activity className={cn("h-3.5 w-3.5", isMonitorOpen && "text-blue-500")} />
</Button>
```

### 3. 布局规范

监控面板固定尺寸:
- **宽度**: 250px
- **高度**: 915px (适配1080p屏幕)
- **布局**: Flex两栏,面板在左,终端在右

```css
┌──────────────┬─────────────────────┐
│   监控面板   │    终端区域         │
│   固定250px  │    flex: 1          │
│   高度915px  │                     │
└──────────────┴─────────────────────┘
```

## 高度分配 (总计915px)

| 模块 | 高度 | 说明 |
|------|------|------|
| 顶部内边距 | 12px | `pt-3` |
| 系统信息 | 168px | 标题24px + 6行×24px |
| 间距 | 8px | `gap-2` |
| CPU图表 | 170px | 标题28px + 图表142px |
| 间距 | 8px | |
| 内存图表 | 170px | 标题28px + 图表142px |
| 间距 | 8px | |
| 网络图表 | 170px | 标题28px + 图表142px |
| 间距 | 8px | |
| 磁盘使用 | 155px | 标题28px + 2-3个磁盘条 |
| 底部内边距 | 12px | `pb-3` |

## 数据结构

### SystemInfo
```typescript
interface SystemInfo {
  os: string;          // "Ubuntu 22.04 LTS"
  hostname: string;    // "web-server-01"
  cpu: string;         // "Intel Core i7-9700K"
  arch: string;        // "x86_64"
  load: string;        // "0.45, 0.32, 0.28"
  uptime: string;      // "15d 6h 23m"
}
```

### MemoryData
```typescript
interface MemoryData {
  ram: {
    used: number;      // GB
    total: number;     // GB
    percent: number;   // 0-100
  };
  swap: {
    used: number;
    total: number;
    percent: number;
  };
}
```

### DiskData
```typescript
interface DiskData {
  name: string;        // "/" 或 "/home"
  used: number;        // GB
  total: number;       // GB
  percent: number;     // 0-100
}
```

## 自定义配置

### 修改更新频率

编辑 `hooks/useSystemMetrics.ts`:

```typescript
// CPU/内存/网络更新间隔 (默认2000ms)
setInterval(() => { ... }, 2000);

// 磁盘更新间隔 (默认30000ms)
setInterval(() => { ... }, 30000);
```

### 接入真实数据

替换 `useSystemMetrics` Hook 为真实API调用:

```typescript
export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics>();

  useEffect(() => {
    // 调用真实API
    const fetchMetrics = async () => {
      const data = await fetch('/api/system/metrics');
      const json = await data.json();
      setMetrics(json);
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  return metrics;
}
```

## 性能优化

✅ **已应用的优化**:
- 使用 `React.memo` 避免不必要的重新渲染
- 使用 `useMemo` 缓存图表配置
- 数据点数量限制 (CPU/网络保持最近20个)
- 按需更新不同模块

## 依赖项

- `react` >= 18
- `recharts` >= 3.x
- `@/components/ui/progress` (shadcn/ui)
- `lucide-react` (可选,用于图标)

## 浏览器兼容性

- Chrome/Edge >= 90
- Firefox >= 88
- Safari >= 14

## 故障排除

### 图表不显示
检查 CSS 变量是否正确定义 (`--chart-1` 到 `--chart-5`)

### 主题切换闪烁
确保 `next-themes` 正确配置,使用 `suppressHydrationWarning`

### 性能问题
- 减少数据点数量 (默认20)
- 增加更新间隔
- 使用虚拟滚动 (如果数据量大)

## 许可证

MIT
