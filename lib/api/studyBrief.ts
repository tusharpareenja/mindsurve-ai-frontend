"use client"

import { api } from "@/lib/api/client"
import { mapMessage, type MessageDto } from "@/lib/api/chats"
import type { ChatMessage } from "@/types"
import type {
  AttachmentBrief,
  BriefPhase,
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
