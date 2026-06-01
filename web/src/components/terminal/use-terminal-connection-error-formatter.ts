"use client"

import { useCallback } from "react"
import type { TerminalConnectionError } from "@/lib/websocket-terminal"

type TerminalTranslator = (key: string, params?: Record<string, string | number>) => string

export function formatTerminalConnectionError(
  error: TerminalConnectionError,
  tTerminal: TerminalTranslator,
) {
  const rawMessage = (error.rawMessage || error.message || "").toLowerCase()

  if (
    error.code === "initialization_timeout" ||
    error.code === "connection_timeout" ||
    rawMessage.includes("timeout")
  ) {
    return tTerminal("terminalErrorTimeout")
  }

  if (
    error.code === "auth_cancelled" ||
    rawMessage.includes("authentication cancelled") ||
    rawMessage.includes("passphrase cancelled")
  ) {
    return tTerminal("terminalErrorAuthCancelled")
  }

  if (
    error.code === "private_key_passphrase_required" ||
    rawMessage.includes("private_key_passphrase_required")
  ) {
    return tTerminal("terminalErrorPrivateKeyPassphraseRequired")
  }

  if (
    error.code === "private_key_passphrase_invalid" ||
    rawMessage.includes("private_key_passphrase_invalid")
  ) {
    return tTerminal("terminalErrorPrivateKeyPassphraseInvalid")
  }

  if (
    error.code === "private_key_invalid" ||
    rawMessage.includes("failed to parse private key")
  ) {
    return tTerminal("terminalErrorPrivateKeyInvalid")
  }

  if (
    error.code === "private_key_decrypt_failed" ||
    error.code === "password_decrypt_failed"
  ) {
    return tTerminal("terminalErrorCredentialDecryptFailed")
  }

  if (
    error.code === "auth_failed" ||
    rawMessage.includes("unable to authenticate") ||
    rawMessage.includes("permission denied") ||
    rawMessage.includes("authentication failed")
  ) {
    return tTerminal("terminalErrorAuthFailed")
  }

  if (
    error.code === "server_not_found" ||
    rawMessage.includes("server_not_found")
  ) {
    return tTerminal("terminalErrorServerNotFound")
  }

  if (
    error.code === "websocket_error" ||
    rawMessage.includes("websocket")
  ) {
    return tTerminal("terminalErrorWebSocket")
  }

  if (
    error.code === "host_key_changed" ||
    rawMessage.includes("host key verification failed")
  ) {
    return tTerminal("terminalErrorHostKeyChanged")
  }

  if (
    error.code === "host_key_revoked" ||
    rawMessage.includes("host key trust has been revoked")
  ) {
    return tTerminal("terminalErrorHostKeyRevoked")
  }

  if (
    error.code === "ssh_algorithm_mismatch" ||
    rawMessage.includes("no common algorithm")
  ) {
    return tTerminal("terminalErrorAlgorithmMismatch")
  }

  if (
    error.code === "connection_failed" ||
    error.code === "connection_refused" ||
    error.code === "no_route_to_host" ||
    error.code === "network_unreachable" ||
    rawMessage.includes("connection_failed") ||
    rawMessage.includes("connection refused") ||
    rawMessage.includes("no route to host") ||
    rawMessage.includes("network is unreachable") ||
    rawMessage.includes("i/o timeout")
  ) {
    return tTerminal("terminalErrorHostUnreachable")
  }

  return tTerminal("terminalErrorGeneric")
}

export function useTerminalConnectionErrorFormatter(tTerminal: TerminalTranslator) {
  return useCallback(
    (error: TerminalConnectionError) => formatTerminalConnectionError(error, tTerminal),
    [tTerminal],
  )
}
