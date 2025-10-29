"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
 Save,
 Key,
 Sliders,
 FileText,
 Shield,
 BarChart,
 Bot,
 AlertCircle,
 CheckCircle,
 Trash2,
 Plus,
 Eye,
 EyeOff,
 RefreshCw,
 ExternalLink,
 Sparkles,
 TrendingUp,
 Clock,
 Zap,
 MessageSquare,
} from "lucide-react"
import {
 Alert,
 AlertDescription,
 AlertTitle,
} from "@/components/ui/alert"
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from "@/components/ui/dialog"

interface AIConfig {
 // 系统配置（管理员）
 systemProvider: 'openai' | 'anthropic' | 'azure' | 'custom' | 'none'
 systemApiEndpoint: string
 systemDefaultModel: string
 systemRateLimit: number
 systemEnabled: boolean

 // 用户配置
 useSystemConfig: boolean
 userProvider: 'openai' | 'anthropic' | 'azure' | 'custom'
 userApiKey: string
 userApiEndpoint: string
 userPreferredModel: string

 // 模型参数
 temperature: number
 maxTokens: number
 topP: number
 frequencyPenalty: number
 presencePenalty: number

 // 隐私设置
 saveConversations: boolean
 allowTraining: boolean
 autoDeleteDays: number
}

interface UserTemplate {
 id: string
 title: string
 description: string
 prompt: string
 icon: string
 isPublic: boolean
 usageCount: number
}

