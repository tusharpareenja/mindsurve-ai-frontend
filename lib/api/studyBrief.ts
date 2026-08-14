"use client"

import { api, getAccessToken } from "@/lib/api/client"
import { API_BASE_URL } from "@/lib/api/config"
import { mapMessage, type MessageDto } from "@/lib/api/chats"
import type { ChatMessage } from "@/types"
import type {
  AttachmentBrief,
  BriefPhase,
  BriefVersionList,
  BriefVersionMeta,
  StudyBrief,
  StudyBriefOut,
} from "@/types/study-brief"

export type AiTurnDto = {
  user_message?: MessageDto | null
  assistant_message: MessageDto
  phase: BriefPhase
  study_brief: StudyBrief
  suggested_chat_title?: string | null
  continued?: boolean
  version?: BriefVersionMeta | null
  changed_fields?: string[]
}

export type UploadDto = {
  url: string
  filename: string
  content_type: string
  size_bytes: number
  category?: string | null
  relative_path?: string | null
  extracted_text?: string | null
}

export type ConfirmDto = {
  study_id: string
  phase: BriefPhase
  study_brief: StudyBrief
  message: string
}

export const studyBriefApi = {
  get(chatId: string) {
    return api.get<StudyBriefOut>(`/chats/${chatId}/study-brief`)
  },
  update(chatId: string, patch: Partial<StudyBrief>) {
    return api.patch<StudyBriefOut>(`/chats/${chatId}/study-brief`, patch)
  },
  async streamThoughts(
    chatId: string,
    content: string,
    attachments: AttachmentBrief[] = [],
    onText: (full: string) => void,
    signal?: AbortSignal
  ) {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    }
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await fetch(
      `${API_BASE_URL}/chats/${chatId}/ai-think-stream`,
      {
        method: "POST",
        credentials: "include",
        headers,
        signal,
        body: JSON.stringify({
          content,
          attachments,
          attachment_urls: attachments.map((a) => a.url),
        }),
      }
    )
    if (!response.ok || !response.body) return

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let full = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""
      for (const part of parts) {
        const line = part
          .split("\n")
          .find((row) => row.startsWith("data:"))
        if (!line) continue
        try {
          const payload = JSON.parse(line.slice(5).trim()) as {
            text?: string
            done?: boolean
          }
          if (payload.text) {
            full += payload.text
            onText(full)
          }
        } catch {
          /* ignore a partial SSE frame */
        }
      }
    }
  },
  aiTurn(
    chatId: string,
    content: string,
    attachments: AttachmentBrief[] = []
  ) {
    return api.post<AiTurnDto>(`/chats/${chatId}/ai-turn`, {
      content,
      attachments,
      attachment_urls: attachments.map((a) => a.url),
    })
  },
  aiContinue(chatId: string) {
    return api.post<AiTurnDto | { continued: false }>(
      `/chats/${chatId}/ai-continue`
    )
  },
  confirm(chatId: string) {
    return api.post<ConfirmDto>(`/chats/${chatId}/study-brief/confirm`)
  },
  versions(chatId: string) {
    return api.get<BriefVersionList>(`/chats/${chatId}/study-brief/versions`)
  },
  restoreVersion(chatId: string, version: number) {
    return api.post<StudyBriefOut>(
      `/chats/${chatId}/study-brief/versions/${version}/restore`
    )
  },
  upload(
    chatId: string,
    file: File,
    meta?: { category?: string; relativePath?: string }
  ) {
    const form = new FormData()
    form.append("file", file)
    if (meta?.category) form.append("category", meta.category)
    if (meta?.relativePath) form.append("relative_path", meta.relativePath)
    return api.upload<UploadDto>(`/chats/${chatId}/uploads`, form)
  },
}

export function mapAiTurn(dto: AiTurnDto): {
  userMessage: ChatMessage | null
  assistantMessage: ChatMessage
  phase: BriefPhase
  studyBrief: StudyBrief
  suggestedChatTitle?: string | null
} {
  return {
    userMessage: dto.user_message ? mapMessage(dto.user_message) : null,
    assistantMessage: mapMessage(dto.assistant_message),
    phase: dto.phase,
    studyBrief: dto.study_brief,
    suggestedChatTitle: dto.suggested_chat_title,
  }
}
