/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Slim StudyAPI surface used by MindSurve analytics (ported from Unilever).
 * Auth uses shared JWT against the Unilever study engine.
 */
import { API_BASE_URL } from "@/lib/api/LoginApi"
import { fetchWithAuth } from "@/lib/analytics/unileverFetch"

export { fetchWithAuth }

export type StudyType = "grid" | "layer" | "text" | "hybrid"

export type SavedDesignType = "configurator" | "layer" | string

export interface AnswerOptionPayload {
  option_id?: string
  id?: string
  option_text?: string
  text?: string
  order?: number
}

export interface ClassificationQuestionPayload {
  question_id?: string
  id?: string
  question_text?: string
  question_type?: string
  is_required?: boolean
  order?: number
  options?: Array<{ option_id?: string; option_text?: string; order?: number }>
  answer_options?: AnswerOptionPayload[]
  config?: Record<string, any>
  optional_classification_question?: boolean
}

export interface ElementPayload {
  element_id: string
  name: string
  description: string
  element_type: "image" | "text"
  content: string
  alt_text: string
  category_id: string
}

export interface StudyLayerPayload {
  layer_id: string
  name: string
  description: string
  z_index: number
  order: number
  images: string[]
  transform?: { x: number; y: number; width: number; height: number }
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface StudyDetails {
  id: string
  title: string
  background: string
  language: string
  main_question: string
  orientation_text: string
  study_type: StudyType
  background_image_url?: string | null
  aspect_ratio?: string
  last_step?: number
  phase_order?: ("grid" | "text" | "mix")[]
  rating_scale: {
    min_value: number
    max_value: number
    min_label: string
    max_label: string
    middle_label?: string
  }
  audience_segmentation: {
    number_of_respondents: number
    country?: string
    gender_distribution?: { male: number; female: number }
    age_distribution?: Record<string, number>
    aspect_ratio?: string
    screener_questions?: any[]
    quota_groups?: any[]
  }
  categories?: any[]
  elements: Array<ElementPayload & { id: string }>
  user_role?: string
  study_layers:
    | Array<
        StudyLayerPayload & {
          id: string
          images: Array<{
            image_id: string
            name: string
            url: string
            alt_text: string
            order: number
            id: string
          }>
        }
      >
    | null
  classification_questions?: Array<ClassificationQuestionPayload & { id: string }>
  tasks?: Record<string, any[]>
  creator_id?: string
  status?: "draft" | "active" | "paused" | "completed"
  share_token?: string
  share_url?: string
  created_at?: string
  updated_at?: string
  launched_at?: string | null
  completed_at?: string | null
  total_responses?: number
  completed_responses?: number
  abandoned_responses?: number
  toggle_shuffle?: boolean
  design_constraints?: Array<{
    id?: string
    name: string
    anchors: Array<{ layer_id: string; image_id: string }>
    blocked: Array<{ layer_id: string; image_id: string }>
    created_at?: number
  }>
}

export interface SavedDesignConfigurationPayload {
  [key: string]: any
}

export interface SavedDesignPayload {
  id: string
  name: string
  design_type?: SavedDesignType
  configuration?: SavedDesignConfigurationPayload
  created_at?: string
  updated_at?: string
  [key: string]: any
}

function normalizeStudyId(studyId: string): string {
  return String(studyId || "").trim()
}

async function parseJson(res: Response): Promise<any> {
  const text = await res.text().catch(() => "")
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { detail: text }
  }
}

/** Public basic endpoint (matches Unilever; no auth required). */
export async function getStudyBasicDetails(studyId: string): Promise<any> {
  const cleanId = normalizeStudyId(studyId)
  const response = await fetch(`${API_BASE_URL}/studies/${cleanId}/basic`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch study basic details: ${response.status}`)
  }
  return response.json()
}

export async function getStudyDetails(studyId: string): Promise<StudyDetails> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  const data = await parseJson(res)
  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      `Get study details failed (${res.status})`
    throw Object.assign(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)), {
      status: res.status,
      data,
    })
  }
  return data as StudyDetails
}

export async function listSavedDesigns(
  studyId: string,
  designType: SavedDesignType = "configurator"
): Promise<SavedDesignPayload[]> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(
    `${API_BASE_URL}/studies/${cleanId}/saved-designs?design_type=${encodeURIComponent(String(designType))}`,
    { method: "GET", headers: { "Content-Type": "application/json" } }
  )
  if (res.status === 204) return []
  const data = await parseJson(res)
  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      `Failed to load saved designs (${res.status})`
    throw Object.assign(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)), {
      status: res.status,
      data,
    })
  }
  return data as SavedDesignPayload[]
}

export async function createSavedDesign(
  studyId: string,
  name: string,
  configuration: SavedDesignConfigurationPayload,
  designType: SavedDesignType = "configurator"
): Promise<SavedDesignPayload> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/saved-designs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, design_type: designType, configuration }),
  })
  const data = await parseJson(res)
  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      `Failed to save design (${res.status})`
    throw Object.assign(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)), {
      status: res.status,
      data,
    })
  }
  return data as SavedDesignPayload
}

export async function compareSavedDesigns(
  studyId: string,
  designIds: string[],
  designType: SavedDesignType = "configurator"
): Promise<SavedDesignPayload[]> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(
    `${API_BASE_URL}/studies/${cleanId}/saved-designs/compare`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design_ids: designIds, design_type: designType }),
    }
  )
  const data = await parseJson(res)
  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      `Failed to compare saved designs (${res.status})`
    throw Object.assign(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)), {
      status: res.status,
      data,
    })
  }
  return data as SavedDesignPayload[]
}

export async function deleteSavedDesign(
  studyId: string,
  designId: string
): Promise<void> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(
    `${API_BASE_URL}/studies/${cleanId}/saved-designs/${designId}`,
    { method: "DELETE", headers: { "Content-Type": "application/json" } }
  )
  if (res.ok || res.status === 204) return
  const data = await parseJson(res)
  const msg =
    (data && (data.detail || data.message)) ||
    `Failed to delete saved design (${res.status})`
  throw Object.assign(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)), {
    status: res.status,
    data,
  })
}
