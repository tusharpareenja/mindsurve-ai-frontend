"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  clearAnalyticsAssistantHistory,
  getAnalyticsAssistantHistory,
  postAnalyticsAssistantQuery,
} from "@/lib/api/AnalyticsAssistantAPI"
import type {
  AssistantAction,
  AssistantChatMessage,
  AssistantFollowUpContext,
  AssistantHistoryItem,
  AssistantQueryResponse,
} from "@/lib/types/analyticsAssistant"

const HISTORY_PAGE_SIZE = 20

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Phrased as real questions rather than canned commands: the assistant composes
// its own lookups, so these are examples of freedom, not the menu of what works.
const STARTER_PROMPTS = [
  "Which element should I show the client, and why?",
  "Give me the 5 most important findings from this study",
  "Generate a PowerPoint for this study",
  "Where do men and women disagree most?",
  "Is the top design meaningfully better than the runner-up?",
  "Which claims are strong enough to build a campaign on?",
  "Do younger respondents want something different?",
  "What should we drop from the pack?",
  "Summarise this study for a client in three lines",
]

function welcomeMessage(): AssistantChatMessage {
  return {
    id: newId(),
    role: "assistant",
    text: "Welcome! Ask me anything about this study — in your own words. I read the verified analysis to answer, so you can ask follow-ups too.",
    createdAt: new Date().toISOString(),
    localOnly: true,
    status: "complete",
  }
}

function historyItemToChatMessage(item: AssistantHistoryItem): AssistantChatMessage {
  return {
    id: item.id,
    serverId: item.id,
    role: item.role,
    text: item.content,
    createdAt: item.created_at,
    clientMessageId: item.client_message_id || null,
    parentMessageId: item.parent_message_id || null,
    status: (item.status as AssistantChatMessage["status"]) || "complete",
    response: item.response || undefined,
    pending: false,
    error: item.response?.error || null,
  }
}

function mergeById(
  existing: AssistantChatMessage[],
  incoming: AssistantChatMessage[],
  mode: "prepend" | "replace" | "append"
): AssistantChatMessage[] {
  const seen = new Set<string>()
  const out: AssistantChatMessage[] = []

  const push = (msg: AssistantChatMessage) => {
    const key = msg.serverId || msg.id
    if (seen.has(key)) return
    // Also skip if clientMessageId already present (optimistic vs server).
    if (msg.clientMessageId) {
      const dup = out.find(
        (m) => m.clientMessageId && m.clientMessageId === msg.clientMessageId && m.role === msg.role
      )
      if (dup) {
        // Prefer server-backed version.
        if (msg.serverId && !dup.serverId) {
          Object.assign(dup, msg)
        }
        return
      }
    }
    seen.add(key)
    out.push(msg)
  }

  if (mode === "replace") {
    incoming.forEach(push)
    return out
  }
  if (mode === "prepend") {
    incoming.forEach(push)
    existing.forEach(push)
    return out
  }
  existing.forEach(push)
  incoming.forEach(push)
  return out
}

