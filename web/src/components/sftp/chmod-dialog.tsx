"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface ChmodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  currentPermissions: string
  onConfirm: (mode: string) => void
}

export function ChmodDialog({
  open,
  onOpenChange,
  fileName,
  currentPermissions,
  onConfirm,
}: ChmodDialogProps) {
  // 解析当前权限（如 "drwxr-xr-x" 或 "-rw-r--r--"）
  const parsePermissions = (perms: string): number => {
    // 空值检查
    if (!perms || perms.length < 10) {
      return 0o644 // 默认权限
    }

    // 移除第一个字符（文件类型标识）
    const permStr = perms.slice(1)
    let mode = 0

    // Owner (rwx)
    if (permStr[0] === 'r') mode += 0o400
    if (permStr[1] === 'w') mode += 0o200
    if (permStr[2] === 'x') mode += 0o100

    // Group (rwx)
    if (permStr[3] === 'r') mode += 0o040
    if (permStr[4] === 'w') mode += 0o020
    if (permStr[5] === 'x') mode += 0o010

    // Others (rwx)
    if (permStr[6] === 'r') mode += 0o004
    if (permStr[7] === 'w') mode += 0o002
    if (permStr[8] === 'x') mode += 0o001

    return mode
  }

  const [mode, setMode] = useState(0o644)
  const [octalInput, setOctalInput] = useState('644')

  useEffect(() => {
    // 只在对话框打开且有有效权限时才解析
    if (open && currentPermissions) {
      const newMode = parsePermissions(currentPermissions)
      setMode(newMode)
      setOctalInput(newMode.toString(8).padStart(3, '0'))
    }
  }, [currentPermissions, open])

  // 权限位定义
  const permissions = {
    owner: { read: 0o400, write: 0o200, execute: 0o100 },
    group: { read: 0o040, write: 0o020, execute: 0o010 },
    others: { read: 0o004, write: 0o002, execute: 0o001 },
  }

  const hasPermission = (perm: number) => (mode & perm) !== 0

  const togglePermission = (perm: number) => {
    const newMode = mode ^ perm
    setMode(newMode)
    setOctalInput(newMode.toString(8).padStart(3, '0'))
  }

  const handleOctalChange = (value: string) => {
    setOctalInput(value)
    // 验证并更新模式
    const parsed = parseInt(value, 8)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0o777) {
      setMode(parsed)
    }
  }

  const formatPermissionString = (m: number): string => {
    const perms = [
      m & 0o400 ? 'r' : '-',
      m & 0o200 ? 'w' : '-',
      m & 0o100 ? 'x' : '-',
      m & 0o040 ? 'r' : '-',
      m & 0o020 ? 'w' : '-',
      m & 0o010 ? 'x' : '-',
      m & 0o004 ? 'r' : '-',
      m & 0o002 ? 'w' : '-',
      m & 0o001 ? 'x' : '-',
    ]
    return perms.join('')
  }

  const handleConfirm = () => {
    // 转换为八进制字符串（带前导0）
    const modeStr = '0' + mode.toString(8).padStart(3, '0')
    onConfirm(modeStr)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>修改权限</DialogTitle>
          <DialogDescription>
            修改 <span className="font-mono text-foreground">{fileName}</span> 的权限
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 八进制输入 */}
          <div className="space-y-2">
            <Label htmlFor="octal">八进制模式</Label>
            <Input
              id="octal"
              value={octalInput}
              onChange={(e) => handleOctalChange(e.target.value)}
              placeholder="755"
              maxLength={3}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              预览: {formatPermissionString(mode)}
            </p>
          </div>

          {/* 权限复选框 */}
          <div className="space-y-4">
            {/* Owner */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">所有者</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="owner-read"
                    checked={hasPermission(permissions.owner.read)}
                    onCheckedChange={() => togglePermission(permissions.owner.read)}
                  />
                  <label
                    htmlFor="owner-read"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    读取 (r)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="owner-write"
                    checked={hasPermission(permissions.owner.write)}
                    onCheckedChange={() => togglePermission(permissions.owner.write)}
                  />
                  <label
                    htmlFor="owner-write"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    写入 (w)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="owner-execute"
                    checked={hasPermission(permissions.owner.execute)}
                    onCheckedChange={() => togglePermission(permissions.owner.execute)}
                  />
                  <label
                    htmlFor="owner-execute"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    执行 (x)
                  </label>
                </div>
              </div>
            </div>

            {/* Group */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">组</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="group-read"
                    checked={hasPermission(permissions.group.read)}
                    onCheckedChange={() => togglePermission(permissions.group.read)}
                  />
                  <label
                    htmlFor="group-read"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    读取 (r)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="group-write"
                    checked={hasPermission(permissions.group.write)}
                    onCheckedChange={() => togglePermission(permissions.group.write)}
                  />
                  <label
                    htmlFor="group-write"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    写入 (w)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="group-execute"
                    checked={hasPermission(permissions.group.execute)}
                    onCheckedChange={() => togglePermission(permissions.group.execute)}
                  />
                  <label
                    htmlFor="group-execute"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    执行 (x)
                  </label>
                </div>
              </div>
            </div>

            {/* Others */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">其他</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="others-read"
                    checked={hasPermission(permissions.others.read)}
                    onCheckedChange={() => togglePermission(permissions.others.read)}
                  />
                  <label
                    htmlFor="others-read"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    读取 (r)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="others-write"
                    checked={hasPermission(permissions.others.write)}
                    onCheckedChange={() => togglePermission(permissions.others.write)}
                  />
                  <label
                    htmlFor="others-write"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    写入 (w)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="others-execute"
                    checked={hasPermission(permissions.others.execute)}
                    onCheckedChange={() => togglePermission(permissions.others.execute)}
                  />
                  <label
                    htmlFor="others-execute"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    执行 (x)
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
