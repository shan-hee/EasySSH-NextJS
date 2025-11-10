"use client"

import { useEffect, useState } from "react"
import { useForm, UseFormReturn, FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

interface UseSettingsFormOptions<T extends FieldValues> {
  schema: z.ZodType<T, any, any>
  loadFn: () => Promise<T>
  saveFn: (data: T) => Promise<void>
  onSuccess?: () => void
  onError?: (error: Error) => void
  defaultValues?: Partial<T>
}

interface UseSettingsFormReturn<T extends FieldValues> {
  form: UseFormReturn<T>
  isLoading: boolean
  isSaving: boolean
  handleSave: () => Promise<void>
  reload: () => Promise<void>
}

/**
 * 通用的设置表单Hook
 *
 * @param options 配置选项
 * @returns 表单实例和相关状态
 *
 * @example
 * const { form, isLoading, isSaving, handleSave } = useSettingsForm({
 *   schema: systemConfigSchema,
 *   loadFn: settingsApi.getSystemConfig,
 *   saveFn: settingsApi.saveSystemConfig,
 * })
 */
export function useSettingsForm<T extends FieldValues>({
  schema,
  loadFn,
  saveFn,
  onSuccess,
  onError,
  defaultValues,
}: UseSettingsFormOptions<T>): UseSettingsFormReturn<T> {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<T>({
    resolver: zodResolver(schema) as any,
    defaultValues: defaultValues as any,
  })

  // 加载配置数据
  const loadData = async () => {
    try {
      setIsLoading(true)
      const data = await loadFn()
      form.reset(data)
    } catch (error) {
      const err = error as Error
      toast.error("加载配置失败: " + (err.message || "未知错误"))
      onError?.(err)
    } finally {
      setIsLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 保存配置
  const handleSave = async () => {
    // 先进行表单验证
    const isValid = await form.trigger()
    if (!isValid) {
      toast.error("请检查表单输入")
      return
    }

    const data = form.getValues()
    setIsSaving(true)

    try {
      await saveFn(data)
      toast.success("保存成功")
      onSuccess?.()
    } catch (error) {
      const err = error as Error
      toast.error("保存失败: " + (err.message || "未知错误"))
      onError?.(err)
    } finally {
      setIsSaving(false)
    }
  }

  return {
    form,
    isLoading,
    isSaving,
    handleSave,
    reload: loadData,
  }
}
