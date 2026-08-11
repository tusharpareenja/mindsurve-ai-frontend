export type MindGenomicStudyType = "grid" | "text"

export type BriefPhase = "gathering" | "brief_ready" | "creating" | "created"

export type RatingScaleBrief = {
  min_value: number
  max_value: number
  min_label: string
  max_label: string
  middle_label: string
}

export type ElementBrief = {
  name: string
  element_type: "image" | "text"
  content: string
  description: string
}

export type CategoryBrief = {
  name: string
  elements: ElementBrief[]
}

export type ClassificationQuestionBrief = {
  question_text: string
  is_required: boolean
  options: string[]
}

export type AttachmentBrief = {
  url: string
  filename: string
  content_type: string
  size_bytes?: number | null
  category?: string | null
  relative_path?: string | null
}

export type StudyBrief = {
  title: string
  background: string
  language: string
  study_type: MindGenomicStudyType | null
  main_question: string
  orientation_text: string
  rating_scale: RatingScaleBrief
  categories: CategoryBrief[]
  classification_questions: ClassificationQuestionBrief[]
  attachments: AttachmentBrief[]
  status: "gathering" | "ready" | "confirmed" | "created"
  study_id: string | null
  missing_fields: string[]
}

export type StudyBriefOut = {
  phase: BriefPhase
  study_brief: StudyBrief
}