export default function SettingsAIPage() {
 const [isSaving, setIsSaving] = useState(false)
 const [showApiKey, setShowApiKey] = useState(false)
 const [testingConnection, setTestingConnection] = useState(false)
 const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
 const [isAdmin] = useState(true) // 模拟用户角色，实际应从 useAuth() 获取

 const [config, setConfig] = useState<AIConfig>({
 systemProvider: 'none',
 systemApiEndpoint: '',
 systemDefaultModel: 'gpt-4',
 systemRateLimit: 20,
 systemEnabled: false,

 useSystemConfig: true,
 userProvider: 'openai',
 userApiKey: '',
 userApiEndpoint: '',
 userPreferredModel: 'gpt-4',

 temperature: 0.7,
 maxTokens: 2048,
 topP: 1,
 frequencyPenalty: 0,
 presencePenalty: 0,

 saveConversations: true,
 allowTraining: false,
 autoDeleteDays: 30,
 })

 const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([
 {
 id: '1',
 title: '系统诊断',
 description: '快速诊断服务器系统问题',
 prompt: '请帮我诊断服务器的系统状态，包括CPU、内存、磁盘使用情况',
 icon: 'Activity',
 isPublic: false,
 usageCount: 15,
 },
 ])

 const [editingTemplate, setEditingTemplate] = useState<UserTemplate | null>(null)
 const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)

 const handleConfigChange = <K extends keyof AIConfig>(key: K, value: AIConfig[K]) => {
 setConfig(prev => ({ ...prev, [key]: value }))
 }

 const handleSave = async () => {
 setIsSaving(true)
 // 模拟保存
 setTimeout(() => {
 setIsSaving(false)
 console.log('AI配置已保存:', config)
 }, 1000)
 }

 const handleTestConnection = async () => {
 setTestingConnection(true)
 setConnectionStatus('idle')

 // 模拟测试连接
 setTimeout(() => {
 setTestingConnection(false)
 setConnectionStatus(Math.random() > 0.3 ? 'success' : 'error')
 }, 2000)
 }

 const handleSaveTemplate = () => {
 if (editingTemplate) {
 if (editingTemplate.id) {
 // 更新现有模板
 setUserTemplates(prev =>
 prev.map(t => t.id === editingTemplate.id ? editingTemplate : t)
 )
 } else {
 // 新建模板
 setUserTemplates(prev => [...prev, {
 ...editingTemplate,
 id: Date.now().toString(),
 usageCount: 0,
 }])
 }
 }
 setIsTemplateDialogOpen(false)
 setEditingTemplate(null)
 }

 const handleDeleteTemplate = (id: string) => {
 setUserTemplates(prev => prev.filter(t => t.id !== id))
 }

 return (
 <>
 <PageHeader title="AI 配置">
 <Button onClick={handleSave} disabled={isSaving}>
 <Save className="mr-2 h-4 w-4" />
 {isSaving ? "保存中..." : "保存设置"}
 </Button>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
 <Tabs defaultValue="provider" className="w-full">
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="provider" className="flex items-center gap-2">
 <Key className="h-4 w-4" />
 <span className="hidden sm:inline">服务商配置</span>
 </TabsTrigger>
 <TabsTrigger value="model" className="flex items-center gap-2">
 <Sliders className="h-4 w-4" />
 <span className="hidden sm:inline">模型参数</span>
 </TabsTrigger>
 <TabsTrigger value="templates" className="flex items-center gap-2">
 <FileText className="h-4 w-4" />
 <span className="hidden sm:inline">快捷模板</span>
 </TabsTrigger>
 <TabsTrigger value="privacy" className="flex items-center gap-2">
 <Shield className="h-4 w-4" />
 <span className="hidden sm:inline">隐私设置</span>
 </TabsTrigger>
 <TabsTrigger value="usage" className="flex items-center gap-2">
 <BarChart className="h-4 w-4" />
 <span className="hidden sm:inline">使用统计</span>
 </TabsTrigger>
 </TabsList>

 {/* ===== 服务商配置 Tab ===== */}
 <TabsContent value="provider" className="space-y-4">
 {/* 系统配置（管理员） */}
 {isAdmin && (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Bot className="h-5 w-5" />
 系统默认配置（管理员）
 </CardTitle>
 <CardDescription>
 配置系统级AI服务，为所有用户提供默认的AI能力
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>启用系统AI服务</Label>
 <p className="text-sm text-muted-foreground">
 启用后，用户可以选择使用系统配置的AI服务
 </p>
 </div>
 <Switch
 checked={config.systemEnabled}
 onCheckedChange={(checked) => handleConfigChange('systemEnabled', checked)}
 />
 </div>

 {config.systemEnabled && (
 <>
 <Separator />

 <div className="space-y-2">
 <Label htmlFor="systemProvider">AI服务提供商</Label>
 <Select
 value={config.systemProvider}
 onValueChange={(value) => handleConfigChange('systemProvider', value as AIConfig['systemProvider'])}
 >
 <SelectTrigger id="systemProvider">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">未配置</SelectItem>
 <SelectItem value="openai">OpenAI</SelectItem>
 <SelectItem value="anthropic">Anthropic Claude</SelectItem>
 <SelectItem value="azure">Azure OpenAI</SelectItem>
 <SelectItem value="custom">自定义端点</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {config.systemProvider !== 'none' && (
 <>
 {config.systemProvider === 'custom' && (
 <div className="space-y-2">
 <Label htmlFor="systemApiEndpoint">API 端点</Label>
 <Input
 id="systemApiEndpoint"
 value={config.systemApiEndpoint}
 onChange={(e) => handleConfigChange('systemApiEndpoint', e.target.value)}
 placeholder="https://api.example.com/v1"
 />
 </div>
 )}

 <div className="space-y-2">
 <Label htmlFor="systemDefaultModel">默认模型</Label>
 <Select
 value={config.systemDefaultModel}
 onValueChange={(value) => handleConfigChange('systemDefaultModel', value)}
 >
 <SelectTrigger id="systemDefaultModel">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {config.systemProvider === 'openai' && (
 <>
 <SelectItem value="gpt-4">GPT-4</SelectItem>
 <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
 <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
 </>
 )}
 {config.systemProvider === 'anthropic' && (
 <>
 <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
 <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
 <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
 </>
 )}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="systemRateLimit">速率限制（请求/分钟）</Label>
 <Input
 id="systemRateLimit"
 type="number"
 min="1"
 max="100"
 value={config.systemRateLimit}
 onChange={(e) => handleConfigChange('systemRateLimit', parseInt(e.target.value))}
 />
 </div>
 </>
 )}
 </>
 )}
 </CardContent>
 </Card>
 )}

 {/* 个人配置 */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Key className="h-5 w-5" />
 个人API配置
 </CardTitle>
 <CardDescription>
 使用您自己的API密钥，或选择使用系统配置
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>使用系统配置</Label>
 <p className="text-sm text-muted-foreground">
 {config.systemEnabled
 ? "使用管理员配置的系统级AI服务"
 : "系统AI服务未启用，请使用个人API密钥"
 }
 </p>
 </div>
 <Switch
 checked={config.useSystemConfig}
 onCheckedChange={(checked) => handleConfigChange('useSystemConfig', checked)}
 disabled={!config.systemEnabled}
 />
 </div>

 {!config.useSystemConfig && (
 <>
 <Separator />

 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertTitle>安全提示</AlertTitle>
 <AlertDescription>
 您的API密钥将被加密存储在服务器端，仅用于调用AI服务。
 </AlertDescription>
 </Alert>

 <div className="space-y-2">
 <Label htmlFor="userProvider">AI服务提供商</Label>
 <Select
 value={config.userProvider}
 onValueChange={(value) => handleConfigChange('userProvider', value as AIConfig['userProvider'])}
 >
 <SelectTrigger id="userProvider">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="openai">OpenAI</SelectItem>
 <SelectItem value="anthropic">Anthropic Claude</SelectItem>
 <SelectItem value="azure">Azure OpenAI</SelectItem>
 <SelectItem value="custom">自定义端点</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="userApiKey">API 密钥</Label>
 <div className="flex gap-2">
 <div className="relative flex-1">
 <Input
 id="userApiKey"
 type={showApiKey ? "text" : "password"}
 value={config.userApiKey}
 onChange={(e) => handleConfigChange('userApiKey', e.target.value)}
 placeholder="sk-..."
 />
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="absolute right-0 top-0 h-full px-3"
 onClick={() => setShowApiKey(!showApiKey)}
 >
 {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </Button>
 </div>
 <Button
 variant="outline"
 onClick={handleTestConnection}
 disabled={!config.userApiKey || testingConnection}
 >
 {testingConnection ? (
 <RefreshCw className="h-4 w-4 animate-spin" />
 ) : (
 <Zap className="h-4 w-4" />
 )}
 </Button>
 </div>
 {connectionStatus === 'success' && (
 <p className="text-sm text-green-600 flex items-center gap-1">
 <CheckCircle className="h-4 w-4" />
 连接测试成功
 </p>
 )}
 {connectionStatus === 'error' && (
 <p className="text-sm text-red-600 flex items-center gap-1">
 <AlertCircle className="h-4 w-4" />
 连接测试失败，请检查API密钥
 </p>
 )}
 </div>

 {config.userProvider === 'custom' && (
 <div className="space-y-2">
 <Label htmlFor="userApiEndpoint">API 端点</Label>
 <Input
 id="userApiEndpoint"
 value={config.userApiEndpoint}
 onChange={(e) => handleConfigChange('userApiEndpoint', e.target.value)}
 placeholder="https://api.example.com/v1"
 />
 </div>
 )}

 <div className="space-y-2">
 <Label htmlFor="userPreferredModel">偏好模型</Label>
 <Select
 value={config.userPreferredModel}
 onValueChange={(value) => handleConfigChange('userPreferredModel', value)}
 >
 <SelectTrigger id="userPreferredModel">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {config.userProvider === 'openai' && (
 <>
 <SelectItem value="gpt-4">GPT-4</SelectItem>
 <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
 <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
 </>
 )}
 {config.userProvider === 'anthropic' && (
 <>
 <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
 <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
 <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
 </>
 )}
 </SelectContent>
 </Select>
 </div>

 <div className="rounded-lg bg-muted p-4 space-y-2">
 <p className="text-sm font-medium flex items-center gap-2">
 <ExternalLink className="h-4 w-4" />
 获取API密钥
 </p>
 <div className="text-sm text-muted-foreground space-y-1">
 <p>• OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" className="text-primary hover:underline">platform.openai.com/api-keys</a></p>
 <p>• Anthropic: <a href="https://console.anthropic.com/account/keys" target="_blank" className="text-primary hover:underline">console.anthropic.com</a></p>
 </div>
 </div>
 </>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* ===== 模型参数 Tab ===== */}
 <TabsContent value="model" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Sliders className="h-5 w-5" />
 模型参数配置
 </CardTitle>
 <CardDescription>
 调整AI模型的行为参数，影响生成内容的风格和质量
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="temperature">温度 (Temperature)</Label>
 <span className="text-sm text-muted-foreground">{config.temperature}</span>
 </div>
 <Slider
 id="temperature"
 min={0}
 max={2}
 step={0.1}
 value={[config.temperature]}
 onValueChange={(value) => handleConfigChange('temperature', value[0])}
 />
 <p className="text-xs text-muted-foreground">
 较低值使输出更确定和专注，较高值使输出更随机和创造性
 </p>
 </div>

 <Separator />

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="maxTokens">最大长度 (Max Tokens)</Label>
 <span className="text-sm text-muted-foreground">{config.maxTokens}</span>
 </div>
 <Slider
 id="maxTokens"
 min={256}
 max={8192}
 step={256}
 value={[config.maxTokens]}
 onValueChange={(value) => handleConfigChange('maxTokens', value[0])}
 />
 <p className="text-xs text-muted-foreground">
 控制生成内容的最大长度，影响响应速度和费用
 </p>
 </div>

 <Separator />

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="topP">Top P</Label>
 <span className="text-sm text-muted-foreground">{config.topP}</span>
 </div>
 <Slider
 id="topP"
 min={0}
 max={1}
 step={0.1}
 value={[config.topP]}
 onValueChange={(value) => handleConfigChange('topP', value[0])}
 />
 <p className="text-xs text-muted-foreground">
 核采样参数，控制输出的多样性
 </p>
 </div>

 <Separator />

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="frequencyPenalty">频率惩罚 (Frequency Penalty)</Label>
 <span className="text-sm text-muted-foreground">{config.frequencyPenalty}</span>
 </div>
 <Slider
 id="frequencyPenalty"
 min={-2}
 max={2}
 step={0.1}
 value={[config.frequencyPenalty]}
 onValueChange={(value) => handleConfigChange('frequencyPenalty', value[0])}
 />
 <p className="text-xs text-muted-foreground">
 降低重复内容的可能性
 </p>
 </div>

 <Separator />

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="presencePenalty">存在惩罚 (Presence Penalty)</Label>
 <span className="text-sm text-muted-foreground">{config.presencePenalty}</span>
 </div>
 <Slider
 id="presencePenalty"
 min={-2}
 max={2}
 step={0.1}
 value={[config.presencePenalty]}
 onValueChange={(value) => handleConfigChange('presencePenalty', value[0])}
 />
 <p className="text-xs text-muted-foreground">
 鼓励模型讨论新话题
 </p>
 </div>

 <Alert>
 <Sparkles className="h-4 w-4" />
 <AlertTitle>推荐配置</AlertTitle>
 <AlertDescription>
 对于SSH管理任务，建议使用较低的温度(0.3-0.5)和频率惩罚(0.3-0.5)，以获得更准确和专业的回答。
 </AlertDescription>
 </Alert>
 </CardContent>
 </Card>
 </TabsContent>

 {/* ===== 快捷模板 Tab ===== */}
 <TabsContent value="templates" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="flex items-center gap-2">
 <FileText className="h-5 w-5" />
 自定义快捷模板
 </CardTitle>
 <CardDescription>
 创建和管理您的专属提示词模板
 </CardDescription>
 </div>
 <Button
 onClick={() => {
 setEditingTemplate({
 id: '',
 title: '',
 description: '',
 prompt: '',
 icon: 'Sparkles',
 isPublic: false,
 usageCount: 0,
 })
 setIsTemplateDialogOpen(true)
 }}
 >
 <Plus className="mr-2 h-4 w-4" />
 新建模板
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid gap-4 md:grid-cols-2">
 {userTemplates.map((template) => (
 <Card key={template.id}>
 <CardHeader>
 <div className="flex items-start justify-between">
 <div>
 <CardTitle className="text-base">{template.title}</CardTitle>
 <CardDescription className="text-sm">
 {template.description}
 </CardDescription>
 </div>
 {template.isPublic && (
 <Badge variant="secondary">公开</Badge>
 )}
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="text-sm text-muted-foreground bg-muted rounded p-2 line-clamp-2">
 {template.prompt}
 </div>
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span className="flex items-center gap-1">
 <TrendingUp className="h-3 w-3" />
 使用 {template.usageCount} 次
 </span>
 </div>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 className="flex-1"
 onClick={() => {
 setEditingTemplate(template)
 setIsTemplateDialogOpen(true)
 }}
 >
 编辑
 </Button>
 <Button
 variant="outline"
 size="sm"
 className="text-red-600 hover:text-red-700"
 onClick={() => handleDeleteTemplate(template.id)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 {userTemplates.length === 0 && (
 <div className="text-center py-12">
 <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">暂无自定义模板</h3>
 <p className="text-muted-foreground mb-4">
 创建您的第一个快捷模板，提升工作效率
 </p>
 <Button
 onClick={() => {
 setEditingTemplate({
 id: '',
 title: '',
 description: '',
 prompt: '',
 icon: 'Sparkles',
 isPublic: false,
 usageCount: 0,
 })
 setIsTemplateDialogOpen(true)
 }}
 >
 <Plus className="mr-2 h-4 w-4" />
 新建模板
 </Button>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* ===== 隐私设置 Tab ===== */}
 <TabsContent value="privacy" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Shield className="h-5 w-5" />
 隐私与数据管理
 </CardTitle>
 <CardDescription>
 控制您的对话数据如何被存储和使用
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>保存对话历史</Label>
 <p className="text-sm text-muted-foreground">
 在服务器端保存您的对话记录，便于跨设备访问
 </p>
 </div>
 <Switch
 checked={config.saveConversations}
 onCheckedChange={(checked) => handleConfigChange('saveConversations', checked)}
 />
 </div>

 <Separator />

 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>允许用于模型训练</Label>
 <p className="text-sm text-muted-foreground">
 允许AI服务提供商使用您的对话数据改进模型（如适用）
 </p>
 </div>
 <Switch
 checked={config.allowTraining}
 onCheckedChange={(checked) => handleConfigChange('allowTraining', checked)}
 />
 </div>

 <Separator />

 <div className="space-y-2">
 <Label htmlFor="autoDeleteDays">自动删除对话</Label>
 <Select
 value={config.autoDeleteDays.toString()}
 onValueChange={(value) => handleConfigChange('autoDeleteDays', parseInt(value))}
 >
 <SelectTrigger id="autoDeleteDays">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="7">7 天后</SelectItem>
 <SelectItem value="30">30 天后</SelectItem>
 <SelectItem value="90">90 天后</SelectItem>
 <SelectItem value="365">1 年后</SelectItem>
 <SelectItem value="0">从不</SelectItem>
 </SelectContent>
 </Select>
 <p className="text-xs text-muted-foreground">
 自动删除超过指定天数的对话记录
 </p>
 </div>

 <Separator />

 <div className="space-y-4">
 <div>
 <h4 className="text-sm font-medium mb-2">数据管理</h4>
 <p className="text-sm text-muted-foreground mb-4">
 删除所有对话记录和个人数据
 </p>
 </div>

 <Dialog>
 <DialogTrigger asChild>
 <Button variant="destructive">
 <Trash2 className="mr-2 h-4 w-4" />
 清除所有对话历史
 </Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>确认删除所有对话？</DialogTitle>
 <DialogDescription>
 此操作将永久删除您的所有对话记录，且无法恢复。
 </DialogDescription>
 </DialogHeader>
 <DialogFooter>
 <Button variant="outline">取消</Button>
 <Button variant="destructive">确认删除</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>

 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertTitle>隐私说明</AlertTitle>
 <AlertDescription>
 您的API密钥和对话内容会被加密存储。我们不会与第三方分享您的数据，除非使用第三方AI服务时必需传输（受该服务商隐私政策约束）。
 </AlertDescription>
 </Alert>
 </CardContent>
 </Card>
 </TabsContent>

 {/* ===== 使用统计 Tab ===== */}
 <TabsContent value="usage" className="space-y-4">
 <div className="grid gap-4 md:grid-cols-3">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">总对话数</CardTitle>
 <MessageSquare className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">142</div>
 <p className="text-xs text-muted-foreground">
 +12 本月
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">总消息数</CardTitle>
 <MessageSquare className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">1,284</div>
 <p className="text-xs text-muted-foreground">
 +156 本月
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Token 使用量</CardTitle>
 <Zap className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">245K</div>
 <p className="text-xs text-muted-foreground">
 约 $12.50
 </p>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Clock className="h-5 w-5" />
 最近30天使用趋势
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-64 flex items-center justify-center text-muted-foreground">
 <div className="text-center">
 <BarChart className="h-12 w-12 mx-auto mb-4" />
 <p>使用统计图表</p>
 <p className="text-sm">（需要集成图表库显示）</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>模板使用排行</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {userTemplates.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5).map((template, index) => (
 <div key={template.id} className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
 {index + 1}
 </div>
 <div>
 <p className="text-sm font-medium">{template.title}</p>
 <p className="text-xs text-muted-foreground">{template.description}</p>
 </div>
 </div>
 <Badge variant="secondary">{template.usageCount} 次</Badge>
 </div>
 ))}
 {userTemplates.length === 0 && (
 <div className="text-center py-8 text-muted-foreground">
 暂无使用数据
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>

 {/* 模板编辑对话框 */}
 <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>
 {editingTemplate?.id ? '编辑模板' : '新建模板'}
 </DialogTitle>
 <DialogDescription>
 创建自定义提示词模板，快速开始对话
 </DialogDescription>
 </DialogHeader>

 {editingTemplate && (
 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="templateTitle">模板标题</Label>
 <Input
 id="templateTitle"
 value={editingTemplate.title}
 onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
 placeholder="例如：系统诊断"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="templateDescription">简短描述</Label>
 <Input
 id="templateDescription"
 value={editingTemplate.description}
 onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
 placeholder="例如：快速诊断服务器系统问题"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="templatePrompt">提示词内容</Label>
 <Textarea
 id="templatePrompt"
 value={editingTemplate.prompt}
 onChange={(e) => setEditingTemplate({ ...editingTemplate, prompt: e.target.value })}
 placeholder="输入您的提示词..."
 rows={6}
 />
 </div>

 <div className="flex items-center space-x-2">
 <Switch
 id="templatePublic"
 checked={editingTemplate.isPublic}
 onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, isPublic: checked })}
 />
 <Label htmlFor="templatePublic">公开模板（允许其他用户查看）</Label>
 </div>
 </div>
 )}

 <DialogFooter>
 <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
 取消
 </Button>
 <Button onClick={handleSaveTemplate}>
 保存
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 )
}
