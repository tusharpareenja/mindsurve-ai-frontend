export type MindGenomicStudyType = "grid" | "text"

export type BriefPhase = "gathering" | "brief_ready" | "creating" | "created"

export type RatingScaleBrief = {
  min_value: number
  max_value: number
  min_label: string
  max_label: string
  middle_label: string
}

export const MAX_STATEMENT_CHARS = 150
export const MIN_TEXT_CATEGORIES = 3
export const MAX_TEXT_CATEGORIES = 20
export const MIN_TEXT_STATEMENTS = 3
export const MAX_TEXT_STATEMENTS = 20

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
  extracted_text?: string | null
}

export const AGE_SEGMENTS = [
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const

export type AgeSegment = (typeof AGE_SEGMENTS)[number]

export type AudienceBrief = {
  number_of_respondents: number | null
  age_segments: string[]
  age_distribution: Record<string, number>
  countries: string[]
  gender_male: number
  gender_female: number
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
  audience: AudienceBrief
  attachments: AttachmentBrief[]
  status: "gathering" | "ready" | "confirmed" | "created"
  study_id: string | null
  missing_fields: string[]
}

export type StudyBriefOut = {
  phase: BriefPhase
  study_brief: StudyBrief
}
