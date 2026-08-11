"use client"

import { api } from "@/lib/api/client"
import type { Chat, ChatMessage, MessageRole } from "@/types"

export type ChatDto = {
  id: string
  project_id: string
  title: string
  created_at: string
  updated_at: string
  last_message_preview?: string | null
}

export type MessageDto = {
  id: string
  chat_id: string
  role: MessageRole
  content: string
  created_at: string
  metadata?: Record<string, unknown> | null
}

export type ChatStartDto = {
  chat: ChatDto
  message: MessageDto
}

export type MessagePageDto = {
  items: MessageDto[]
  has_more: boolean
  next_before?: string | null
}

export function mapChat(dto: ChatDto): Chat {
  return {
    id: dto.id,
    projectId: dto.project_id,
    title: dto.title,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  }
}

export function mapMessage(dto: MessageDto): ChatMessage {
  return {
    id: dto.id,
    chatId: dto.chat_id,
    role: dto.role,
    content: dto.content,
    createdAt: new Date(dto.created_at),
    metadata: dto.metadata ?? undefined,
  }
}

export const chatsApi = {
  listAll() {
    return api.get<ChatDto[]>("/chats")
  },
  listForProject(projectId: string) {
    return api.get<ChatDto[]>(`/projects/${projectId}/chats`)
  },
  create(projectId: string, title?: string) {
    return api.post<ChatDto>(`/projects/${projectId}/chats`, title ? { title } : {})
  },
  start(projectId: string, content: string) {
    return api.post<ChatStartDto>(`/projects/${projectId}/chats/start`, { content })
  },
  get(chatId: string) {
    return api.get<ChatDto>(`/chats/${chatId}`)
  },
  rename(chatId: string, title: string) {
    return api.patch<ChatDto>(`/chats/${chatId}`, { title })
  },
  delete(chatId: string) {
    return api.delete<{ message: string }>(`/chats/${chatId}`)
  },
  listMessages(chatId: string, before?: string, limit = 40) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (before) params.set("before", before)
    return api.get<MessagePageDto>(
      `/chats/${chatId}/messages?${params.toString()}`
    )
  },
  addMessage(
    chatId: string,
    input: { content: string; role?: MessageRole; metadata?: Record<string, unknown> }
  ) {
    return api.post<MessageDto>(`/chats/${chatId}/messages`, input)
  },
}
