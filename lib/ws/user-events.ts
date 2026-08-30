"use client"

import { API_BASE_URL } from "@/lib/api/config"
import { getAccessToken } from "@/lib/api/client"
import type { ServerChatActivity } from "@/lib/chat-activity"
import type { SyntheticCollectionRun } from "@/types/synthetic-collection"
import type { GenerationRun } from "@/types/task-generation"

export type UserActivityEvent = {
  type: "activity"
  chat_id: string
  active: boolean
  kind?: "generating" | "collecting"
  label?: string
}

export type UserEvent =
  | { type: "activity.snapshot"; activities: ServerChatActivity[] }
  | UserActivityEvent
  | { type: "collection"; chat_id: string; run: SyntheticCollectionRun }
  | { type: "generation"; chat_id: string; run: GenerationRun }
  | { type: "pong" }
  | { type: "ping" }
  | { type: "error"; message?: string }
  | { type: "unknown"; raw: unknown }

export type UserEventHandler = (event: UserEvent) => void

const handlers = new Set<UserEventHandler>()
let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let attempts = 0
let started = false
let startCount = 0

export function parseUserEvent(raw: unknown): UserEvent {
  if (!raw || typeof raw !== "object") {
    return { type: "unknown", raw }
  }
  const msg = raw as Record<string, unknown>
  const type = typeof msg.type === "string" ? msg.type : ""

  if (type === "activity.snapshot") {
    const rows = Array.isArray(msg.activities) ? msg.activities : []
    const activities: ServerChatActivity[] = []
    for (const row of rows) {
      if (!row || typeof row !== "object") continue
      const item = row as Record<string, unknown>
      if (
        typeof item.chat_id === "string" &&
        (item.kind === "generating" || item.kind === "collecting")
      ) {
        activities.push({
          chat_id: item.chat_id,
          kind: item.kind,
          label: typeof item.label === "string" ? item.label : "",
        })
      }
    }
    return { type: "activity.snapshot", activities }
  }

  if (type === "activity" && typeof msg.chat_id === "string") {
    return {
      type: "activity",
      chat_id: msg.chat_id,
      active: Boolean(msg.active),
      kind:
        msg.kind === "generating" || msg.kind === "collecting"
          ? msg.kind
          : undefined,
      label: typeof msg.label === "string" ? msg.label : undefined,
    }
  }

  if (type === "collection" && typeof msg.chat_id === "string" && msg.run) {
    return {
      type: "collection",
      chat_id: msg.chat_id,
      run: msg.run as SyntheticCollectionRun,
    }
  }

  if (type === "generation" && typeof msg.chat_id === "string" && msg.run) {
    return {
      type: "generation",
      chat_id: msg.chat_id,
      run: msg.run as GenerationRun,
    }
  }

  if (type === "pong" || type === "ping") {
    return { type }
  }

  if (type === "error") {
    return {
      type: "error",
      message: typeof msg.message === "string" ? msg.message : undefined,
    }
  }

  return { type: "unknown", raw }
}

export function userEventsWsUrl(token: string): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim()
  const url = explicit
    ? new URL(explicit.endsWith("/ws") ? explicit : `${explicit.replace(/\/+$/, "")}/ws`)
    : defaultWsUrl()
  url.searchParams.set("token", token)
  return url.toString()
}

function defaultWsUrl(): URL {
  if (API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://")) {
    const url = new URL(`${API_BASE_URL.replace(/\/+$/, "")}/ws`)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    return url
  }
  // Same-origin /api/v1 is an HTTP proxy — it cannot upgrade WebSockets.
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = process.env.NEXT_PUBLIC_BACKEND_WS_HOST?.trim()
    || `${window.location.hostname}:8000`
  return new URL(`${proto}//${host}/api/v1/ws`)
}

function dispatch(event: UserEvent): void {
  for (const handler of handlers) {
    try {
      handler(event)
    } catch {
      /* subscriber errors must not tear down the socket */
    }
  }
}

function clearTimers(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (pingTimer) {
    clearInterval(pingTimer)
    pingTimer = null
  }
}

function closeSocket(): void {
  if (!socket) return
  try {
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    socket.close()
  } catch {
    /* ignore */
  }
  socket = null
}

function scheduleReconnect(): void {
  if (!started) return
  clearTimers()
  const delay = Math.min(15_000, 800 * 2 ** Math.min(attempts, 4))
  attempts += 1
  reconnectTimer = setTimeout(() => {
    openSocket()
  }, delay)
}

function openSocket(): void {
  if (!started) return
  const token = getAccessToken()
  if (!token) {
    scheduleReconnect()
    return
  }

  closeSocket()
  let next: WebSocket
  try {
    next = new WebSocket(userEventsWsUrl(token))
  } catch {
    scheduleReconnect()
    return
  }
  socket = next

  next.onopen = () => {
    attempts = 0
    if (pingTimer) clearInterval(pingTimer)
    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send("ping")
      }
    }, 25_000)
  }

  next.onmessage = (event) => {
    try {
      dispatch(parseUserEvent(JSON.parse(String(event.data))))
    } catch {
      /* ignore malformed frames */
    }
  }

  next.onerror = () => {
    /* onclose handles retry */
  }

  next.onclose = () => {
    if (socket === next) socket = null
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
    scheduleReconnect()
  }
}

/** Open the shared user socket. Safe to call more than once (ref-counted). */
export function startUserEventSocket(): () => void {
  startCount += 1
  started = true
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    openSocket()
  }
  return () => {
    startCount = Math.max(0, startCount - 1)
    if (startCount > 0) return
    started = false
    clearTimers()
    closeSocket()
    attempts = 0
  }
}

export function subscribeUserEvents(handler: UserEventHandler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}
