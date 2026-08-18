/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StudyFilterPayload } from "@/lib/api/ResponseAPI"
import { hasAnyFilterSelection } from "@/lib/utils/filterAnalysisMerge"

/**
 * Transforms analysis.json structure for use in Table, Heatmap, and Graph components.
 * analysis.json keys: (T) Overall, (B) Overall, (R) Overall, (T) Age, (B) Age, etc.
 * Metric: Top Down -> (T), Bottom Up -> (B), Response Time -> (R)
 * Tab: Overall, Age, Gender, Prelim, 2 Market Segments, 3 Market Segments
 */

const METRIC_KEYS: Record<string, string> = {
  "Top Down": "(T)",
  "Bottom Up": "(B)",
  "Response Time": "(R)",
}

const TAB_KEYS: Record<string, string> = {
  Overall: "Overall",
  Age: "Age",
  Gender: "Gender",
  Prelim: "Classification Questions",
  "2 Market Segments": "Mindsets",
  "3 Market Segments": "Mindsets",
}

export type TableRow = { response: string;[key: string]: string | number }
export type TableCategory = {
  title: string
  data: TableRow[]
  columns?: Column[]
  /** Prelim: classification question this table belongs to */
  groupTitle?: string
}
export type Column = { key: string; label: string; subLabel?: string; optionFullText?: string }

export type PrelimQuestionGroup = {
  question: string
  tables: TableCategory[]
}

/** Group Prelim tables by classification question */
export function groupPrelimCategories(categories: TableCategory[]): PrelimQuestionGroup[] {
  const groups: PrelimQuestionGroup[] = []
  for (const cat of categories) {
    const question = cat.groupTitle || cat.title
    let group = groups.find((g) => g.question === question)
    if (!group) {
      group = { question, tables: [] }
      groups.push(group)
    }
    group.tables.push(cat)
  }
  return groups
}

export interface TransformedAnalysis {
  categories: TableCategory[]
  columns: Column[]
}

function getAnalysisSection(analysis: any, metric: string, tab: string): any {
  const m = METRIC_KEYS[metric] || "(T)"
  const tabKey = TAB_KEYS[tab] || "Overall"
  const key = `${m} ${tabKey}`
  return analysis?.[key] ?? null
}

function formatValue(val: number, isResponseTime: boolean): number {
  if (typeof val !== "number") return 0
  if (isResponseTime && (val < 1 || val > -1)) {
    return Math.round(val * 1000) / 1000 // 3 decimal places for small decimals
  }
  return val
}

function normKey(value: string): string {
  return value.trim().toLowerCase()
}

/** Resolve active filter criteria from explicit prop or fields on the analysis payload. */
export function resolveAppliedFilters(
  analysis: any,
  explicit?: StudyFilterPayload["filters"] | null
): StudyFilterPayload["filters"] | null {
  if (explicit && hasAnyFilterSelection(explicit)) return explicit
  const embedded =
    analysis?.active_filters ??
    analysis?._appliedFilters ??
    analysis?.applied_filters ??
    null
  if (embedded && hasAnyFilterSelection(embedded)) return embedded
  if (analysis?.has_active_filter || analysis?._filterApplied) {
    return embedded ?? null
  }
  return null
}

function filterSegmentKeysBySelection(
  allKeys: string[],
  selected: string[] | undefined
): string[] {
  if (!selected?.length) return allKeys
  const allowed = new Set(selected.map(normKey))
  return allKeys.filter((k) => allowed.has(normKey(k)))
}

function filterPrelimQuestionKeys(
  questionText: string,
  allOptionKeys: string[],
  classificationFilters: Record<string, string[]> | undefined
): string[] | null {
  if (!classificationFilters || Object.keys(classificationFilters).length === 0) {
    return allOptionKeys
  }
  const questionEntry = Object.entries(classificationFilters).find(
    ([q]) => normKey(q) === normKey(questionText)
  )
  if (!questionEntry) return null
  const [, selectedOptions] = questionEntry
  if (!selectedOptions?.length) return null
  const allowed = new Set(selectedOptions.map(normKey))
  const matched = allOptionKeys.filter((opt) => allowed.has(normKey(opt)))
  return matched.length > 0 ? matched : []
}

