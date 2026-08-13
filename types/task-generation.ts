/** Study task-generation run types (MindSurve orchestration over Unilever jobs). */

export type GenerationStatus =
  | "queued"
  | "generating"
  | "saving"
  | "ready"
  | "failed"
  | "cancelled"
  | "launched"

export type GenerationRun = {
  id: string
  chat_id: string
  project_id: string
  study_id: string
  upstream_job_id: string | null
  revision: number
  status: GenerationStatus
  progress: number
  message: string
  error: string | null
  fingerprint: string
  preview_url: string | null
  share_url: string | null
  study_status: string
  websocket_url: string | null
  research_tip: string | null
  retryable: boolean
  created_at: string
  updated_at: string
  completed_at: string | null
  launched_at: string | null
}

export type GenerationStartResponse = {
  run: GenerationRun
  resumed: boolean
}

export type GenerationLaunchResponse = {
  run: GenerationRun
  share_url: string
  message: string
}

export type BriefChangePreview = {
  requires_regeneration: boolean
  changed_fields: string[]
  message: string
}

export type JobWsEvent =
  | { type: "progress"; progress: number; message?: string }
  | { type: "completed"; progress?: number; message?: string }
  | { type: "failed"; error?: string; message?: string }
  | { type: "ping" }
  | { type: "unknown"; raw: unknown }

export type GenerationStepId =
  | "queued"
  | "matrix"
  | "combinations"
  | "validating"
  | "saving"
  | "ready"

export type GenerationStepStatus = "pending" | "active" | "completed"

export type GenerationStep = {
  id: GenerationStepId
  label: string
  description: string
  status: GenerationStepStatus
}
