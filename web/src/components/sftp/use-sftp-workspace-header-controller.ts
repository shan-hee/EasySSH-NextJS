"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react"

export interface UseSftpWorkspaceHeaderControllerOptions {
  sessionLabel: string
  currentPath: string
  isEditorOpen: boolean
  editorPath: string
  onRenameSession?: (newLabel: string) => void
  editingSessionLabelRef?: MutableRefObject<boolean>
}

export interface UseSftpWorkspaceHeaderControllerResult {
  editingSessionLabel: boolean
  tempSessionLabel: string
  setTempSessionLabel: Dispatch<SetStateAction<string>>
  sessionLabelInputRef: RefObject<HTMLInputElement | null>
  pathInputValue: string
  setPathInputValue: Dispatch<SetStateAction<string>>
  isEditingPath: boolean
  setIsEditingPath: Dispatch<SetStateAction<boolean>>
  displayPath: string
  pathSegments: string[]
  startEditSessionLabel: () => void
  finishEditSessionLabel: () => void
  cancelEditSessionLabel: () => void
}

export function useSftpWorkspaceHeaderController({
  sessionLabel,
  currentPath,
  isEditorOpen,
  editorPath,
  onRenameSession,
  editingSessionLabelRef,
}: UseSftpWorkspaceHeaderControllerOptions): UseSftpWorkspaceHeaderControllerResult {
  const sessionLabelInputRef = useRef<HTMLInputElement>(null)
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingSessionLabel, setEditingSessionLabel] = useState(false)
  const [tempSessionLabel, setTempSessionLabel] = useState(sessionLabel)
  const [pathInputValue, setPathInputValue] = useState(currentPath)
  const [isEditingPath, setIsEditingPath] = useState(false)

  const displayPath = isEditorOpen ? editorPath : currentPath
  const pathSegments = useMemo(() => displayPath.split("/").filter(Boolean), [displayPath])

  const startEditSessionLabel = useCallback(() => {
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current)
    }

    setEditingSessionLabel(true)
    setTempSessionLabel(sessionLabel)
    focusTimeoutRef.current = setTimeout(() => {
      sessionLabelInputRef.current?.focus()
      sessionLabelInputRef.current?.select()
      focusTimeoutRef.current = null
    }, 0)
  }, [sessionLabel])

  const finishEditSessionLabel = useCallback(() => {
    const nextLabel = tempSessionLabel.trim()
    if (nextLabel && nextLabel !== sessionLabel) {
      onRenameSession?.(nextLabel)
    }
    setEditingSessionLabel(false)
  }, [onRenameSession, sessionLabel, tempSessionLabel])

  const cancelEditSessionLabel = useCallback(() => {
    setEditingSessionLabel(false)
    setTempSessionLabel(sessionLabel)
  }, [sessionLabel])

  useEffect(() => {
    if (!editingSessionLabel) {
      setTempSessionLabel(sessionLabel)
    }
  }, [editingSessionLabel, sessionLabel])

  useLayoutEffect(() => {
    if (editingSessionLabelRef) {
      editingSessionLabelRef.current = editingSessionLabel
    }
  }, [editingSessionLabel, editingSessionLabelRef])

  useEffect(() => () => {
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isEditingPath) {
      setPathInputValue(displayPath)
    }
  }, [displayPath, isEditingPath])

  return {
    editingSessionLabel,
    tempSessionLabel,
    setTempSessionLabel,
    sessionLabelInputRef,
    pathInputValue,
    setPathInputValue,
    isEditingPath,
    setIsEditingPath,
    displayPath,
    pathSegments,
    startEditSessionLabel,
    finishEditSessionLabel,
    cancelEditSessionLabel,
  }
}
