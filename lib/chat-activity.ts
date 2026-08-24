export type ChatActivityKind =
  | "thinking"
  | "creating"
  | "generating"
  | "collecting"

export type ChatActivitySource = "client" | "server"

export type ChatActivity = {
  kind: ChatActivityKind
  label: string
  source: ChatActivitySource
  startedAt: number
}

export type ServerChatActivity = {
  chat_id: string
  kind: "generating" | "collecting"
  label: string
}

export const ACTIVITY_LABELS: Record<ChatActivityKind, string> = {
  thinking: "Thinking…",
  creating: "Creating study…",
  generating: "Generating tasks…",
  collecting: "Collecting responses…",
}

const KIND_PRIORITY: Record<ChatActivityKind, number> = {
  thinking: 4,
  creating: 3,
  generating: 2,
  collecting: 1,
}

export const THINKING_TTL_MS = 3 * 60 * 1000
export const JOB_GRACE_MS = 10_000

export function activityLabel(kind: ChatActivityKind, label?: string): string {
  const trimmed = (label || "").trim()
  return trimmed || ACTIVITY_LABELS[kind]
}

export function isActivityExpired(
  activity: ChatActivity,
  now = Date.now()
): boolean {
  if (activity.kind === "thinking" || activity.kind === "creating") {
    return now - activity.startedAt > THINKING_TTL_MS
  }
  return false
}

export function mergeServerActivities(
  current: Record<string, ChatActivity>,
  rows: ServerChatActivity[],
  now = Date.now()
): Record<string, ChatActivity> {
  const next: Record<string, ChatActivity> = {}
  const serverIds = new Set(rows.map((row) => row.chat_id))

  for (const [chatId, activity] of Object.entries(current)) {
    if (isActivityExpired(activity, now)) continue
    next[chatId] = activity
  }

  for (const row of rows) {
    const existing = next[row.chat_id]
    if (
      existing &&
      existing.source === "client" &&
      KIND_PRIORITY[existing.kind] > KIND_PRIORITY[row.kind]
    ) {
      continue
    }
    next[row.chat_id] = {
      kind: row.kind,
      label: activityLabel(row.kind, row.label),
      source: "server",
      startedAt: existing?.startedAt ?? now,
    }
  }

  for (const [chatId, activity] of Object.entries(next)) {
    if (serverIds.has(chatId)) continue
    if (activity.source === "server") {
      delete next[chatId]
      continue
    }
    if (
      (activity.kind === "generating" || activity.kind === "collecting") &&
      now - activity.startedAt > JOB_GRACE_MS
    ) {
      delete next[chatId]
    }
  }

  return next
}
