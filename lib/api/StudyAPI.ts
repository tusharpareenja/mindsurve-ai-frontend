/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Slim StudyAPI surface used by MindSurve analytics (ported from Unilever).
 * Auth uses shared JWT against the Unilever study engine.
 */
import { API_BASE_URL } from "@/lib/api/LoginApi"
import { fetchWithAuth } from "@/lib/analytics/unileverFetch"

export { fetchWithAuth }

export type StudyType = "grid" | "layer" | "text" | "hybrid"

export type SavedDesignType = "configurator" | "input" | "layer"

export type DesignMetric = "Top Down" | "Bottom Up" | "Response Time"

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
  study_type?: StudyType
  metric?: DesignMetric | string
  segment_label?: string | null
  selection_count?: number
  total_coefficient?: number | null
  configuration?: SavedDesignConfigurationPayload
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export interface DesignCategoryItemPayload {
  id: string
  saved_design_id: string
  name: string
  design_type: SavedDesignType
  study_type?: StudyType
  metric: DesignMetric | string
  segment_label?: string | null
  selection_count: number
  total_coefficient?: number | null
  position: number
  configuration?: SavedDesignConfigurationPayload
}

export interface DesignCategoryPayload {
  id: string
  study_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
  items: DesignCategoryItemPayload[]
}

export interface DesignCategoryAssignPayload {
  category_id?: string
  category_name?: string
  saved_design_ids?: string[]
  design?: {
    name: string
    design_type: SavedDesignType
    configuration: SavedDesignConfigurationPayload
  }
}

export interface DesignCategoryAssignResult {
  category: DesignCategoryPayload
  created_design?: SavedDesignPayload | null
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

async function readStudyJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await parseJson(res)
  if (!res.ok) {
    const detail = data && (data.detail || data.message)
    const msg = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((item: { msg?: string }) => item?.msg || item).filter(Boolean).join(" ")
        : fallback
    throw Object.assign(new Error(msg || fallback), { status: res.status, data })
  }
  return data as T
}

export async function getSavedDesign(studyId: string, designId: string): Promise<SavedDesignPayload> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/saved-designs/${designId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  return readStudyJson<SavedDesignPayload>(res, `Failed to load saved design (${res.status})`)
}

export async function listDesignCategories(studyId: string): Promise<DesignCategoryPayload[]> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/design-categories`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  if (res.status === 204) return []
  return readStudyJson<DesignCategoryPayload[]>(res, `Failed to load categories (${res.status})`)
}

const PPTX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

function filenameFromDisposition(disposition: string, fallback: string): string {
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition)
  return plain?.[1]?.trim() || fallback
}

function messageFromDetail(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail.trim()
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item.trim()
        if (item && typeof item === "object" && "msg" in item) return String((item as { msg?: unknown }).msg || "").trim()
        return ""
      })
      .filter(Boolean)
    if (parts.length) return parts.join(" ")
  }
  return ""
}

/** Download the combination readout for one report-builder category. */
export async function downloadDesignCategoryPpt(
  studyId: string,
  categoryId: string,
  analysis?: unknown,
): Promise<{ blob: Blob; filename: string }> {
  const cleanId = normalizeStudyId(studyId)
  const cleanCategory = String(categoryId || "").trim()
  if (!cleanId || !cleanCategory) throw new Error("A saved category is required")

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 180_000)
  let res: Response
  try {
    res = await fetchWithAuth(
      `${API_BASE_URL}/studies/${cleanId}/design-categories/${encodeURIComponent(cleanCategory)}/export-ppt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: PPTX_MEDIA_TYPE },
        body: JSON.stringify({ analysis: analysis ?? null }),
        signal: controller.signal,
      },
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The report is taking longer than expected. Please try again.")
    }
    if (error instanceof TypeError) {
      throw new Error("The download could not reach the server. Check your connection and try again.")
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }

  if (res.status === 204) {
    throw new Error("Your session expired. Sign in and try the download again.")
  }
  if (!res.ok) {
    let message = res.status === 404
      ? "This category could not be found. Refresh the report builder and try again."
      : `Failed to download this report (${res.status})`
    const text = await res.text().catch(() => "")
    if (text) {
      try {
        const parsed = messageFromDetail(JSON.parse(text)?.detail)
        if (parsed) message = parsed
      } catch {
        const trimmed = text.trim()
        if (trimmed && trimmed.length < 400 && !trimmed.startsWith("<")) message = trimmed
      }
    }
    throw Object.assign(new Error(message), { status: res.status })
  }
  const blob = await res.blob()
  if (!blob || blob.size === 0) throw new Error("The generated report was empty. Please try again.")
  const contentType = (blob.type || res.headers.get("Content-Type") || "").toLowerCase()
  if (contentType.includes("json") || contentType.startsWith("text/")) {
    throw new Error("The server did not return a PowerPoint file. Please try again.")
  }
  return {
    blob,
    filename: filenameFromDisposition(res.headers.get("Content-Disposition") || "", "Combination Readout.pptx"),
  }
}

export async function assignDesignCategory(
  studyId: string,
  payload: DesignCategoryAssignPayload
): Promise<DesignCategoryAssignResult> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/design-categories/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return readStudyJson<DesignCategoryAssignResult>(res, `Failed to add to category (${res.status})`)
}

export async function renameDesignCategory(
  studyId: string,
  categoryId: string,
  name: string
): Promise<DesignCategoryPayload> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/design-categories/${categoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  return readStudyJson<DesignCategoryPayload>(res, `Failed to rename category (${res.status})`)
}

export async function deleteDesignCategory(studyId: string, categoryId: string): Promise<void> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/design-categories/${categoryId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  })
  if (res.ok || res.status === 204) return
  await readStudyJson(res, `Failed to delete category (${res.status})`)
}

export async function removeDesignCategoryItem(
  studyId: string,
  categoryId: string,
  savedDesignId: string
): Promise<void> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(
    `${API_BASE_URL}/studies/${cleanId}/design-categories/${categoryId}/items/${savedDesignId}`,
    { method: "DELETE", headers: { "Content-Type": "application/json" } }
  )
  if (res.ok || res.status === 204) return
  await readStudyJson(res, `Failed to remove combination (${res.status})`)
}

export async function renameSavedDesign(
  studyId: string,
  designId: string,
  name: string
): Promise<SavedDesignPayload> {
  const cleanId = normalizeStudyId(studyId)
  const res = await fetchWithAuth(`${API_BASE_URL}/studies/${cleanId}/saved-designs/${designId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  return readStudyJson<SavedDesignPayload>(res, `Failed to rename saved design (${res.status})`)
}
