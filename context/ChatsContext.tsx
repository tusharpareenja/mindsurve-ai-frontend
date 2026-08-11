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
import { generateChatTitle } from "@/lib/chat-title"
import { ApiError } from "@/lib/api/types"
import {
  chatsApi,
  mapChat,
  mapMessage,
  type ChatDto,
} from "@/lib/api/chats"
import type { Chat, ChatMessage, MessageRole } from "@/types"

export type ChatMessagePage = {
  messages: ChatMessage[]
  hasMore: boolean
  nextBefore?: string
}

type ChatsContextValue = {
  chats: Chat[]
  isLoading: boolean
  getChatsForProject: (projectId: string) => Chat[]
  getMessages: (chatId: string) => ChatMessage[]
  getPreview: (chatId: string) => string | undefined
  loadMessages: (chatId: string, before?: string) => Promise<ChatMessagePage>
  createChat: (projectId: string, title?: string) => Promise<Chat>
  startChatWithMessage: (
    projectId: string,
    content: string
  ) => Promise<{ chat: Chat; userMessage: ChatMessage }>
  addMessage: (
    chatId: string,
    role: MessageRole,
    content: string
  ) => Promise<ChatMessage>
  renameChat: (chatId: string, title: string) => Promise<Chat | null>
  deleteChat: (chatId: string) => Promise<boolean>
  clearProjectChats: (projectId: string) => void
  refresh: () => Promise<void>
}

const ChatsContext = createContext<ChatsContextValue | null>(null)

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [previews, setPreviews] = useState<Record<string, string | undefined>>({})
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(
    {}
  )
  const [isLoading, setIsLoading] = useState(true)

  const applyChatDtos = useCallback((rows: ChatDto[]) => {
    setChats(rows.map(mapChat))
    setPreviews((prev) => {
      const next = { ...prev }
      for (const row of rows) {
        if (row.last_message_preview != null) {
          next[row.id] = row.last_message_preview
        }
      }
      return next
    })
  }, [])

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setChats([])
      setPreviews({})
      return
    }
    const rows = await chatsApi.listAll()
    applyChatDtos(rows)
  }, [applyChatDtos, isAuthenticated])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setChats([])
      setPreviews({})
      setMessagesByChat({})
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    void refresh()
      .catch(() => {
        if (!cancelled) {
          setChats([])
          setPreviews({})
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, refresh])

  const getChatsForProject = useCallback(
    (projectId: string) =>
      chats
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [chats]
  )

  const getMessages = useCallback(
    (chatId: string) => messagesByChat[chatId] ?? [],
    [messagesByChat]
  )

  const getPreview = useCallback(
    (chatId: string) => previews[chatId],
    [previews]
  )

  const loadMessages = useCallback(async (chatId: string, before?: string) => {
    const page = await chatsApi.listMessages(chatId, before)
    const mapped = page.items.map(mapMessage)
    setMessagesByChat((prev) => {
      if (!before) return { ...prev, [chatId]: mapped }

      const existing = prev[chatId] ?? []
      const known = new Set(existing.map((message) => message.id))
      const older = mapped.filter((message) => !known.has(message.id))
      return { ...prev, [chatId]: [...older, ...existing] }
    })
    if (mapped.length) {
      setPreviews((prev) => ({
        ...prev,
        [chatId]: before
          ? prev[chatId]
          : mapped[mapped.length - 1]?.content,
      }))
    }
    return {
      messages: mapped,
      hasMore: page.has_more,
      nextBefore: page.next_before ?? undefined,
    }
  }, [])

  const upsertChat = useCallback((chat: Chat, preview?: string) => {
    setChats((prev) => {
      const rest = prev.filter((c) => c.id !== chat.id)
      return [chat, ...rest].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      )
    })
    if (preview !== undefined) {
      setPreviews((p) => ({ ...p, [chat.id]: preview }))
    }
  }, [])

  const createChat = useCallback(
    async (projectId: string, title = "New Chat") => {
      const dto = await chatsApi.create(projectId, title)
      const chat = mapChat(dto)
      upsertChat(chat, dto.last_message_preview ?? undefined)
      return chat
    },
    [upsertChat]
  )

  const addMessage = useCallback(
    async (chatId: string, role: MessageRole, content: string) => {
      const dto = await chatsApi.addMessage(chatId, { content, role })
      const msg = mapMessage(dto)
      setMessagesByChat((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] ?? []), msg],
      }))
      setPreviews((prev) => ({ ...prev, [chatId]: msg.content }))
      setChats((prev) =>
        prev
          .map((c) =>
            c.id === chatId ? { ...c, updatedAt: new Date(msg.createdAt) } : c
          )
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      )
      return msg
    },
    []
  )

  const startChatWithMessage = useCallback(
    async (projectId: string, content: string) => {
      const data = await chatsApi.start(projectId, content)
      const chat = mapChat(data.chat)
      const userMessage = mapMessage(data.message)
      upsertChat(chat, data.chat.last_message_preview ?? userMessage.content)
      setMessagesByChat((prev) => ({ ...prev, [chat.id]: [userMessage] }))

      void generateChatTitle(content).then(async (title) => {
        try {
          const renamed = await chatsApi.rename(chat.id, title)
          upsertChat(mapChat(renamed))
        } catch {
          // Title rename is best-effort; conversation already exists.
        }
      })

      return { chat, userMessage }
    },
    [upsertChat]
  )

  const renameChat = useCallback(
    async (chatId: string, title: string) => {
      try {
        const dto = await chatsApi.rename(chatId, title)
        const updated = mapChat(dto)
        upsertChat(updated)
        return updated
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
    [upsertChat]
  )

  const deleteChat = useCallback(async (chatId: string) => {
    try {
      await chatsApi.delete(chatId)
      setChats((prev) => prev.filter((c) => c.id !== chatId))
      setPreviews((prev) => {
        const next = { ...prev }
        delete next[chatId]
        return next
      })
      setMessagesByChat((prev) => {
        const next = { ...prev }
        delete next[chatId]
        return next
      })
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return false
      throw err
    }
  }, [])

  const clearProjectChats = useCallback((projectId: string) => {
    setChats((prev) => {
      const removed = new Set(prev.filter((c) => c.projectId === projectId).map((c) => c.id))
      setPreviews((p) => {
        const next = { ...p }
        for (const id of removed) delete next[id]
        return next
      })
      setMessagesByChat((m) => {
        const next = { ...m }
        for (const id of removed) delete next[id]
        return next
      })
      return prev.filter((c) => c.projectId !== projectId)
    })
  }, [])

  const value = useMemo(
    () => ({
      chats,
      isLoading: authLoading || isLoading,
      getChatsForProject,
      getMessages,
      getPreview,
      loadMessages,
      createChat,
      startChatWithMessage,
      addMessage,
      renameChat,
      deleteChat,
      clearProjectChats,
      refresh,
    }),
    [
      chats,
      authLoading,
      isLoading,
      getChatsForProject,
      getMessages,
      getPreview,
      loadMessages,
      createChat,
      startChatWithMessage,
      addMessage,
      renameChat,
      deleteChat,
      clearProjectChats,
      refresh,
    ]
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}

export function useChats() {
  const ctx = useContext(ChatsContext)
  if (!ctx) throw new Error("useChats must be used within ChatsProvider")
  return ctx
}
