"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/context/AuthContext"
import { chatsApi } from "@/lib/api/chats"
import {
  ACTIVITY_LABELS,
  activityLabel,
  isActivityExpired,
  mergeServerActivities,
  type ChatActivity,
  type ChatActivityKind,
  type ServerChatActivity,
} from "@/lib/chat-activity"

const BUSY_POLL_MS = 4000
const IDLE_POLL_MS = 15000

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
  const activitiesRef = useRef(activities)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    activitiesRef.current = activities
  }, [activities])

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

  const refreshServer = useCallback(async () => {
    const rows = await chatsApi.listActivity()
    hydrateFromServer(rows)
  }, [hydrateFromServer])

  const hasTrackedWork = Object.keys(activities).length > 0

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
      setActivities({})
      return
    }

    void refreshServer().catch(() => undefined)
    const intervalMs = hasTrackedWork ? BUSY_POLL_MS : IDLE_POLL_MS
    pollRef.current = window.setInterval(() => {
      void refreshServer().catch(() => undefined)
    }, intervalMs)

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [authLoading, hasTrackedWork, isAuthenticated, refreshServer])

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
