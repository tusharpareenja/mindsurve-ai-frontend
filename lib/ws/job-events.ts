"use client"

import type { JobWsEvent } from "@/types/task-generation"
import { getAccessToken } from "@/lib/api/client"

export function parseJobWsEvent(raw: unknown): JobWsEvent {
  if (!raw || typeof raw !== "object") {
    return { type: "unknown", raw }
  }
  const msg = raw as Record<string, unknown>
  const type = typeof msg.type === "string" ? msg.type : ""

  if (type === "progress") {
    return {
      type: "progress",
      progress: Number(msg.progress ?? 0),
      message: typeof msg.message === "string" ? msg.message : undefined,
    }
  }
  if (type === "completed") {
    return {
      type: "completed",
      progress: typeof msg.progress === "number" ? msg.progress : 100,
      message: typeof msg.message === "string" ? msg.message : undefined,
    }
  }
  if (type === "failed") {
    return {
      type: "failed",
      error: typeof msg.error === "string" ? msg.error : undefined,
      message: typeof msg.message === "string" ? msg.message : undefined,
    }
  }
  if (type === "ping") {
    return { type: "ping" }
  }
  return { type: "unknown", raw }
}

export type JobWsHandlers = {
  onProgress: (progress: number, message?: string) => void
  onCompleted: (message?: string) => void
  onFailed: (error: string) => void
  onOpen?: () => void
  onDisconnected?: () => void
  onFallback?: () => void
}

export type JobWsSubscription = {
  stop: () => void
}

/**
 * Connect to Unilever task-generation WebSocket.
 * `websocketUrl` from MindSurve already includes the path; we append `?token=`.
 * Reconnects with exponential backoff; caller should poll REST as fallback.
 */
export function subscribeJobEvents(
  websocketUrl: string | null | undefined,
  handlers: JobWsHandlers,
  options?: { maxAttempts?: number }
): JobWsSubscription {
  let stopped = false
  let ws: WebSocket | null = null
  let attempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const maxAttempts = options?.maxAttempts ?? 6

  const cleanupSocket = () => {
    if (ws) {
      try {
        ws.onopen = null
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        ws.close()
      } catch {
        /* ignore */
      }
      ws = null
    }
  }

  const scheduleReconnect = () => {
    if (stopped) return
    if (attempts >= maxAttempts) {
      handlers.onFallback?.()
      return
    }
    const delay = Math.min(1000 * 2 ** attempts, 16000)
    attempts += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  const connect = () => {
    if (stopped) return
    if (!websocketUrl) {
      handlers.onFallback?.()
      return
    }
    const token = getAccessToken()
    if (!token) {
      handlers.onFallback?.()
      return
    }

    cleanupSocket()
    const sep = websocketUrl.includes("?") ? "&" : "?"
    const url = `${websocketUrl}${sep}token=${encodeURIComponent(token)}`

    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      attempts = 0
      handlers.onOpen?.()
    }

    ws.onmessage = (ev) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(ev.data))
      } catch {
        return
      }
      const event = parseJobWsEvent(parsed)
      if (event.type === "progress") {
        handlers.onProgress(event.progress, event.message)
      } else if (event.type === "completed") {
        handlers.onCompleted(event.message)
        stop()
      } else if (event.type === "failed") {
        handlers.onFailed(
          event.error || event.message || "Task generation failed."
        )
        stop()
      }
    }

    ws.onerror = () => {
      /* onclose handles reconnect */
    }

    ws.onclose = () => {
      if (stopped) return
      handlers.onDisconnected?.()
      scheduleReconnect()
    }
  }

  const stop = () => {
    stopped = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    cleanupSocket()
  }

  connect()
  return { stop }
}
