import { useState, useCallback } from "react"

interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  validate?: (value: unknown) => boolean | string
}

interface ValidationRules {
  [key: string]: ValidationRule
}

interface UseFormValidationReturn<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  isValid: boolean
  setValue: (name: keyof T, value: unknown) => void
  setError: (name: keyof T, error: string) => void
  clearError: (name: keyof T) => void
  validate: (name?: keyof T) => boolean
  reset: () => void
  handleSubmit: (onSubmit: (values: T) => void) => (e: React.FormEvent) => void
}

export function useFormValidation<T extends Record<string, unknown>>(
  initialValues: T,
  rules: ValidationRules = {}
): UseFormValidationReturn<T> {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})

  const validateField = useCallback((name: keyof T, value: unknown): string | null => {
    const rule = rules[name as string]
    if (!rule) return null

    // Required validation
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return "此字段为必填项"
    }

    // Skip other validations if value is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null
    }

    // MinLength validation
    if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      return `最少需要 ${rule.minLength} 个字符`
    }

    // MaxLength validation
    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      return `最多允许 ${rule.maxLength} 个字符`
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return "格式不正确"
    }

    // Custom validation
    if (rule.validate) {
      const result = rule.validate(value)
      if (typeof result === 'string') {
        return result
      }
      if (result === false) {
        return "验证失败"
      }
    }

    return null
  }, [rules])

  const setValue = useCallback((name: keyof T, value: unknown) => {
    setValues(prev => ({ ...prev, [name]: value }))

    // Validate field on change
    const error = validateField(name, value)
    setErrors(prev => ({
      ...prev,
      [name]: error || undefined
    }))
  }, [validateField])

  const setError = useCallback((name: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }))
  }, [])

  const clearError = useCallback((name: keyof T) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[name]
      return newErrors
    })
  }, [])

  const validate = useCallback((name?: keyof T): boolean => {
    if (name) {
      // Validate single field
      const error = validateField(name, values[name])
      setErrors(prev => ({
        ...prev,
        [name]: error || undefined
      }))
      return !error
    } else {
      // Validate all fields
      const newErrors: Partial<Record<keyof T, string>> = {}
      let isValid = true

      for (const fieldName in rules) {
        const error = validateField(fieldName as keyof T, values[fieldName as keyof T])
        if (error) {
          newErrors[fieldName as keyof T] = error
          isValid = false
        }
      }

      setErrors(newErrors)
      return isValid
    }
  }, [validateField, values, rules])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
  }, [initialValues])

  const handleSubmit = useCallback((onSubmit: (values: T) => void) => {
    return (e: React.FormEvent) => {
      e.preventDefault()
      if (validate()) {
        onSubmit(values)
      }
    }
  }, [validate, values])

  const isValid = Object.keys(errors).length === 0

  return {
    values,
    errors,
    isValid,
    setValue,
    setError,
    clearError,
    validate,
    reset,
    handleSubmit,
  }
}

// 常用的验证规则
export const validationRules = {
  required: { required: true },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    required: true,
    minLength: 8,
  },
  url: {
    pattern: /^https?:\/\/.+/,
  },
  ip: {
    pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  },
  port: {
    validate: (value: string) => {
      const num = parseInt(value)
      return !isNaN(num) && num >= 1 && num <= 65535
    }
  },
}