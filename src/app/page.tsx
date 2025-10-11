import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Next.js 15 + shadcn/ui</h1>

      <Tabs defaultValue="form" className="w-full">
        <TabsList>
          <TabsTrigger value="form">示例表单</TabsTrigger>
          <TabsTrigger value="about">关于</TabsTrigger>
        </TabsList>

        <TabsContent value="form">
          <Card>
            <CardHeader>
              <CardTitle>联系表单</CardTitle>
              <CardDescription>使用 shadcn/ui 组件构建</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">姓名</Label>
                <Input id="name" placeholder="张三" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">留言</Label>
                <Textarea id="message" placeholder="写点什么..." />
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="ghost">取消</Button>
              <Button>提交</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              已集成 Tailwind v4、shadcn/ui、Radix UI 与 Sonner。
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
