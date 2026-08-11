/**
 * Mock study-generation job state per chat.
 * TODO(api): replace with real study/job service + websockets.
 */

export type StudyGenPhase =
  | "idle"
  | "generating"
  | "ready"
  | "live"

export type StudyGenStepId =
  | "preparing_study"
  | "study_review"
  | "study_being_prepared"
  | "study_ready"

export type StudyGenStepStatus = "pending" | "active" | "completed"

export type StudyGenStep = {
  id: StudyGenStepId
  label: string
  description?: string
  status: StudyGenStepStatus
}

export type LaunchMode = "go_live" | "cint"

export type ResponseStats = {
  total: number
  inProgress: number
  completed: number
  abandoned: number
  completionRate: number
  avgDurationSeconds: number
}

export type StudyGenerationJob = {
  chatId: string
  projectId: string
  title: string
  phase: StudyGenPhase
  steps: StudyGenStep[]
  launchMode?: LaunchMode
  stats?: ResponseStats
  startedAt?: string
  readyAt?: string
  liveAt?: string
}

const STORAGE_KEY = "mindsurve_mock_study_jobs"

export const STUDY_STEP_DEFS: Omit<StudyGenStep, "status">[] = [
  {
    id: "preparing_study",
    label: "Preparing Study",
    description:
      "(1) Reviewing your conversation and project context to draft study structure. (2) Identifying vignettes, categories, and research questions for a MindGenomic study.",
  },
  {
    id: "study_review",
    label: "Study Review",
    description:
      "Our research team is reviewing the study design, elements, and logic before preparation continues.",
  },
  {
    id: "study_being_prepared",
    label: "Study Being Prepared",
    description:
      "Preparing study elements, validating the research design, and getting everything ready to launch.",
  },
  {
    id: "study_ready",
    label: "Study Ready",
    description: "Your study is prepared and ready for launch.",
  },
]

export function initialSteps(): StudyGenStep[] {
  return STUDY_STEP_DEFS.map((s, i) => ({
    ...s,
    status: i === 0 ? "active" : "pending",
  }))
}

export function loadJobs(): Record<string, StudyGenerationJob> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, StudyGenerationJob>) : {}
  } catch {
    return {}
  }
}

export function saveJobs(jobs: Record<string, StudyGenerationJob>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
}

export function getJob(chatId: string): StudyGenerationJob | null {
  return loadJobs()[chatId] ?? null
}

export function upsertJob(job: StudyGenerationJob): StudyGenerationJob {
  const jobs = loadJobs()
  jobs[job.chatId] = job
  saveJobs(jobs)
  return job
}

export function createJob(
  chatId: string,
  projectId: string,
  title: string
): StudyGenerationJob {
  const job: StudyGenerationJob = {
    chatId,
    projectId,
    title,
    phase: "generating",
    steps: initialSteps(),
    startedAt: new Date().toISOString(),
  }
  return upsertJob(job)
}

export function advanceStep(job: StudyGenerationJob): StudyGenerationJob {
  const activeIndex = job.steps.findIndex((s) => s.status === "active")
  if (activeIndex === -1) return job

  const steps = job.steps.map((s, i) => {
    if (i < activeIndex) return { ...s, status: "completed" as const }
    if (i === activeIndex) return { ...s, status: "completed" as const }
    if (i === activeIndex + 1) return { ...s, status: "active" as const }
    return s
  })

  const allDone = steps.every((s) => s.status === "completed")
  return upsertJob({
    ...job,
    steps,
    phase: allDone ? "ready" : "generating",
    readyAt: allDone ? new Date().toISOString() : job.readyAt,
  })
}

export function launchJob(
  job: StudyGenerationJob,
  mode: LaunchMode
): StudyGenerationJob {
  return upsertJob({
    ...job,
    phase: "live",
    launchMode: mode,
    liveAt: new Date().toISOString(),
    // Seed with reference-style mock values, then tick upward
    stats: {
      total: 10,
      inProgress: 5,
      completed: 5,
      abandoned: 0,
      completionRate: 50.0,
      avgDurationSeconds: 22,
    },
  })
}

export function updateStats(
  job: StudyGenerationJob,
  stats: ResponseStats
): StudyGenerationJob {
  return upsertJob({ ...job, stats })
}

export function formatAvgDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

/** Mock: conversation is ready for study after enough user turns / intent. */
export function shouldAutoStartStudy(
  userMessageCount: number,
  lastUserMessage: string,
  existingJob: StudyGenerationJob | null
): boolean {
  if (existingJob && existingJob.phase !== "idle") return false
  const text = lastUserMessage.toLowerCase()
  const intent =
    /\b(study|research|logo|brand|survey|respondents|mindgenomic|test)\b/.test(
      text
    )
  return userMessageCount >= 2 || (userMessageCount >= 1 && intent)
}

export const PHASE_STATUS_COPY: Record<StudyGenStepId, string> = {
  preparing_study: "Preparing your study…",
  study_review: "Research team is reviewing the study…",
  study_being_prepared: "Preparing study elements…",
  study_ready: "Your study is ready",
}