/** Extract columns and rows from analysis section */
export function transformAnalysisForView(
  analysis: any,
  metric: string,
  tab: string,
  appliedFilters?: StudyFilterPayload["filters"] | null
): TransformedAnalysis {
  const section = getAnalysisSection(analysis, metric, tab)
  const isResponseTime = metric === "Response Time"

  const defaultResult: TransformedAnalysis = { categories: [], columns: [{ key: "total", label: "Total" }] }

  if (!section?.categories?.length) {
    return defaultResult
  }

  const categories: TableCategory[] = []
  let columns: Column[] = []
  const applied = resolveAppliedFilters(analysis, appliedFilters)

  // Overall: elements have single "value"
  if (tab === "Overall") {
    columns = [{ key: "total", label: "Total", optionFullText: "Total" }]
    for (const cat of section.categories) {
      const data: TableRow[] = (cat.elements || []).map((el: any) => ({
        response: el.name || "",
        total: formatValue(el.value, isResponseTime),
      }))
      if (data.length) categories.push({ title: cat.name || "", data })
    }
    return { categories, columns }
  }

  // Age, Gender: elements have "values" object, segment keys from "segments"
  if (tab === "Age" || tab === "Gender") {
    const segments = section.segments || {}
    let segKeys = Object.keys(segments).sort()
    if (tab === "Age" && applied?.age_groups?.length) {
      segKeys = filterSegmentKeysBySelection(segKeys, applied.age_groups)
    }
    if (tab === "Gender" && applied?.genders?.length) {
      segKeys = filterSegmentKeysBySelection(segKeys, applied.genders)
    }
    columns = segKeys.map((k) => ({
      key: k,
      label: k,
      optionFullText: k,
      subLabel: `(${segments[k]?.base_size ?? 0})`,
    }))
    if (columns.length === 0) columns = [{ key: "total", label: "Total" }]

    for (const cat of section.categories) {
      const data: TableRow[] = (cat.elements || []).map((el: any) => {
        const row: TableRow = { response: el.name || "" }
        const vals = el.values || {}
        for (const k of segKeys) row[k] = formatValue(vals[k] ?? 0, isResponseTime)
        if (segKeys.length === 0 && typeof el.value === "number") row.total = formatValue(el.value, isResponseTime)
        return row
      })
      if (data.length) categories.push({ title: cat.name || "", data })
    }
    return { categories, columns }
  }

  // 2 Market Segments, 3 Market Segments: use Mindsets, values have Total, Mindset_1_of_2, etc.
  if (tab === "2 Market Segments" || tab === "3 Market Segments") {
    const count = tab === "2 Market Segments" ? 2 : 3
    const keys: string[] = ["Total"]
    for (let i = 1; i <= count; i++) keys.push(`Mindset_${i}_of_${count}`)

    const groups = section.groups || {}
    const mindsetGroup = groups["Mindset_" + count] || {}
    columns = keys.map((k) => ({
      key: k,
      label: k.replace(/_/g, " "),
      optionFullText: k.replace(/_/g, " "),
      subLabel: mindsetGroup[k]?.base_size != null ? `(${mindsetGroup[k].base_size})` : undefined,
    }))

    for (const cat of section.categories) {
      const data: TableRow[] = (cat.elements || []).map((el: any) => {
        const row: TableRow = { response: el.name || "" }
        const vals = el.values || {}
        for (const k of keys) row[k] = formatValue(vals[k] ?? 0, isResponseTime)
        return row
      })
      if (data.length) categories.push({ title: cat.name || "", data })
    }
    return { categories, columns }
  }

  // Prelim (Classification Questions): Question → Category → Elements × Answer options
  if (tab === "Prelim") {
    const questions = section.questions || []
    const classFilters = applied?.classification_filters

    for (const q of questions) {
      const segs = q.segments || {}
      const ansKeys = filterPrelimQuestionKeys(q.question_text, Object.keys(segs), classFilters)
      if (!ansKeys?.length) continue

      const groupColumns: Column[] = ansKeys.map((ans) => {
        const fullKey = `${q.question_text}::${ans}`
        return {
          key: fullKey,
          label: ans,
          optionFullText: ans,
          subLabel: segs[ans]?.base_size != null ? `(${segs[ans].base_size})` : undefined,
        }
      })

      for (const cat of section.categories) {
        const elements = cat.elements || []
        if (elements.length === 0) continue

        const elementRows: TableRow[] = elements.map((el: any) => {
          const row: TableRow = { response: el.name || "" }
          const vals = el.values || {}
          for (const col of groupColumns) {
            const v = vals[col.key]
            const num = typeof v === "object" && v && "value" in v ? v.value : v
            row[col.key] = formatValue(typeof num === "number" ? num : 0, isResponseTime)
          }
          return row
        })

        categories.push({
          title: cat.name || "",
          groupTitle: q.question_text,
          data: elementRows,
          columns: groupColumns,
        })
      }
    }

    return { categories, columns: [] }
  }

  return defaultResult
}
