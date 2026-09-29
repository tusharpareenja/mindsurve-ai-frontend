import type { DesignCategoryPayload, SavedDesignPayload, SavedDesignType } from "@/lib/api/StudyAPI"
import { createLocalDesignId } from "@/lib/export/savedDesignLocalStorage"

const STORAGE_PREFIX = "designConfiguratorCategories:"

function readCategories(studyId: string): DesignCategoryPayload[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${studyId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeCategories(studyId: string, categories: DesignCategoryPayload[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${studyId}`, JSON.stringify(categories))
  } catch (error) {
    console.warn("Could not persist design categories", error)
  }
}

export function listLocalDesignCategories(studyId: string): DesignCategoryPayload[] {
  return readCategories(studyId)
}

export function renameDesignInLocalCategories(studyId: string, savedDesignId: string, name: string) {
  const next = readCategories(studyId).map((category) => ({
    ...category,
    items: category.items.map((item) => (
      item.saved_design_id === savedDesignId ? { ...item, name } : item
    )),
  }))
  writeCategories(studyId, next)
}

export function removeDesignFromLocalCategories(studyId: string, savedDesignId: string) {
  const next = readCategories(studyId).map((category) => ({
    ...category,
    items: category.items.filter((item) => item.saved_design_id !== savedDesignId),
  }))
  writeCategories(studyId, next)
}

function itemFromDesign(design: SavedDesignPayload, position: number) {
  return {
    id: createLocalDesignId(),
    saved_design_id: design.id,
    name: design.name,
    design_type: design.design_type || "configurator",
    metric: design.metric ?? design.configuration?.metric ?? "Top Down",
    segment_label: design.segment_label ?? design.configuration?.segment?.label ?? null,
    selection_count: design.selection_count ?? 0,
    total_coefficient: design.total_coefficient ?? design.configuration?.total_coefficient ?? null,
    position,
    configuration: design.configuration,
  }
}

export function assignLocalDesignCategory(input: {
  studyId: string
  categoryId?: string
  categoryName?: string
  designs: SavedDesignPayload[]
}): DesignCategoryPayload {
  const categories = readCategories(input.studyId)
  const now = new Date().toISOString()
  let category = input.categoryId
    ? categories.find((item) => item.id === input.categoryId)
    : undefined

  if (!category && input.categoryName) {
    const normalized = input.categoryName.trim().toLowerCase()
    category = categories.find((item) => item.name.trim().toLowerCase() === normalized)
  }

  if (!category) {
    const name = input.categoryName?.trim()
    if (!name) throw new Error("Category name is required")
    const position = categories.reduce((max, item) => Math.max(max, item.position), -1) + 1
    category = {
      id: createLocalDesignId(),
      study_id: input.studyId,
      name,
      position,
      created_at: now,
      updated_at: now,
      items: [],
    }
    categories.push(category)
  }

  const present = new Set(category.items.map((item) => item.saved_design_id))
  let position = category.items.reduce((max, item) => Math.max(max, item.position), 0)
  input.designs.forEach((design) => {
    if (present.has(design.id)) return
    position += 1
    category?.items.push(itemFromDesign(design, position))
    present.add(design.id)
  })
  category.updated_at = now
  writeCategories(input.studyId, categories)
  return category
}

export function renameLocalDesignCategory(studyId: string, categoryId: string, name: string): DesignCategoryPayload {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Category name is required")
  const categories = readCategories(studyId)
  const category = categories.find((item) => item.id === categoryId)
  if (!category) throw new Error("Category not found.")
  const normalized = trimmed.toLowerCase()
  if (categories.some((item) => item.id !== categoryId && item.name.trim().toLowerCase() === normalized)) {
    throw new Error("A category with this name already exists.")
  }
  category.name = trimmed
  category.updated_at = new Date().toISOString()
  writeCategories(studyId, categories)
  return category
}

export function deleteLocalDesignCategory(studyId: string, categoryId: string) {
  writeCategories(
    studyId,
    readCategories(studyId).filter((category) => category.id !== categoryId)
  )
}

export function removeLocalDesignCategoryItem(studyId: string, categoryId: string, savedDesignId: string) {
  const categories = readCategories(studyId).map((category) =>
    category.id === categoryId
      ? { ...category, items: category.items.filter((item) => item.saved_design_id !== savedDesignId) }
      : category
  )
  writeCategories(studyId, categories)
}

export function findLocalSavedDesign(
  lists: Record<"configurator" | "input", SavedDesignPayload[]>,
  designId: string
): SavedDesignPayload | undefined {
  return lists.configurator.find((design) => design.id === designId) || lists.input.find((design) => design.id === designId)
}
