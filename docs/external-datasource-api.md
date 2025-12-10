# 仪表盘外部数据源 API 格式文档

本文档记录 EasySSH 首页仪表盘支持的外部监控数据源 API 格式。

> **说明**：这些外部数据源仅用于**首页仪表盘**的服务器状态展示。如果您已经在使用 Nezha 或 Komari 等监控平台，可以直接对接这些平台来显示服务器状态，无需重复配置。

---

## 目录

1. [Nezha 监控 API](#1-nezha-监控-api)
2. [Komari 监控 API](#2-komari-监控-api)
3. [使用示例](#3-使用示例)
4. [数据映射说明](#4-数据映射说明)
5. [对比总结](#5-对比总结)

---

## 1. Nezha 监控 API

### 基本信息

| 属性 | 值 |
|------|-----|
| **端点** | `GET https://{host}/api/v1/server` |
| **协议** | HTTP REST |
| **认证** | Token 或 Cookie (nz-jwt) |

### 认证方式

Nezha 支持两种认证方式：

1. **API Token**: `Authorization: {token}` 请求头
2. **Cookie (JWT)**: `Cookie: nz-jwt={jwt_token}`

> **提示**: EasySSH 会自动识别 Token 格式。以 `eyJ` 开头的 JWT Token 会使用 Cookie 认证，其他格式使用 Authorization 头。

### 响应数据结构

```typescript
interface NezhaAPIResponse {
  success: boolean;         // 请求是否成功
  data: NezhaServer[];      // 服务器列表
  error?: string;           // 错误信息 (失败时)
}

interface NezhaServer {
  id: number;               // 服务器 ID
  name: string;             // 服务器名称
  host: NezhaHost;          // 主机硬件信息
  state: NezhaState;        // 实时状态
  geoip: NezhaGeoIP;        // 地理位置信息
  last_active: string;      // 最后活跃时间 (ISO 8601 格式)
}

interface NezhaGeoIP {
  ip: {
    ipv4_addr?: string;     // IPv4 地址
    ipv6_addr?: string;     // IPv6 地址
  };
  country_code: string;     // 国家/地区代码 (如 "us", "hk", "jp")
}

interface NezhaHost {
  platform: string;         // 操作系统平台 (如 "debian", "ubuntu")
  platform_version: string; // 操作系统版本
  cpu: string[];            // CPU 信息数组
  mem_total: number;        // 总内存 (字节)
  disk_total: number;       // 总磁盘空间 (字节)
  swap_total: number;       // 总交换空间 (字节)
  arch: string;             // CPU 架构 (如 "x86_64", "aarch64")
  virtualization?: string;  // 虚拟化类型 (如 "kvm", "openvz")
  boot_time: number;        // 系统启动时间戳 (秒)
  version: string;          // Agent 版本
}

interface NezhaState {
  cpu: number;              // CPU 使用率 (0-100, 百分比)
  mem_used: number;         // 已用内存 (字节)
  swap_used: number;        // 已用交换空间 (字节)
  disk_used: number;        // 已用磁盘空间 (字节)
  net_in_transfer: number;  // 入站总流量 (字节)
  net_out_transfer: number; // 出站总流量 (字节)
  net_in_speed: number;     // 入站实时速度 (字节/秒)
  net_out_speed: number;    // 出站实时速度 (字节/秒)
  uptime: number;           // 系统运行时间 (秒)
  load_1: number;           // 1 分钟平均负载
  load_5: number;           // 5 分钟平均负载
  load_15: number;          // 15 分钟平均负载
  tcp_conn_count: number;   // TCP 连接数
  udp_conn_count?: number;  // UDP 连接数 (可选)
  process_count: number;    // 进程数
}
```

### 在线状态判断

```typescript
const isOnline = (lastActive: string): boolean => {
  const lastActiveTime = new Date(lastActive).getTime();
  return (Date.now() - lastActiveTime) <= 180000; // 3 分钟内活跃视为在线
};
```

### 示例数据

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Production Server",
      "host": {
        "platform": "debian",
        "platform_version": "11.11",
        "cpu": ["Intel(R) Xeon(R) CPU E5-2680 v2 @ 2.80GHz 1 Virtual Core"],
        "mem_total": 1011380224,
        "disk_total": 17784651776,
        "swap_total": 1073737728,
        "arch": "x86_64",
        "virtualization": "kvm",
        "boot_time": 1750232511,
        "version": "1.14.1"
      },
      "state": {
        "cpu": 1.29,
        "mem_used": 554360832,
        "swap_used": 524017664,
        "disk_used": 12216553472,
        "net_in_transfer": 50952834891,
        "net_out_transfer": 59471062499,
        "net_in_speed": 147,
        "net_out_speed": 132,
        "uptime": 15112057,
        "load_1": 0.06,
        "load_5": 0.13,
        "load_15": 0.12,
        "tcp_conn_count": 15,
        "process_count": 89
      },
      "geoip": {
        "ip": {
          "ipv4_addr": "192.210.143.132"
        },
        "country_code": "us"
      },
      "last_active": "2025-12-10T13:25:00.58483355+08:00"
    }
  ]
}
```

---

## 2. Komari 监控 API

> **官方文档**: [https://komari-document.pages.dev/dev/api.html](https://komari-document.pages.dev/dev/api.html)

Komari 使用两个 REST API 端点：
- **`/api/nodes`** - 获取节点元信息（名称、配置、区域等）
- **`/api/recent/{uuid}`** - 获取节点最新状态数据

### 认证方式

Komari 支持两种认证方式（1.0.3+ 版本）：
- **Cookie**: 通过 `session_token` 字段进行会话验证
- **API Key**: Bearer Token 认证 (`Authorization: Bearer {token}`)

### 2.1 节点元信息 API

| 属性 | 值 |
|------|-----|
| **端点** | `GET https://{host}/api/nodes` |
| **协议** | HTTP REST |
| **认证** | 可选，使用 `Authorization: Bearer {token}` 请求头 |

#### 响应数据结构

```typescript
interface KomariNodesResponse {
  status: "success" | "error";
  message: string;
  data: KomariNode[];
}

interface KomariNode {
  uuid: string;               // 节点唯一标识
  name: string;               // 节点名称
  cpu_name: string;           // CPU 型号
  virtualization: string;     // 虚拟化类型 (如 "kvm", "openvz")
  arch: string;               // CPU 架构 (如 "x86_64", "aarch64")
  cpu_cores: number;          // CPU 核心数
  os: string;                 // 操作系统
  kernel_version: string;     // 内核版本
  gpu_name: string;           // GPU 型号 (可为空)
  region: string;             // 区域/国家代码 (如 "DE", "US", "JP")
  mem_total: number;          // 总内存 (字节)
  swap_total: number;         // 总交换空间 (字节)
  disk_total: number;         // 总磁盘空间 (字节)
  weight: number;             // 排序权重
  price: number;              // 价格
  billing_cycle: number;      // 计费周期 (天)
  auto_renewal: boolean;      // 是否自动续费
  currency: string;           // 货币单位
  expired_at: string;         // 到期时间 (ISO 8601)
  group: string;              // 分组
  tags: string;               // 标签
  public_remark: string;      // 公开备注
  hidden: boolean;            // 是否隐藏
  traffic_limit: number;      // 流量限制 (字节)
  traffic_limit_type: string; // 流量限制类型
  created_at: string;         // 创建时间 (ISO 8601)
  updated_at: string;         // 更新时间 (ISO 8601)
}
```

#### 示例数据

```json
{
  "status": "success",
  "message": "",
  "data": [
    {
      "uuid": "bfb2a054-53be-4e1f-8a61-182118fda036",
      "name": "Netcup-DE",
      "cpu_name": "QEMU Virtual CPU version 2.5+",
      "virtualization": "kvm",
      "arch": "x86_64",
      "cpu_cores": 2,
      "os": "debian",
      "kernel_version": "6.1.0-28-amd64",
      "gpu_name": "",
      "region": "DE",
      "mem_total": 2097152000,
      "swap_total": 1073741824,
      "disk_total": 42949672960,
      "weight": 0,
      "price": 0,
      "billing_cycle": 0,
      "auto_renewal": true,
      "currency": "",
      "expired_at": "0001-01-01T00:00:00Z",
      "group": "",
      "tags": "",
      "public_remark": "",
      "hidden": false,
      "traffic_limit": 0,
      "traffic_limit_type": "",
      "created_at": "2024-12-01T12:00:00Z",
      "updated_at": "2024-12-10T08:30:00Z"
    }
  ]
}
```

### 2.2 节点最新状态 API

| 属性 | 值 |
|------|-----|
| **端点** | `GET https://{host}/api/recent/{uuid}` |
| **协议** | HTTP REST |
| **认证** | 可选，使用 `Authorization: Bearer {token}` 请求头 |

#### 响应数据结构

```typescript
interface KomariRecentResponse {
  status: "success" | "error";
  message: string;
  data: KomariRecentData[];   // 最近状态数据列表（取第一条）
}

interface KomariRecentData {
  cpu: {
    usage: number;              // CPU 使用率 (百分比 0-100)
  };
  ram: {
    total: number;              // 总内存 (字节)
    used: number;               // 已用内存 (字节)
  };
  swap: {
    total: number;              // 总交换空间 (字节)
    used: number;               // 已用交换空间 (字节)
  };
  load: {
    load1: number;              // 1 分钟平均负载
    load5: number;              // 5 分钟平均负载
    load15: number;             // 15 分钟平均负载
  };
  disk: {
    total: number;              // 总磁盘空间 (字节)
    used: number;               // 已用磁盘空间 (字节)
  };
  network: {
    up: number;                 // 出站实时速度 (字节/秒)
    down: number;               // 入站实时速度 (字节/秒)
    totalUp: number;            // 出站总流量 (字节)
    totalDown: number;          // 入站总流量 (字节)
  };
  connections: {
    tcp: number;                // TCP 连接数
    udp: number;                // UDP 连接数
  };
  uptime: number;               // 系统运行时间 (秒)
  process: number;              // 进程数
  message: string;              // 消息字段
  updated_at: string;           // 更新时间 (ISO 8601 格式)
}
```

### 在线状态判断

根据 `updated_at` 时间判断是否在线（3 分钟内更新视为在线）：

```typescript
const isOnline = (updatedAt: string): boolean => {
  const updatedTime = new Date(updatedAt).getTime();
  return (Date.now() - updatedTime) <= 180000; // 3 分钟
};
```

#### 示例数据

```json
{
  "status": "success",
  "message": "",
  "data": [
    {
      "cpu": {
        "usage": 12.5
      },
      "ram": {
        "total": 8589934592,
        "used": 4294967296
      },
      "swap": {
        "total": 2147483648,
        "used": 0
      },
      "load": {
        "load1": 0.5,
        "load5": 0.3,
        "load15": 0.2
      },
      "disk": {
        "total": 107374182400,
        "used": 32212254720
      },
      "network": {
        "up": 2048,
        "down": 1024,
        "totalUp": 549755813888,
        "totalDown": 1099511627776
      },
      "connections": {
        "tcp": 120,
        "udp": 5
      },
      "uptime": 86400,
      "process": 200,
      "message": "",
      "updated_at": "2024-12-10T12:30:00Z"
    }
  ]
}
```

---

## 3. 使用示例

### JavaScript / TypeScript

#### 请求 Nezha API

```typescript
// 使用 JWT Cookie 认证
const response = await fetch('https://nezha.example.com/api/v1/server', {
  headers: {
    'Cookie': 'nz-jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});

const data = await response.json();

if (data.success) {
  data.data.forEach(server => {
    const isOnline = (Date.now() - new Date(server.last_active).getTime()) <= 180000;
    console.log(`${server.name}: CPU ${server.state.cpu.toFixed(1)}%, Online: ${isOnline}`);
  });
}
```

#### 请求 Komari API

```typescript
// 获取节点列表
const nodesResponse = await fetch('https://komari.example.com/api/nodes', {
  headers: {
    'Authorization': 'Bearer your-api-token'
  }
});
const nodesData = await nodesResponse.json();

// 获取每个节点的最新状态
for (const node of nodesData.data) {
  const recentResponse = await fetch(`https://komari.example.com/api/recent/${node.uuid}`, {
    headers: {
      'Authorization': 'Bearer your-api-token'
    }
  });
  const recentData = await recentResponse.json();

  if (recentData.data.length > 0) {
    const status = recentData.data[0];
    console.log(`${node.name}: CPU ${status.cpu.usage.toFixed(1)}%`);
  }
}
```

### Go

#### 请求 Nezha API

```go
package main

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "strings"
    "time"
)

