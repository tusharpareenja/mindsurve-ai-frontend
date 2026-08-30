"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/context/AuthContext"
import { chatsApi } from "@/lib/api/chats"
import { ensureAccessToken } from "@/lib/api/client"
import {
  ACTIVITY_LABELS,
  activityLabel,
  isActivityExpired,
  mergeServerActivities,
  type ChatActivity,
  type ChatActivityKind,
  type ServerChatActivity,
} from "@/lib/chat-activity"
import {
  startUserEventSocket,
  subscribeUserEvents,
  type UserEvent,
} from "@/lib/ws/user-events"

type ChatActivityContextValue = {
  getActivity: (chatId: string) => ChatActivity | undefined
  beginActivity: (chatId: string, kind: ChatActivityKind, label?: string) => void
  endActivity: (chatId: string, kind?: ChatActivityKind) => void
  hydrateFromServer: (rows: ServerChatActivity[]) => void
}

const ChatActivityContext = createContext<ChatActivityContextValue | null>(null)

export function ChatActivityProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [activities, setActivities] = useState<Record<string, ChatActivity>>({})

  const hydrateFromServer = useCallback((rows: ServerChatActivity[]) => {
    setActivities((current) => mergeServerActivities(current, rows))
  }, [])

  const beginActivity = useCallback(
    (chatId: string, kind: ChatActivityKind, label?: string) => {
      if (!chatId) return
      setActivities((current) => ({
        ...current,
        [chatId]: {
          kind,
          label: activityLabel(kind, label),
          source: "client",
          startedAt: Date.now(),
        },
      }))
    },
    []
  )

  const endActivity = useCallback((chatId: string, kind?: ChatActivityKind) => {
    if (!chatId) return
    setActivities((current) => {
      const existing = current[chatId]
      if (!existing) return current
      if (kind && existing.kind !== kind) return current
      const next = { ...current }
      delete next[chatId]
      return next
    })
  }, [])

  const getActivity = useCallback(
    (chatId: string) => {
      const activity = activities[chatId]
      if (!activity || isActivityExpired(activity)) return undefined
      return activity
    },
    [activities]
  )

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setActivities({})
      return
    }

    let cancelled = false
    let sawSnapshot = false

    const applyEvent = (event: UserEvent) => {
      if (event.type === "activity.snapshot") {
        sawSnapshot = true
        hydrateFromServer(event.activities)
        return
      }
      if (event.type !== "activity") return
      if (event.active && event.kind) {
        hydrateFromServer([
          {
            chat_id: event.chat_id,
            kind: event.kind,
            label: event.label || "",
          },
        ])
        return
      }
      endActivity(event.chat_id, event.kind)
    }

    const unsub = subscribeUserEvents(applyEvent)
    let stopRef: (() => void) | null = null

    void (async () => {
      await ensureAccessToken()
      if (cancelled) return
      const stopSocket = startUserEventSocket()
      if (cancelled) {
        stopSocket()
        return
      }
      stopRef = stopSocket
    })()

    const fallback = window.setTimeout(() => {
      if (cancelled || sawSnapshot) return
      void chatsApi.listActivity()
        .then((rows) => {
          if (!cancelled) hydrateFromServer(rows)
        })
        .catch(() => undefined)
    }, 3000)

    return () => {
      cancelled = true
      window.clearTimeout(fallback)
      unsub()
      stopRef?.()
    }
  }, [authLoading, endActivity, hydrateFromServer, isAuthenticated])

  const value = useMemo(
    () => ({
      getActivity,
      beginActivity,
      endActivity,
      hydrateFromServer,
    }),
    [beginActivity, endActivity, getActivity, hydrateFromServer]
  )

  return (
    <ChatActivityContext.Provider value={value}>
      {children}
    </ChatActivityContext.Provider>
  )
}

export function useChatActivity() {
  const ctx = useContext(ChatActivityContext)
  if (!ctx) {
    throw new Error("useChatActivity must be used within ChatActivityProvider")
  }
  return ctx
}

export { ACTIVITY_LABELS }
