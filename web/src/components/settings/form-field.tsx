"use client"

import * as React from "react"
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

interface BaseFormFieldProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>
  name: Path<TFieldValues>
  label: string
  description?: string
  required?: boolean
  className?: string
}

interface FormInputProps<TFieldValues extends FieldValues> extends BaseFormFieldProps<TFieldValues> {
  type?: "text" | "number" | "email" | "url" | "password"
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

interface FormSelectProps<TFieldValues extends FieldValues> extends BaseFormFieldProps<TFieldValues> {
  placeholder?: string
  options: Array<{ label: string; value: string }>
}

interface FormTextareaProps<TFieldValues extends FieldValues> extends BaseFormFieldProps<TFieldValues> {
  placeholder?: string
  rows?: number
}

type TranslationFn = ReturnType<typeof useTranslations>

function getTranslatedErrorMessage(t: TranslationFn, error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined
  }

  const rawMessage = "message" in error ? error.message : undefined
  if (typeof rawMessage !== "string") {
    return undefined
  }

  return rawMessage.startsWith("settingsValidation.")
    ? t(rawMessage as Parameters<TranslationFn>[0])
    : rawMessage
}

/**
 * 表单输入字段
 */
export function FormInput<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  description,
  required,
  type = "text",
  placeholder,
  min,
  max,
  step,
  className,
}: FormInputProps<TFieldValues>) {
  const t = useTranslations()
  const error = form.formState.errors[name]
  const message = getTranslatedErrorMessage(t, error)

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        {...form.register(name, {
          valueAsNumber: type === "number",
        })}
        className={error ? "border-destructive" : ""}
      />
      {message && (
        <p className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}

/**
 * 表单开关字段
 */
export function FormSwitch<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  description,
  className,
}: BaseFormFieldProps<TFieldValues>) {
  const value = form.watch(name)

  return (
    <div className={cn("flex flex-row items-center justify-between rounded-lg border p-4", className)}>
      <div className="space-y-0.5">
        <Label htmlFor={name} className="text-base">
          {label}
        </Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={name}
        checked={value}
        onCheckedChange={(checked) => form.setValue(name, checked as PathValue<TFieldValues, Path<TFieldValues>>)}
      />
    </div>
  )
}

/**
 * 表单选择字段
 */
export function FormSelect<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  description,
  required,
  placeholder,
  options,
  className,
}: FormSelectProps<TFieldValues>) {
  const t = useTranslations()
  const error = form.formState.errors[name]
  const message = getTranslatedErrorMessage(t, error)
  const value = form.watch(name)

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Select
        value={value}
        onValueChange={(val) => form.setValue(name, val as PathValue<TFieldValues, Path<TFieldValues>>)}
      >
        <SelectTrigger id={name} className={error ? "border-destructive" : ""}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {message && (
        <p className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}

/**
 * 表单文本域字段
 */
export function FormTextarea<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  description,
  required,
  placeholder,
  rows = 3,
  className,
}: FormTextareaProps<TFieldValues>) {
  const t = useTranslations()
  const error = form.formState.errors[name]
  const message = getTranslatedErrorMessage(t, error)

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Textarea
        id={name}
        placeholder={placeholder}
        rows={rows}
        {...form.register(name)}
        className={error ? "border-destructive" : ""}
      />
      {message && (
        <p className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}