func main() {
    req, _ := http.NewRequest("GET", "https://nezha.example.com/api/v1/server", nil)

    // JWT Token 使用 Cookie 认证
    token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    if strings.HasPrefix(token, "eyJ") {
        req.Header.Set("Cookie", "nz-jwt="+token)
    } else {
        req.Header.Set("Authorization", token)
    }

    client := &http.Client{Timeout: 30 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)

    var response NezhaAPIResponse
    json.Unmarshal(body, &response)

    if response.Success {
        for _, server := range response.Data {
            fmt.Printf("%s: CPU %.1f%%\n", server.Name, server.State.CPU)
        }
    }
}
```

#### 请求 Komari API

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

func main() {
    client := &http.Client{Timeout: 30 * time.Second}

    // 获取节点列表
    req, _ := http.NewRequest("GET", "https://komari.example.com/api/nodes", nil)
    req.Header.Set("Authorization", "Bearer your-api-token")

    resp, _ := client.Do(req)
    defer resp.Body.Close()

    var nodesResp KomariNodesResponse
    json.NewDecoder(resp.Body).Decode(&nodesResp)

    // 获取每个节点的最新状态
    for _, node := range nodesResp.Data {
        recentReq, _ := http.NewRequest("GET",
            fmt.Sprintf("https://komari.example.com/api/recent/%s", node.UUID), nil)
        recentReq.Header.Set("Authorization", "Bearer your-api-token")

        recentResp, _ := client.Do(recentReq)

        var recentData KomariRecentResponse
        json.NewDecoder(recentResp.Body).Decode(&recentData)
        recentResp.Body.Close()

        if len(recentData.Data) > 0 {
            status := recentData.Data[0]
            fmt.Printf("%s: CPU %.1f%%\n", node.Name, status.CPU.Usage)
        }
    }
}
```

