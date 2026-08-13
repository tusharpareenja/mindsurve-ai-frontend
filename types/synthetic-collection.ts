/** Synthetic respondent collection (MindSurve orchestration over Unilever jobs). */

export type SyntheticMode = "ai" | "randomize"

export type SyntheticStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type ResponseStats = {
  total: number
  inProgress: number
  completed: number
  abandoned: number
  completionRate: number
  avgDurationSeconds: number
}

export type SyntheticCollectionRun = {
  id: string
  chat_id: string
  project_id: string
  study_id: string
  upstream_job_id: string | null
  mode: SyntheticMode
  status: SyntheticStatus
  progress: number
  message: string
  error: string | null
  respondents_requested: number
  respondents_completed: number
  stats: {
    total: number
    in_progress: number
    completed: number
    abandoned: number
    completion_rate: number
    avg_duration_seconds: number
  }
  websocket_url: string | null
  retryable: boolean
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type SyntheticCollectionStartResponse = {
  run: SyntheticCollectionRun
  resumed: boolean
}

export function mapResponseStats(
  stats: SyntheticCollectionRun["stats"] | null | undefined
): ResponseStats {
  return {
    total: stats?.total ?? 0,
    inProgress: stats?.in_progress ?? 0,
    completed: stats?.completed ?? 0,
    abandoned: stats?.abandoned ?? 0,
    completionRate: stats?.completion_rate ?? 0,
    avgDurationSeconds: stats?.avg_duration_seconds ?? 0,
  }
}

export function formatAvgDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s.toString().padStart(2, "0")}s`
}
