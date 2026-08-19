export type MindGenomicStudyType = "grid" | "text" | "layer"

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
export const MIN_LAYER_LAYERS = 3
export const MAX_LAYER_LAYERS = 15
export const MIN_LAYER_ELEMENTS = 3
export const MAX_LAYER_ELEMENTS = 30

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

export type LayerTransformBrief = {
  x: number
  y: number
  width: number
  height: number
}

export type LayerElementBrief = {
  name: string
  content: string
  order: number
  transform: LayerTransformBrief
}

export type LayerBrief = {
  name: string
  z_index: number
  order: number
  elements: LayerElementBrief[]
  transform: LayerTransformBrief
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
  is_background?: boolean | null
  layer_order?: number | null
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
  layers: LayerBrief[]
  background_image_url: string | null
  classification_questions: ClassificationQuestionBrief[]
  audience: AudienceBrief
  attachments: AttachmentBrief[]
  status: "gathering" | "ready" | "confirmed" | "created"
  study_id: string | null
  missing_fields: string[]
}

export type BriefVersionMeta = {
  version: number
  total: number
  summary?: string
  source?: string
  changed_fields?: string[]
  created_at?: string | null
}

export type BriefVersion = {
  version: number
  summary: string
  source: string
  changed_fields: string[]
  created_at: string
  study_brief: StudyBrief
}

export type BriefVersionList = {
  current_version: number
  total: number
  versions: BriefVersion[]
}

export type StudyBriefOut = {
  phase: BriefPhase
  study_brief: StudyBrief
  version?: BriefVersionMeta | null
}
