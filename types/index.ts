export type WorkflowType = "beginner"

export type ProjectStatus =
  | "CREATED"
  | "PROCESSING_INPUT"
  | "PREPARING_STUDIES"
  | "AWAITING_REVIEW"
  | "STUDIES_BEING_PREPARED"
  | "STUDIES_LIVE"
  | "COLLECTING_RESPONSES"
  | "VALIDATING_RESPONSES"
  | "ANALYZING_DATA"
  | "GENERATING_RESULTS"
  | "RESULTS_READY"
  | "GENERATING_WEBSITE"
  | "DEPLOYING_WEBSITE"
  | "SETTING_UP_ADS"
  | "SETTING_UP_CRM"
  | "CONFIGURING_EMAILS"
  | "GENERATING_DELIVERABLES"
  | "DELIVERABLE_READY"
  | "COMPLETED"

export type User = {
  id: string
  name: string
  email: string
  avatarUrl?: string
  plan?: "free" | "pro"
}

export type Project = {
  id: string
  title: string
  description: string
  idea?: string
  workflowType: WorkflowType
  status: ProjectStatus
  createdAt: Date
  updatedAt?: Date
}

export type MessageRole = "user" | "assistant" | "system"

/** Conversation thread inside a Project — not the business/research container. */
export type Chat = {
  id: string
  projectId: string
  title: string
  createdAt: Date
  updatedAt: Date
}

export type ChatMessage = {
  id: string
  chatId: string
  role: MessageRole
  content: string
  createdAt: Date
  metadata?: Record<string, unknown>
}

export type StudyType = "logo_visual" | "text_mindgenomic"

export type StudyStatus = "preparing" | "in_review" | "live" | "completed"

export type Study = {
  id: string
  projectId: string
  type: StudyType
  title: string
  status: StudyStatus
  previewUrl?: string
  requiredRespondents?: number
  completedRespondents?: number
}

export type RespondentStats = {
  studyId: string
  required: number
  completed: number
  valid: number
  underValidation: number
  failed: number
}

export type ActivityEventStatus = "completed" | "active" | "pending" | "warning" | "error"

export type ActivityEvent = {
  id: string
  projectId: string
  event: string
  label: string
  status: ActivityEventStatus
  timestamp: string
  detail?: string
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "retrying"

export type Job = {
  id: string
  projectId: string
  type: string
  status: JobStatus
  progress: number
  startedAt?: string
  completedAt?: string
  error?: string
  retryCount?: number
}

export type DeliverableType = "report" | "website" | "crm" | "advertising"

export type Deliverable = {
  id: string
  projectId: string
  type: DeliverableType
  status: "pending" | "generating" | "ready" | "failed"
  url?: string
  meta?: Record<string, string>
}

export type AppNotification = {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string
  projectId?: string
  href?: string
}
