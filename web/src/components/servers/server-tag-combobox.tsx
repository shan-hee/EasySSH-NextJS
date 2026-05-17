"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Plus, Tag } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ServerTagComboboxProps {
  id?: string
  value: string
  placeholder: string
  selectedTags: string[]
  availableTags: string[]
  createLabel: (tag: string) => string
  onValueChange: (value: string) => void
  onAddTag: (tag: string) => void
}

export function ServerTagCombobox({
  id,
  value,
  placeholder,
  selectedTags,
  availableTags,
  createLabel,
  onValueChange,
  onAddTag,
}: ServerTagComboboxProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const normalizedSelectedTags = useMemo(
    () => new Set(selectedTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
    [selectedTags]
  )

  const normalizedQuery = value.trim().toLowerCase()
  const tagToCreate = value.trim()

  const suggestions = useMemo(() => {
    const seen = new Set<string>()

    return availableTags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag) => {
        const normalizedTag = tag.toLowerCase()
        if (seen.has(normalizedTag) || normalizedSelectedTags.has(normalizedTag)) {
          return false
        }
        seen.add(normalizedTag)
        return !normalizedQuery || normalizedTag.includes(normalizedQuery)
      })
  }, [availableTags, normalizedQuery, normalizedSelectedTags])

  const canCreate =
    tagToCreate.length > 0 &&
    !normalizedSelectedTags.has(normalizedQuery) &&
    !suggestions.some((tag) => tag.toLowerCase() === normalizedQuery)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  const commitTag = (tag: string) => {
    const normalizedTag = tag.trim()
    if (!normalizedTag) return

    onAddTag(normalizedTag)
    onValueChange("")
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commitTag(value)
      return
    }

    if (event.key === "Escape") {
      setOpen(false)
    }
  }

  const shouldShowDropdown = open && (suggestions.length > 0 || canCreate)

  return (
    <div ref={containerRef} className="relative">
      <Tag className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-9"
        role="combobox"
        aria-expanded={shouldShowDropdown}
        aria-autocomplete="list"
      />

      {shouldShowDropdown && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commitTag(tag)}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm outline-none transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              )}
            >
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{tag}</span>
            </button>
          ))}

          {canCreate && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commitTag(tagToCreate)}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm outline-none transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              )}
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{createLabel(tagToCreate)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