---

## 4. 数据映射说明

EasySSH 将外部监控数据转换为统一的 `ServerResourceSummary` 格式，用于首页仪表盘服务器状态卡片展示。

### Nezha -> ServerResourceSummary

| Nezha 字段 | EasySSH 字段 | 说明 |
|------------|--------------|------|
| `id` (string) | `server_id` | 添加 "nezha-" 前缀 |
| `name` | `name` | 直接映射 |
| `geoip.country_code` | `location.country_code` | 用于显示国旗图标 |
| `last_active` | `status` | 3分钟内活跃 = online |
| `state.cpu` | `cpu.usage_percent` | 直接映射 |
| `host.cpu` | `cpu.cores` | 数组长度为核心数 |
| `state.load_1/5/15` | `cpu.load_average` | 直接映射 |
| `state.mem_used` | `memory.used` | 直接映射 |
| `host.mem_total` | `memory.total` | 直接映射 |
| `state.disk_used` | `disk.used` | 直接映射 |
| `host.disk_total` | `disk.total` | 直接映射 |
| `state.net_in_speed` | `network.rx_bytes` | 直接映射 |
| `state.net_out_speed` | `network.tx_bytes` | 直接映射 |
| `state.uptime` | `uptime` | 直接映射 |

### Komari -> ServerResourceSummary

