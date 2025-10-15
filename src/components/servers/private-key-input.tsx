"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export interface PrivateKeyInputProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  errorText?: string
  className?: string
  accept?: string
  allowDragDrop?: boolean
}

function likelyPrivateKey(text: string) {
  if (!text || typeof text !== "string") return false
  const markers = [
    "BEGIN OPENSSH PRIVATE KEY",
    "BEGIN RSA PRIVATE KEY",
    "BEGIN PRIVATE KEY",
    "PuTTY-User-Key-File",
  ]
  return markers.some((m) => text.includes(m))
}

export function PrivateKeyInput({
  id = "privateKey",
  label = "私钥",
  value,
  onChange,
  required,
  placeholder = "粘贴或从文件导入私钥内容",
  errorText,
  className,
  accept = ".pem,.key,.ppk,.txt",
  allowDragDrop = true,
}: PrivateKeyInputProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [warning, setWarning] = React.useState<string | null>(null)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? "")
      onChange(text)
      setWarning(likelyPrivateKey(text) ? null : "未检测到常见私钥标识，请确认内容是否正确")
    }
    reader.readAsText(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      readFile(file)
    }
    // 允许选择相同文件时也能再次触发
    e.target.value = ""
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!allowDragDrop) return
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!allowDragDrop) return
    e.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!allowDragDrop) return
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      readFile(file)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept={accept}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            aria-label="选择私钥文件"
          >
            选择文件
          </Button>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "rounded-md border transition-colors",
          dragActive ? "ring-2 ring-primary border-ring" : "border-input"
        )}
      >
        <Textarea
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const text = e.target.value
            onChange(text)
            if (text.length === 0) {
              setWarning(null)
            } else {
              setWarning(likelyPrivateKey(text) ? null : null)
            }
          }}
          rows={8}
          className="font-mono text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {errorText ? (
        <p className="text-sm text-red-500">{errorText}</p>
      ) : warning ? (
        <p className="text-xs text-amber-600">{warning}</p>
      ) : null}
    </div>
  )
}