export function useAnalyticsAssistant(options: {
  studyId: string
  studyType?: string
  activeFilters?: Record<string, any> | null
  isFilterActive?: boolean
  onAction?: (action: AssistantAction, response?: AssistantQueryResponse) => void | Promise<void>
}) {
  const {
    studyId,
    activeFilters = null,
    isFilterActive = false,
    onAction,
  } = options

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState<AssistantFollowUpContext | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const historyAbortRef = useRef<AbortController | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const nextCursorRef = useRef<string | null>(null)
  const loadingOlderRef = useRef(false)
  const historyLoadedForStudyRef = useRef<string | null>(null)

  const starters = STARTER_PROMPTS
  const showWelcome = historyLoaded && messages.length === 0

  // Reset when study changes.
  useEffect(() => {
    abortRef.current?.abort()
    historyAbortRef.current?.abort()
    setMessages([])
    setFollowUp(null)
    setError(null)
    setHistoryLoaded(false)
    setHasMoreOlder(false)
    setHistoryLoading(false)
    setLoadingOlder(false)
    nextCursorRef.current = null
    conversationIdRef.current = null
    historyLoadedForStudyRef.current = null
    loadingOlderRef.current = false
  }, [studyId])

  const loadLatestHistory = useCallback(async () => {
    if (!studyId) return
    if (historyLoadedForStudyRef.current === studyId) return

    historyAbortRef.current?.abort()
    const controller = new AbortController()
    historyAbortRef.current = controller
    setHistoryLoading(true)
    setError(null)

    try {
      const page = await getAnalyticsAssistantHistory(studyId, {
        limit: HISTORY_PAGE_SIZE,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return

      const mapped = (page.items || []).map(historyItemToChatMessage)
      setMessages(mapped)
      setHasMoreOlder(Boolean(page.meta?.has_more))
      nextCursorRef.current = page.meta?.next_cursor || null
      conversationIdRef.current = page.meta?.conversation_id || null
      if (page.follow_up_context) {
        setFollowUp(page.follow_up_context)
      } else {
        setFollowUp(null)
      }
      historyLoadedForStudyRef.current = studyId
      setHistoryLoaded(true)
    } catch (e: any) {
      if (e?.name === "AbortError") return
      setError(e?.message || "Failed to load chat history")
      setMessages([])
      setHistoryLoaded(true)
      historyLoadedForStudyRef.current = studyId
    } finally {
      setHistoryLoading(false)
    }
  }, [studyId])

  // Load latest page when the panel opens (not on every analytics page mount).
  useEffect(() => {
    if (!open || !studyId) return
    void loadLatestHistory()
  }, [open, studyId, loadLatestHistory])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      historyAbortRef.current?.abort()
    }
  }, [])

  const loadOlderMessages = useCallback(async () => {
    if (!studyId || !hasMoreOlder || loadingOlderRef.current) return false
    const cursor = nextCursorRef.current
    if (!cursor) {
      setHasMoreOlder(false)
      return false
    }

    loadingOlderRef.current = true
    setLoadingOlder(true)
    try {
      const page = await getAnalyticsAssistantHistory(studyId, {
        limit: HISTORY_PAGE_SIZE,
        before: cursor,
      })
      const mapped = (page.items || []).map(historyItemToChatMessage)
      setMessages((prev) => mergeById(prev, mapped, "prepend"))
      setHasMoreOlder(Boolean(page.meta?.has_more))
      nextCursorRef.current = page.meta?.next_cursor || null
      return mapped.length > 0
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Failed to load older messages")
      }
      return false
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [studyId, hasMoreOlder])

  const sendMessage = useCallback(
    async (rawMessage: string, options?: { clientMessageId?: string; replaceFailed?: boolean }) => {
      const message = rawMessage.trim()
      if (!message || !studyId || loading) return

      setError(null)
      setLoading(true)
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const clientMessageId = options?.clientMessageId || newId()
      const userMsg: AssistantChatMessage = {
        id: clientMessageId,
        clientMessageId,
        role: "user",
        text: message,
        createdAt: new Date().toISOString(),
        status: "sending",
      }
      const pendingId = newId()
      setMessages((prev) => {
        let base = prev.filter((m) => !m.localOnly)
        if (options?.replaceFailed && options.clientMessageId) {
          // Drop previous failed pair for this client id before retrying.
          base = base.filter((m) => {
            if (m.clientMessageId === options.clientMessageId && m.role === "user") return false
            if (m.parentMessageId === options.clientMessageId && m.role === "assistant") return false
            if (m.status === "failed" && m.role === "assistant" && m.parentMessageId === options.clientMessageId) {
              return false
            }
            return true
          })
        }
        return [
          ...base,
          userMsg,
          {
            id: pendingId,
            role: "assistant",
            text: "Computing a verified answer…",
            createdAt: new Date().toISOString(),
            pending: true,
            status: "sending",
            parentMessageId: clientMessageId,
          },
        ]
      })
      setInput("")

      try {
        const response = await postAnalyticsAssistantQuery(
          studyId,
          {
            message,
            use_active_filters: Boolean(isFilterActive),
            filters: isFilterActive ? activeFilters : null,
            follow_up: followUp,
            conversation_id: conversationIdRef.current,
            client_message_id: clientMessageId,
          },
          controller.signal
        )

        if (response.follow_up_context) {
          setFollowUp(response.follow_up_context)
        }
        if (response.conversation_id) {
          conversationIdRef.current = response.conversation_id
        }

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.clientMessageId === clientMessageId && msg.role === "user") {
              return {
                ...msg,
                id: response.user_message_id || msg.id,
                serverId: response.user_message_id || msg.serverId,
                status: "sent",
                error: null,
              }
            }
            if (msg.id === pendingId) {
              return {
                id: response.assistant_message_id || pendingId,
                serverId: response.assistant_message_id || null,
                role: "assistant",
                text: response.answer_text,
                createdAt: new Date().toISOString(),
                response,
                pending: false,
                status: response.status === "error" ? "error" : "complete",
                parentMessageId: response.user_message_id || clientMessageId,
                error: response.error || null,
              }
            }
            return msg
          })
        )

        // Auto-start PPT download when the assistant prepares a deck.
        const pptAction = response.actions?.find((action) => action.type === "download_ppt")
        if (pptAction && onAction) {
          void onAction(pptAction, response)
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return
        const errText = e?.message || "Assistant request failed"
        setError(errText)
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.clientMessageId === clientMessageId && msg.role === "user") {
              return { ...msg, status: "failed", error: errText }
            }
            if (msg.id === pendingId) {
              return {
                ...msg,
                pending: false,
                status: "failed",
                text: "I could not complete that verified query.",
                error: errText,
              }
            }
            return msg
          })
        )
      } finally {
        setLoading(false)
      }
    },
    [studyId, loading, isFilterActive, activeFilters, followUp, onAction]
  )

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    if (!lastUser) return
    void sendMessage(lastUser.text, {
      clientMessageId: lastUser.clientMessageId || undefined,
      replaceFailed: true,
    })
  }, [messages, sendMessage])

  const clearChat = useCallback(async () => {
    if (!studyId) return
    abortRef.current?.abort()
    const previous = messages
    const previousFollowUp = followUp
    const previousCursor = nextCursorRef.current
    const previousHasMore = hasMoreOlder
    const previousConversation = conversationIdRef.current

    // Optimistic clear.
    setMessages([])
    setFollowUp(null)
    setError(null)
    setHasMoreOlder(false)
    nextCursorRef.current = null

    try {
      await clearAnalyticsAssistantHistory(studyId)
      conversationIdRef.current = null
      historyLoadedForStudyRef.current = studyId
      setHistoryLoaded(true)
    } catch (e: any) {
      setMessages(previous)
      setFollowUp(previousFollowUp)
      nextCursorRef.current = previousCursor
      setHasMoreOlder(previousHasMore)
      conversationIdRef.current = previousConversation
      setError(e?.message || "Failed to clear chat")
    }
  }, [studyId, messages, followUp, hasMoreOlder])

  const runAction = useCallback(
    async (action: AssistantAction, response?: AssistantQueryResponse) => {
      if (onAction) await onAction(action, response)
    },
    [onAction]
  )

  return {
    open,
    setOpen,
    messages,
    input,
    setInput,
    loading,
    historyLoading,
    loadingOlder,
    historyLoaded,
    hasMoreOlder,
    showWelcome,
    error,
    starters,
    followUp,
    sendMessage,
    loadOlderMessages,
    retryLast,
    clearChat,
    runAction,
  }
}
