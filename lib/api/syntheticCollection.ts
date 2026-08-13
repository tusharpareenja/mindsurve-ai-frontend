"use client"

import { api } from "@/lib/api/client"
import type {
  SyntheticCollectionRun,
  SyntheticCollectionStartResponse,
  SyntheticMode,
} from "@/types/synthetic-collection"

export type SyntheticStartBody = {
  mode?: SyntheticMode
  randomize?: boolean
}

export const syntheticCollectionApi = {
  start(chatId: string, body: SyntheticStartBody = {}) {
    return api.post<SyntheticCollectionStartResponse>(
      `/chats/${chatId}/synthetic-collection/start`,
      body
    )
  },
  status(chatId: string, runId?: string) {
    const qs = runId ? `?run_id=${encodeURIComponent(runId)}` : ""
    return api.get<SyntheticCollectionRun>(
      `/chats/${chatId}/synthetic-collection${qs}`
    )
  },
  retry(chatId: string, body: SyntheticStartBody = {}) {
    return api.post<SyntheticCollectionStartResponse>(
      `/chats/${chatId}/synthetic-collection/retry`,
      body
    )
  },
}
