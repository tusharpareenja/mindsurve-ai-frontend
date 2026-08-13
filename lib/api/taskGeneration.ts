"use client"

import { api } from "@/lib/api/client"
import type { StudyBrief } from "@/types/study-brief"
import type {
  BriefChangePreview,
  GenerationLaunchResponse,
  GenerationRun,
  GenerationStartResponse,
} from "@/types/task-generation"

export type BriefRegenerateBody = Partial<StudyBrief> & {
  confirm_regeneration?: boolean
}

export const taskGenerationApi = {
  start(chatId: string) {
    return api.post<GenerationStartResponse>(
      `/chats/${chatId}/study-generation/start`
    )
  },
  status(chatId: string, runId?: string) {
    const qs = runId ? `?run_id=${encodeURIComponent(runId)}` : ""
    return api.get<GenerationRun>(`/chats/${chatId}/study-generation${qs}`)
  },
  retry(chatId: string) {
    return api.post<GenerationStartResponse>(
      `/chats/${chatId}/study-generation/retry`
    )
  },
  previewChanges(chatId: string, patch: Partial<StudyBrief>) {
    return api.post<BriefChangePreview>(
      `/chats/${chatId}/study-generation/preview-changes`,
      patch
    )
  },
  regenerate(chatId: string, body: BriefRegenerateBody) {
    return api.post<GenerationStartResponse>(
      `/chats/${chatId}/study-generation/regenerate`,
      body
    )
  },
  launch(chatId: string) {
    return api.post<GenerationLaunchResponse>(
      `/chats/${chatId}/study-generation/launch`
    )
  },
}
