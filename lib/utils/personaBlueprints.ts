/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Persona-specific product blueprints from analysis data.
 * One blueprint per persona (segment): what to use / avoid per study type.
 * Supports Top Down (T), Bottom Up (B), and Response Time (R).
 */

export type BlueprintMetric = "Top Down" | "Bottom Up" | "Response Time"

const METRIC_PREFIX: Record<BlueprintMetric, string> = {
  "Top Down": "(T)",
  "Bottom Up": "(B)",
  "Response Time": "(R)",
}

const SEGMENT_TAB_NAMES: Record<string, string> = {
  Age: "Age",
  Gender: "Gender",
  "Classification Questions": "Classification Questions",
  Mindsets: "Mindsets",
}

function getSectionKey(metric: BlueprintMetric, segmentType: string): string {
  const prefix = METRIC_PREFIX[metric] ?? "(T)"
  const tabName = SEGMENT_TAB_NAMES[segmentType] ?? segmentType
  return `${prefix} ${tabName}`
}

export type StudyType = "text" | "grid" | "layer" | "hybrid"

export interface Persona {
  segmentType: string
  segmentValue: string
  label: string
  id: string
}

export interface BlueprintElement {
  name: string
  category: string
  value: number
  priority?: number
}

export interface PersonaBlueprint {
  persona: Persona
  use: BlueprintElement[]
  avoid: BlueprintElement[]
  studyType: StudyType
}

export interface PersonaBlueprintOptions {
  topN?: number
  bottomN?: number
  metric?: BlueprintMetric
}

function getSegmentValue(el: any, segmentKey: string): number {
  const v = el.values?.[segmentKey]
  if (v == null) return 0
  if (typeof v === "number") return v
  if (typeof v === "object" && typeof v.value === "number") return v.value
  return 0
}

/** List all segment types that have per-segment data (checks (T) sections) */
export function getAvailableSegmentTypes(analysis: any): string[] {
  const out: string[] = []
  if (analysis?.["(T) Age"]?.segments) out.push("Age")
  if (analysis?.["(T) Gender"]?.segments) out.push("Gender")
  if (analysis?.["(T) Classification Questions"]?.questions?.length)
    out.push("Classification Questions")
  if (analysis?.["(T) Mindsets"]?.categories?.length) {
    const firstEl = analysis["(T) Mindsets"].categories[0]?.elements?.[0]
    const keys = firstEl?.values
      ? Object.keys(firstEl.values).filter((k: string) => k !== "Total")
      : []
    if (keys.length) out.push("Mindsets")
  }
  return out
}

/** List all personas (segment type + value) for the given segment type and metric */
export function getPersonas(
  analysis: any,
  segmentType: string,
  metric: BlueprintMetric = "Top Down"
): Persona[] {
  const sectionKey = getSectionKey(metric, segmentType)
  const section = analysis?.[sectionKey]
  if (!section?.categories?.length) return []

  if (segmentType === "Age" || segmentType === "Gender") {
    const segments = section.segments ? Object.keys(section.segments).sort() : []
    return segments.map((segmentValue) => ({
      segmentType,
      segmentValue,
      label: `${segmentType}: ${segmentValue}`,
      id: `${segmentType}::${segmentValue}`,
    }))
  }

  if (segmentType === "Mindsets") {
    const firstEl = section.categories[0]?.elements?.[0]
    const keys = firstEl?.values
      ? Object.keys(firstEl.values).filter((k: string) => k !== "Total")
      : []
    return keys.map((segmentValue) => ({
      segmentType,
      segmentValue,
      label: segmentValue.replace(/_/g, " "),
      id: `Mindsets::${segmentValue}`,
    }))
  }

  if (segmentType === "Classification Questions") {
    const questions = section.questions || []
    const personas: Persona[] = []
    for (const q of questions) {
      const segs = q.segments ? Object.keys(q.segments) : []
      for (const answer of segs) {
        const segmentValue = `${q.question_text}::${answer}`
        personas.push({
          segmentType: "Classification Questions",
          segmentValue,
          label: `${answer}`,
          id: `Classification::${segmentValue}`,
        })
      }
    }
    return personas
  }

  return []
}

/** Get element scores for one segment (one persona) from the right section */
function getElementScoresForSegment(
  analysis: any,
  segmentType: string,
  segmentValue: string,
  metric: BlueprintMetric = "Top Down"
): { name: string; category: string; value: number }[] {
  const key = getSectionKey(metric, segmentType)
  const section = analysis?.[key]
  if (!section?.categories?.length) return []

  const items: { name: string; category: string; value: number }[] = []
  for (const cat of section.categories) {
    const categoryName = cat.name || ""
    for (const el of cat.elements || []) {
      const value = getSegmentValue(el, segmentValue)
      items.push({ name: el.name || "", category: categoryName, value })
    }
  }
  return items
}

/** Build one persona blueprint: top N (use) and bottom N (avoid) */
export function getPersonaBlueprint(
  analysis: any,
  persona: Persona,
  studyType: StudyType,
  options: PersonaBlueprintOptions = {}
): PersonaBlueprint {
  const { topN = 5, bottomN = 3, metric = "Top Down" } = options
  const scores = getElementScoresForSegment(
    analysis,
    persona.segmentType,
    persona.segmentValue,
    metric
  )
  const sorted = [...scores].sort((a, b) => b.value - a.value)
  const use = sorted.slice(0, topN).map((e, i) => ({ ...e, priority: i + 1 }))
  const avoid = sorted.slice(-bottomN).reverse().map((e) => ({ ...e }))
  return {
    persona,
    use,
    avoid,
    studyType,
  }
}

/** All blueprints for all personas of the given segment type */
export function getPersonaBlueprints(
  analysis: any,
  segmentType: string,
  studyType: StudyType,
  options: PersonaBlueprintOptions = {}
): PersonaBlueprint[] {
  const metric = options.metric ?? "Top Down"
  const personas = getPersonas(analysis, segmentType, metric)
  return personas.map((persona) =>
    getPersonaBlueprint(analysis, persona, studyType, options)
  )
}
