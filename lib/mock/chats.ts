/**
 * Mock chats + messages store (localStorage).
 * TODO(api): replace with chats/messages API — Project owns research state; Chat owns conversation.
 */

import type { Chat, ChatMessage, MessageRole } from "@/types"

const CHATS_KEY = "mindsurve_mock_chats"
const MESSAGES_KEY = "mindsurve_mock_messages"

function reviveChat(c: Chat): Chat {
  return {
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  }
}

function reviveMessage(m: ChatMessage): ChatMessage {
  return {
    ...m,
    createdAt: new Date(m.createdAt),
  }
}

export function loadChats(): Chat[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as Chat[]).map(reviveChat)
  } catch {
    return []
  }
}

function saveChats(chats: Chat[]) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
}

export function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(MESSAGES_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as ChatMessage[]).map(reviveMessage)
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages))
}

export function getChatsByProject(projectId: string): Chat[] {
  return loadChats()
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

export function getChatById(chatId: string): Chat | undefined {
  return loadChats().find((c) => c.id === chatId)
}

export function getMessagesByChat(chatId: string): ChatMessage[] {
  return loadMessages()
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export function createChat(projectId: string, title = "New Chat"): Chat {
  const now = new Date()
  const chat: Chat = {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    title,
    createdAt: now,
    updatedAt: now,
  }
  saveChats([chat, ...loadChats()])
  return chat
}

export function updateChatTitle(chatId: string, title: string): Chat | null {
  const chats = loadChats()
  const index = chats.findIndex((c) => c.id === chatId)
  if (index === -1) return null
  const updated: Chat = {
    ...chats[index],
    title: title.trim() || chats[index].title,
    updatedAt: new Date(),
  }
  chats[index] = updated
  saveChats(chats)
  return updated
}

export function touchChat(chatId: string): void {
  const chats = loadChats()
  const index = chats.findIndex((c) => c.id === chatId)
  if (index === -1) return
  chats[index] = { ...chats[index], updatedAt: new Date() }
  saveChats(chats)
}

export function deleteChat(chatId: string): boolean {
  const chats = loadChats()
  const next = chats.filter((c) => c.id !== chatId)
  if (next.length === chats.length) return false
  saveChats(next)
  saveMessages(loadMessages().filter((m) => m.chatId !== chatId))
  return true
}

export function deleteChatsForProject(projectId: string): void {
  const chats = loadChats()
  const removeIds = new Set(chats.filter((c) => c.projectId === projectId).map((c) => c.id))
  saveChats(chats.filter((c) => c.projectId !== projectId))
  saveMessages(loadMessages().filter((m) => !removeIds.has(m.chatId)))
}

export function addMessage(
  chatId: string,
  role: MessageRole,
  content: string,
  metadata?: Record<string, unknown>
): ChatMessage {
  const message: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    chatId,
    role,
    content: content.trim(),
    createdAt: new Date(),
    metadata,
  }
  saveMessages([...loadMessages(), message])
  touchChat(chatId)
  return message
}

export function getLatestMessagePreview(chatId: string): string | undefined {
  const msgs = getMessagesByChat(chatId)
  const last = msgs[msgs.length - 1]
  return last?.content
}
