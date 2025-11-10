"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Save,
  Database,
  Key,
  Globe,
  Shield,
  Cookie as CookieIcon,
  AlertCircle,
  Info,
} from "lucide-react"
import { settingsApi } from "@/lib/api/settings"
import type {
  DatabasePoolConfig,
  JWTConfig,
  CORSConfig,
  RateLimitConfig,
  CookieConfig,
} from "@/lib/api/settings"
import { getAccessToken } from "@/contexts/auth-context"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SettingsAdvancedPage() {
  // 加载和保存状态
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("database")

  // 配置状态
  const [dbConfig, setDbConfig] = useState<DatabasePoolConfig>({
    max_idle_conns: 10,
    max_open_conns: 100,
    conn_max_lifetime: 60,
    conn_max_idle_time: 10,
  })

  const [jwtConfig, setJwtConfig] = useState<JWTConfig>({
    access_expire: 24,
    refresh_expire: 168,
  })

  const [corsConfig, setCorsConfig] = useState<CORSConfig>({
    allowed_origins: ["http://localhost:3000"],
    allowed_methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowed_headers: ["Content-Type", "Authorization"],
  })

  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig>({
    login_limit: 5,
    api_limit: 100,
  })

  const [cookieConfig, setCookieConfig] = useState<CookieConfig>({
    secure: true,
    domain: "",
  })

  // 加载所有配置
  useEffect(() => {
    loadAllConfigs()
  }, [])

  const loadAllConfigs = async () => {
    try {
      setIsLoading(true)
      const token = getAccessToken()
      if (!token) {
        toast.error("未登录，请先登录")
        return
      }

      // 并行加载所有配置
      const [db, jwt, cors, rateLimit, cookie] = await Promise.all([
        settingsApi.getDatabasePoolConfig(token),
        settingsApi.getJWTConfig(token),
        settingsApi.getCORSConfig(token),
        settingsApi.getRateLimitConfig(token),
        settingsApi.getCookieConfig(token),
      ])

      setDbConfig(db)
      setJwtConfig(jwt)
      setCorsConfig(cors)
      setRateLimitConfig(rateLimit)
      setCookieConfig(cookie)
    } catch (error: any) {
      console.error("加载配置失败:", error)
      toast.error(error.message || "加载配置失败")
    } finally {
      setIsLoading(false)
    }
  }

  // 保存当前标签页的配置
  const handleSave = async () => {
    try {
      setIsSaving(true)
      const token = getAccessToken()
      if (!token) {
        toast.error("未登录，请先登录")
        return
      }

      switch (activeTab) {
        case "database":
          await settingsApi.saveDatabasePoolConfig(token, dbConfig)
          toast.success("数据库连接池配置已保存，重启服务后生效")
          break
        case "jwt":
          await settingsApi.saveJWTConfig(token, jwtConfig)
          toast.success("JWT 配置已保存，重启服务后生效")
          break
        case "cors":
          await settingsApi.saveCORSConfig(token, corsConfig)
          toast.success("CORS 配置已保存")
          break
        case "ratelimit":
          await settingsApi.saveRateLimitConfig(token, rateLimitConfig)
          toast.success("速率限制配置已保存")
          break
        case "cookie":
          await settingsApi.saveCookieConfig(token, cookieConfig)
          toast.success("Cookie 配置已保存")
          break
      }
    } catch (error: any) {
      console.error("保存配置失败:", error)
      toast.error(error.message || "保存配置失败")
    } finally {
      setIsSaving(false)
    }
  }

  // CORS 配置辅助函数
  const handleCorsArrayChange = (
    field: "allowed_origins" | "allowed_methods" | "allowed_headers",
    value: string
  ) => {
    const items = value.split(",").map((item) => item.trim()).filter(Boolean)
    setCorsConfig({ ...corsConfig, [field]: items })
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg">加载配置中...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="高级配置">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "保存中..." : "保存设置"}
        </Button>
      </PageHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="database">
              <Database className="mr-2 h-4 w-4" />
              数据库
            </TabsTrigger>
            <TabsTrigger value="jwt">
              <Key className="mr-2 h-4 w-4" />
              认证
            </TabsTrigger>
            <TabsTrigger value="cors">
              <Globe className="mr-2 h-4 w-4" />
              网络
            </TabsTrigger>
            <TabsTrigger value="ratelimit">
              <Shield className="mr-2 h-4 w-4" />
              安全
            </TabsTrigger>
            <TabsTrigger value="cookie">
              <CookieIcon className="mr-2 h-4 w-4" />
              Cookie
            </TabsTrigger>
          </TabsList>

          {/* 数据库连接池配置 */}
          <TabsContent value="database">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>数据库连接池配置</CardTitle>
                    <CardDescription>
                      配置数据库连接池参数以优化性能
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-orange-600">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    需要重启
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    修改这些配置后需要重启服务才能生效。建议根据实际负载情况调整参数。
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="max_idle_conns">最大空闲连接数</Label>
                    <Input
                      id="max_idle_conns"
                      type="number"
                      min="1"
                      max="1000"
                      value={dbConfig.max_idle_conns}
                      onChange={(e) =>
                        setDbConfig({
                          ...dbConfig,
                          max_idle_conns: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      连接池中保持的最大空闲连接数（1-1000）
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_open_conns">最大打开连接数</Label>
                    <Input
                      id="max_open_conns"
                      type="number"
                      min="1"
                      max="10000"
                      value={dbConfig.max_open_conns}
                      onChange={(e) =>
                        setDbConfig({
                          ...dbConfig,
                          max_open_conns: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      数据库的最大打开连接数（1-10000）
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conn_max_lifetime">连接最大生命周期（分钟）</Label>
                    <Input
                      id="conn_max_lifetime"
                      type="number"
                      min="1"
                      max="1440"
                      value={dbConfig.conn_max_lifetime}
                      onChange={(e) =>
                        setDbConfig({
                          ...dbConfig,
                          conn_max_lifetime: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      连接可以被重用的最长时间（1-1440 分钟）
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conn_max_idle_time">连接最大空闲时间（分钟）</Label>
                    <Input
                      id="conn_max_idle_time"
                      type="number"
                      min="1"
                      max="60"
                      value={dbConfig.conn_max_idle_time}
                      onChange={(e) =>
                        setDbConfig({
                          ...dbConfig,
                          conn_max_idle_time: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      连接在被关闭前可以空闲的最长时间（1-60 分钟）
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* JWT 配置 */}
          <TabsContent value="jwt">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>JWT 令牌配置</CardTitle>
                    <CardDescription>
                      配置 JWT 访问令牌和刷新令牌的过期时间
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-orange-600">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    需要重启
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    修改这些配置后需要重启服务才能生效。访问令牌过期时间应小于刷新令牌过期时间。
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="access_expire">访问令牌过期时间（小时）</Label>
                    <Input
                      id="access_expire"
                      type="number"
                      min="1"
                      max="168"
                      value={jwtConfig.access_expire}
                      onChange={(e) =>
                        setJwtConfig({
                          ...jwtConfig,
                          access_expire: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      访问令牌的有效期（1-168 小时，建议 24 小时）
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="refresh_expire">刷新令牌过期时间（小时）</Label>
                    <Input
                      id="refresh_expire"
                      type="number"
                      min="24"
                      max="720"
                      value={jwtConfig.refresh_expire}
                      onChange={(e) =>
                        setJwtConfig({
                          ...jwtConfig,
                          refresh_expire: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      刷新令牌的有效期（24-720 小时，建议 168 小时）
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CORS 配置 */}
          <TabsContent value="cors">
            <Card>
              <CardHeader>
                <CardTitle>CORS 跨域配置</CardTitle>
                <CardDescription>
                  配置允许跨域访问的域名、方法和请求头
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    配置保存后立即生效。多个值请用英文逗号分隔。
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="allowed_origins">允许的域名</Label>
                    <Input
                      id="allowed_origins"
                      placeholder="http://localhost:3000, https://example.com"
                      value={corsConfig.allowed_origins.join(", ")}
                      onChange={(e) =>
                        handleCorsArrayChange("allowed_origins", e.target.value)
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      允许跨域访问的域名列表，用逗号分隔
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowed_methods">允许的 HTTP 方法</Label>
                    <Input
                      id="allowed_methods"
                      placeholder="GET, POST, PUT, DELETE, OPTIONS"
                      value={corsConfig.allowed_methods.join(", ")}
                      onChange={(e) =>
                        handleCorsArrayChange("allowed_methods", e.target.value)
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      允许的 HTTP 请求方法，用逗号分隔
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowed_headers">允许的请求头</Label>
                    <Input
                      id="allowed_headers"
                      placeholder="Content-Type, Authorization"
                      value={corsConfig.allowed_headers.join(", ")}
                      onChange={(e) =>
                        handleCorsArrayChange("allowed_headers", e.target.value)
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      允许的 HTTP 请求头，用逗号分隔
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 速率限制配置 */}
          <TabsContent value="ratelimit">
            <Card>
              <CardHeader>
                <CardTitle>速率限制配置</CardTitle>
                <CardDescription>
                  配置登录和 API 请求的速率限制以防止滥用
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    配置保存后立即生效。速率限制基于 IP 地址计算。
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="login_limit">登录速率限制（次/分钟）</Label>
                    <Input
                      id="login_limit"
                      type="number"
                      min="1"
                      max="100"
                      value={rateLimitConfig.login_limit}
                      onChange={(e) =>
                        setRateLimitConfig({
                          ...rateLimitConfig,
                          login_limit: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      每个 IP 每分钟允许的登录尝试次数（1-100）
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="api_limit">API 速率限制（次/分钟）</Label>
                    <Input
                      id="api_limit"
                      type="number"
                      min="10"
                      max="10000"
                      value={rateLimitConfig.api_limit}
                      onChange={(e) =>
                        setRateLimitConfig({
                          ...rateLimitConfig,
                          api_limit: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      每个 IP 每分钟允许的 API 请求次数（10-10000）
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cookie 配置 */}
          <TabsContent value="cookie">
            <Card>
              <CardHeader>
                <CardTitle>Cookie 安全配置</CardTitle>
                <CardDescription>
                  配置 Cookie 的安全属性和作用域
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    配置保存后立即生效。Secure 属性要求使用 HTTPS 连接。
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="cookie_secure">启用 Secure 属性</Label>
                      <p className="text-sm text-muted-foreground">
                        仅通过 HTTPS 连接传输 Cookie（生产环境推荐启用）
                      </p>
                    </div>
                    <Switch
                      id="cookie_secure"
                      checked={cookieConfig.secure}
                      onCheckedChange={(checked) =>
                        setCookieConfig({ ...cookieConfig, secure: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cookie_domain">Cookie 域名</Label>
                    <Input
                      id="cookie_domain"
                      placeholder="example.com（留空表示当前域名）"
                      value={cookieConfig.domain}
                      onChange={(e) =>
                        setCookieConfig({ ...cookieConfig, domain: e.target.value })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      Cookie 的作用域域名，留空表示使用当前域名
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