Komari 需要合并两个 API 的数据：`/api/nodes` 提供节点元信息，`/api/recent/{uuid}` 提供实时状态。

| Komari 字段 | 来源 | EasySSH 字段 | 说明 |
|-------------|------|--------------|------|
| `uuid` | nodes | `server_id` | 添加 "komari-" 前缀 |
| `name` | nodes | `name` | 优先使用 nodes 的名称 |
| `region` | nodes | `location.country_code` | 国家/区域代码 |
| `cpu_cores` | nodes | `cpu.cores` | CPU 核心数 |
| `mem_total` | nodes | `memory.total` | 作为备用值 |
| `disk_total` | nodes | `disk.total` | 作为备用值 |
| `updated_at` | recent | `status` | 3分钟内更新 = online |
| `cpu.usage` | recent | `cpu.usage_percent` | 直接映射 |
| `load.load1/5/15` | recent | `cpu.load_average` | 直接映射 |
| `ram.used` | recent | `memory.used` | 直接映射 |
| `ram.total` | recent | `memory.total` | 优先使用 |
| `disk.used` | recent | `disk.used` | 直接映射 |
| `disk.total` | recent | `disk.total` | 优先使用 |
| `network.down` | recent | `network.rx_bytes` | 入站速率 |
| `network.up` | recent | `network.tx_bytes` | 出站速率 |
| `uptime` | recent | `uptime` | 直接映射 |

---

## 5. 对比总结

| 特性 | Nezha | Komari |
|------|-------|--------|
| **协议** | HTTP REST | HTTP REST |
| **主端点** | `GET /api/v1/server` | `GET /api/nodes` |
| **状态端点** | (同上) | `GET /api/recent/{uuid}` |
| **认证方式** | Token / Cookie (nz-jwt) | Bearer Token |
| **服务器标识** | 数字 ID | UUID 字符串 |
| **在线状态判断** | 根据 `last_active` 时间差 | 根据 `updated_at` 时间差 |
| **响应格式** | `{ success, data }` | `{ status, message, data }` |
| **GPU 信息** | ❌ 不支持 | ✅ 支持 |
| **IP 地址** | ✅ 支持 (`geoip.ip`) | ❌ 不返回 |
| **国家/地区代码** | ✅ 支持 (`geoip.country_code`) | ✅ 支持 (`region`) |

---

## 附录：认证配置

### Nezha

在 Nezha Dashboard 管理后台获取 API Token：

1. 登录 Nezha 管理面板
2. 点击右上角头像，选择 **API Token**
3. 点击 **添加** 创建新 Token
4. 复制生成的 Token

> **提示**: Nezha V1 支持两种认证方式：
> - **API Token**: 在 Authorization 头中传递
> - **JWT Token**: 以 Cookie (`nz-jwt`) 方式传递，Token 以 `eyJ` 开头

### Komari

在 Komari 管理后台获取 API Token：

1. 登录 Komari 管理面板
2. 进入 **设置** > **API**
3. 生成新的 API Token

> **注意**: Token 应妥善保管，不要泄露到公开的代码仓库中。
