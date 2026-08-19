"use client"

import { api, getAccessToken } from "@/lib/api/client"
import { API_BASE_URL } from "@/lib/api/config"
import { mapMessage, type MessageDto } from "@/lib/api/chats"
import { ApiError } from "@/lib/api/types"
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
  is_background?: boolean | null
  layer_order?: number | null
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
  /** Save user message + attachments without waiting for OpenAI (fast navigate). */
  stageTurn(
    chatId: string,
    content: string,
    attachments: AttachmentBrief[] = []
  ) {
    return api.post<{
      user_message: MessageDto
      phase: BriefPhase
      study_brief: StudyBrief
      staged: boolean
    }>(`/chats/${chatId}/ai-stage`, {
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
    meta?: {
      category?: string
      relativePath?: string
      isBackground?: boolean
      layerOrder?: number
    }
  ) {
    return uploadViaDirectBlob(chatId, file, meta)
  },
}

/** Vercel serverless body limit is ~4.5MB — upload bytes straight to Azure via SAS. */
const MULTIPART_FALLBACK_MAX = 4 * 1024 * 1024

type UploadIntentDto = {
  upload_url: string
  url: string
  blob_name: string
  filename: string
  content_type: string
  size_bytes: number
  required_headers: Record<string, string>
  category?: string | null
  relative_path?: string | null
  is_background?: boolean
  layer_order?: number | null
}

async function uploadViaMultipart(
  chatId: string,
  file: File,
  meta?: {
    category?: string
    relativePath?: string
    isBackground?: boolean
    layerOrder?: number
  }
): Promise<UploadDto> {
  const form = new FormData()
  form.append("file", file)
  if (meta?.category) form.append("category", meta.category)
  if (meta?.relativePath) form.append("relative_path", meta.relativePath)
  if (meta?.isBackground) form.append("is_background", "true")
  if (typeof meta?.layerOrder === "number") {
    form.append("layer_order", String(meta.layerOrder))
  }
  return api.upload<UploadDto>(`/chats/${chatId}/uploads`, form)
}

async function uploadViaDirectBlob(
  chatId: string,
  file: File,
  meta?: {
    category?: string
    relativePath?: string
    isBackground?: boolean
    layerOrder?: number
  }
): Promise<UploadDto> {
  try {
    const intent = await api.post<UploadIntentDto>(
      `/chats/${chatId}/uploads/intent`,
      {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        category: meta?.category ?? null,
        relative_path: meta?.relativePath ?? null,
        is_background: meta?.isBackground ?? false,
        layer_order:
          typeof meta?.layerOrder === "number" ? meta.layerOrder : null,
      }
    )

    const headers: Record<string, string> = {
      ...(intent.required_headers || {}),
    }
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = intent.content_type || file.type || "application/octet-stream"
    }
    if (!headers["x-ms-blob-type"]) {
      headers["x-ms-blob-type"] = "BlockBlob"
    }

    const put = await fetch(intent.upload_url, {
      method: "PUT",
      headers,
      body: file,
    })
    if (!put.ok) {
      const detail = await put.text().catch(() => "")
      throw new Error(
        `Direct upload failed (${put.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`
      )
    }

    return api.post<UploadDto>(`/chats/${chatId}/uploads/complete`, {
      blob_name: intent.blob_name,
      url: intent.url,
      filename: intent.filename || file.name,
      content_type: intent.content_type,
      size_bytes: intent.size_bytes || file.size,
      category: intent.category ?? meta?.category ?? null,
      relative_path: intent.relative_path ?? meta?.relativePath ?? null,
      is_background: intent.is_background ?? meta?.isBackground ?? false,
      layer_order:
        intent.layer_order ??
        (typeof meta?.layerOrder === "number" ? meta.layerOrder : null),
    })
  } catch (err) {
    // Small files can still go through the Next proxy if SAS/CORS isn't ready.
    if (file.size <= MULTIPART_FALLBACK_MAX) {
      try {
        return await uploadViaMultipart(chatId, file, meta)
      } catch {
        /* surface the original error below */
      }
    }
    if (err instanceof ApiError) throw err
    throw new ApiError(
      err instanceof Error
        ? err.message
        : "We couldn’t upload your file. Please try again.",
      502
    )
  }
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
