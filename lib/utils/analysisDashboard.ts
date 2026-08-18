/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Utilities to extract dashboard-ready data from analysis.json
 * Used for KPI cards, response time charts, top/bottom performers, pie charts, etc.
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

type DashboardSummary = {
  totalResponses?: number
  uniquePanelists?: number
  totalRespondents?: number
  avgResponseTime?: number
  avgRating?: number
  taskCount?: number
  categoryCount?: number
}

function getSection(analysis: any, metric: string, tab: string): any {
  const m = METRIC_KEYS[metric] || "(T)"
  const tabKey = TAB_KEYS[tab] || "Overall"
  const key = `${m} ${tabKey}`
  return analysis?.[key] ?? null
}

/** Extract KPI stats from dashboard_summary when available, otherwise RawData. */
export function getKPIStats(analysis: any, rawOverride?: any[]): {
  totalResponses: number
  uniquePanelists: number
  totalRespondents: number // panelists who completed ALL tasks (study fully)
  avgResponseTime: number
  avgRating: number
  taskCount: number
  categoryCount: number
} {
  const summary: DashboardSummary | undefined = rawOverride ? undefined : analysis?.dashboard_summary
  if (summary) {
    return {
      totalResponses: Number(summary.totalResponses ?? 0),
      uniquePanelists: Number(summary.uniquePanelists ?? 0),
      totalRespondents: Number(summary.totalRespondents ?? 0),
      avgResponseTime: Number(summary.avgResponseTime ?? 0),
      avgRating: Number(summary.avgRating ?? 0),
      taskCount: Number(summary.taskCount ?? 1),
      categoryCount: Number(summary.categoryCount ?? analysis?.["Information Block"]?.Categories?.length ?? 0),
    }
  }

  const raw = rawOverride ?? analysis?.RawData ?? []
  const info = analysis?.["Information Block"]
  const categories = info?.Categories || []

  const allTasks = [...new Set(raw.map((r: any) => r.Task))].filter((v: any) => v != null)
  const taskCount = allTasks.length || 1

  // Group by panelist: set of tasks each panelist completed
  const panelistTasks: Record<string, Set<unknown>> = {}
  raw.forEach((r: any) => {
    const p = r.Panelist
    if (p == null) return
    if (!panelistTasks[p]) panelistTasks[p] = new Set()
    if (r.Task != null) panelistTasks[p].add(r.Task)
  })

  // Total respondents = those who completed all tasks
  const totalRespondents = Object.values(panelistTasks).filter(
    (taskSet) => taskSet.size === taskCount
  ).length

  const uniquePanelists = Object.keys(panelistTasks).length
  const responseTimes = raw.map((r: any) => r.ResponseTime).filter((v: any) => typeof v === "number")
  const ratings = raw.map((r: any) => r.Rating).filter((v: any) => typeof v === "number")

  return {
    totalResponses: raw.length,
    uniquePanelists,
    totalRespondents,
    avgResponseTime: responseTimes.length ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length : 0,
    avgRating: ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0,
    taskCount,
    categoryCount: categories.length,
  }
}

/** Response time distribution buckets for pie/histogram */
export function getResponseTimeDistribution(raw: any[]): { name: string; value: number; fill: string }[] {
  const buckets = [
    { name: "Fast (<0.5s)", max: 0.5, fill: "#22C55E" },
    { name: "Medium (0.5-1s)", max: 1, fill: "#FCCD5B" },
    { name: "Slow (1-2s)", max: 2, fill: "#F7945A" },
    { name: "Very Slow (>2s)", max: Infinity, fill: "#C04E35" },
  ]
  const counts = [0, 0, 0, 0]
  raw.forEach((r: any) => {
    const t = Number(r.ResponseTime)
    if (isNaN(t)) return
    for (let i = 0; i < buckets.length; i++) {
      if (t < buckets[i].max) {
        counts[i]++
        break
      }
    }
  })
  return buckets.map((b, i) => ({ ...b, value: counts[i] })).filter((d) => d.value > 0)
}

/** Response time by task */
export function getResponseTimeByTask(raw: any[]): { task: number; avg: number; count: number }[] {
  const byTask: Record<number, number[]> = {}
  raw.forEach((r: any) => {
    const t = r.Task
    const rt = Number(r.ResponseTime)
    if (t == null || isNaN(rt)) return
    if (!byTask[t]) byTask[t] = []
    byTask[t].push(rt)
  })
  return Object.entries(byTask)
    .map(([task, times]) => ({
      task: Number(task),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      count: times.length,
    }))
    .sort((a, b) => a.task - b.task)
}

/** Rating distribution */
export function getRatingDistribution(raw: any[]): { name: string; value: number }[] {
  const counts: Record<number, number> = {}
  raw.forEach((r: any) => {
    const v = Number(r.Rating)
    if (!isNaN(v)) counts[v] = (counts[v] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, value]) => ({ name: `Rating ${name}`, value }))
    .sort((a, b) => Number(a.name.replace("Rating ", "")) - Number(b.name.replace("Rating ", "")))
}

/** Resolve image URL for an element from Information Block (grid, hybrid, layer). */
export function getElementImageUrl(
  analysis: any,
  category: string,
  elementName: string
): string | null {
  const info = analysis?.["Information Block"]
  if (!info?.Categories?.length) return null
  const cat = info.Categories.find((c: any) => (c.name || "").trim() === (category || "").trim())
  if (!cat?.elements?.length) return null
  const el = cat.elements.find((e: any) => (e.name || "").trim() === (elementName || "").trim())
  if (!el) return null
  /** Hybrid: element_type "text" = text-only, skip image */
  const elType = (el.element_type ?? el.elementType ?? "").toString().toLowerCase()
  if (elType === "text") return null
  const url = el.content ?? el.imageUrl ?? el.imageLink ?? el.image ?? null
  return url && typeof url === "string" && url.startsWith("http") ? url : null
}

/** Top and bottom N elements from Overall section. Includes imageUrl for layer studies. */
export function getTopBottomPerformers(
  analysis: any,
  metric: string,
  n: number = 5
): {
  top: { name: string; value: number; category: string; imageUrl?: string | null }[]
  bottom: { name: string; value: number; category: string; imageUrl?: string | null }[]
} {
  const section = getSection(analysis, metric, "Overall")
  if (!section?.categories?.length) return { top: [], bottom: [] }

  const all: { name: string; value: number; category: string; imageUrl?: string | null }[] = []
  for (const cat of section.categories) {
    for (const el of cat.elements || []) {
      const v = typeof el.value === "number" ? el.value : 0
      const elType = (el.element_type ?? el.elementType ?? "").toString().toLowerCase()
      const skipImage = elType === "text"
      const imageUrl = skipImage
        ? null
        : el.content ?? el.imageUrl ?? el.imageLink ?? el.image ?? null
      const resolved =
        imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")
          ? imageUrl
          : getElementImageUrl(analysis, cat.name || "", el.name || "")
      all.push({
        name: el.name || "",
        value: v,
        category: cat.name || "",
        imageUrl: resolved || undefined,
      })
    }
  }
  all.sort((a, b) => b.value - a.value)
  const top = all.slice(0, n)
  const bottom = all.slice(-n).reverse()
  return { top, bottom }
}

/** Radar chart data: compare metrics across categories (Top Down vs Bottom Up vs Response Time) */
export function getRadarDataForCategories(analysis: any, tab: string = "Overall"): {
  category: string
  "Top Down": number
  "Bottom Up": number
  "Response Time": number
}[] {
  const cats = analysis?.["Information Block"]?.Categories || []
  const result: { category: string; "Top Down": number; "Bottom Up": number; "Response Time": number }[] = []

  for (const cat of cats) {
    const td = getSection(analysis, "Top Down", tab)
    const bu = getSection(analysis, "Bottom Up", tab)
    const rt = getSection(analysis, "Response Time", tab)

    const getAvg = (section: any, catName: string) => {
      const c = section?.categories?.find((x: any) => x.name === catName)
      const els = c?.elements || []
      if (els.length === 0) return 0
      const sum = els.reduce((acc: number, el: any) => acc + (el.value ?? 0), 0)
      return sum / els.length
    }

    result.push({
      category: cat.name,
      "Top Down": getAvg(td, cat.name),
      "Bottom Up": getAvg(bu, cat.name),
      "Response Time": getAvg(rt, cat.name) * (rt ? 10 : 1), // scale for visibility if needed
    })
  }
  return result
}

/** Age/Gender segment distribution for pie chart (counts tasks/responses per segment) */
export function getSegmentDistribution(raw: any[], field: "Age" | "Gender"): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  raw.forEach((r: any) => {
    const v = r[field]
    if (v != null) counts[String(v)] = (counts[String(v)] || 0) + 1
  })
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

/** Age/Gender participation: unique panelists per segment (people who participated, not task count) */
export function getSegmentParticipation(raw: any[], field: "Age" | "Gender"): { name: string; value: number }[] {
  const bySegment: Record<string, Set<string>> = {}
  raw.forEach((r: any) => {
    const seg = r[field]
    if (seg == null) return
    const panelist = r.Panelist
    if (panelist == null) return
    const key = String(seg)
    if (!bySegment[key]) bySegment[key] = new Set()
    bySegment[key].add(String(panelist))
  })
  return Object.entries(bySegment).map(([name, set]) => ({ name, value: set.size }))
}

/** Age ranges used in Age Distribution (participants) and Filter Analysis */
export const AGE_RANGES = ["13-18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const

/** Map numeric age to age-range label (e.g. 15 -> "13-18", 22 -> "18-24", 44 -> "35-44"). */
export function getAgeRangeLabel(age: number): string {
  if (typeof age !== "number" || Number.isNaN(age)) return "Unknown"
  if (age >= 65) return "65+"
  if (age >= 55) return "55-64"
  if (age >= 45) return "45-54"
  if (age >= 35) return "35-44"
  if (age >= 25) return "25-34"
  if (age >= 18) return "18-24"
  if (age >= 13) return "13-18"
  return "Under 13"
}

/**
 * Age distribution (participants) by age ranges: 13-18, 18-24, 25-34, 35-44, 45-54, 55-64, 65+.
 * Buckets numeric ages from RawData and counts unique panelists per range.
 * Use this for the Age Distribution (participants) pie chart instead of raw individual ages.
 */
export function getAgeDistributionByRanges(raw: any[]): { name: string; value: number }[] {
  const byRange: Record<string, Set<string>> = {}
  const order = [...AGE_RANGES, "Under 13", "Unknown"]
  order.forEach((label) => { byRange[label] = new Set() })

  raw.forEach((r: any) => {
    const panelist = r.Panelist
    if (panelist == null) return
    const ageRaw = r.Age
    if (ageRaw == null) return
    const asStr = String(ageRaw).trim()
    const label =
      AGE_RANGES.includes(asStr as any)
        ? asStr
        : (() => {
            const age = typeof ageRaw === "number" ? ageRaw : Number(ageRaw)
            return Number.isNaN(age) ? "Unknown" : getAgeRangeLabel(age)
          })()
    if (!byRange[label]) byRange[label] = new Set()
    byRange[label].add(String(panelist))
  })

  return order
    .filter((name) => (byRange[name]?.size ?? 0) > 0)
    .map((name) => ({ name, value: byRange[name]?.size ?? 0 }))
}

/** Heatmap matrix for Overall: categories x elements, values */
export function getHeatmapMatrix(analysis: any, metric: string, tab: string): {
  rows: string[]
  columns: string[]
  data: number[][]
  rowLabels: string[]
} {
  const section = getSection(analysis, metric, tab)
  if (!section?.categories?.length) return { rows: [], columns: [], data: [], rowLabels: [] }

  const columns = tab === "Overall" ? ["Total"] : (section.segments ? Object.keys(section.segments).sort() : ["Total"])
  if (tab === "2 Market Segments" || tab === "3 Market Segments") {
    const count = tab === "2 Market Segments" ? 2 : 3
    const keys = ["Total"]
    for (let i = 1; i <= count; i++) keys.push(`Mindset_${i}_of_${count}`)
    const groups = section.groups || {}
    const mindsetGroup = groups["Mindset_" + count] || {}
    // columns from mindset group keys
    const cols = Object.keys(mindsetGroup).length ? Object.keys(mindsetGroup) : keys
    // Use first element's values to get columns
    const firstEl = section.categories[0]?.elements?.[0]
    const colKeys = firstEl?.values ? Object.keys(firstEl.values) : keys
    return {
      rows: section.categories.flatMap((c: any) => (c.elements || []).map((e: any) => e.name)),
      columns: colKeys,
      rowLabels: section.categories.flatMap((c: any) => (c.elements || []).map(() => c.name)),
      data: section.categories.flatMap((c: any) =>
        (c.elements || []).map((e: any) => {
          const vals = e.values || {}
          return colKeys.map((k) => (typeof vals[k] === "object" && vals[k]?.value != null ? vals[k].value : vals[k] ?? 0))
        })
      ),
    }
  }

  const rows = section.categories.flatMap((c: any) => (c.elements || []).map((e: any) => e.name))
  const rowLabels = section.categories.flatMap((c: any) => (c.elements || []).map(() => c.name))
  const data = section.categories.flatMap((c: any) =>
    (c.elements || []).map((e: any) => {
      if (tab === "Overall") return [typeof e.value === "number" ? e.value : 0]
      const vals = e.values || {}
      return columns.map((k) => (typeof vals[k] === "object" && vals[k]?.value != null ? vals[k].value : vals[k] ?? 0))
    })
  )
  return { rows, columns, data, rowLabels }
}

/** Segment comparison: category avg per Age/Gender segment for grouped bar chart */
export function getSegmentComparisonData(
  analysis: any,
  metric: string,
  segmentType: "Age" | "Gender"
): { category: string; [segment: string]: string | number }[] {
  const tab = segmentType
  const section = getSection(analysis, metric, tab)
  if (!section?.categories?.length || !section?.segments) return []

  const segments = Object.keys(section.segments).sort()
  if (segments.length === 0) return []

  const result: { category: string; [segment: string]: string | number }[] = []
  for (const cat of section.categories) {
    const row: { category: string; [segment: string]: string | number } = { category: cat.name || "" }
    for (const seg of segments) {
      const els = cat.elements || []
      const vals = els.map((e: any) => {
        const v = e.values?.[seg]
        return typeof v === "number" ? v : 0
      })
      row[seg] = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0
    }
    result.push(row)
  }
  return result
}

/** Key insights: top per metric (T, B, R), best across all three, strongest category, most polarized (T only) */
export function getKeyInsights(analysis: any): { title: string; value: string; type: "top" | "category" | "variance" }[] {
  const insights: { title: string; value: string; type: "top" | "category" | "variance" }[] = []
  const sectionT = getSection(analysis, "Top Down", "Overall")
  const sectionB = getSection(analysis, "Bottom Up", "Overall")
  const sectionR = getSection(analysis, "Response Time", "Overall")
  const base = sectionT ?? sectionB ?? sectionR
  if (!base?.categories?.length) return insights

  type El = { name: string; category: string; vT: number; vB: number; vR: number }
  const elements: El[] = []
  for (const cat of base.categories) {
    const catT = sectionT?.categories?.find((c: any) => c.name === cat.name)
    const catB = sectionB?.categories?.find((c: any) => c.name === cat.name)
    const catR = sectionR?.categories?.find((c: any) => c.name === cat.name)
    const els = cat.elements || []
    for (let i = 0; i < els.length; i++) {
      const el = els[i]
      let vT = 0, vB = 0, vR = 0
      if (sectionT && catT?.elements?.[i] != null)
        vT = typeof catT.elements[i].value === "number" ? catT.elements[i].value : 0
      if (sectionB && catB?.elements?.[i] != null)
        vB = typeof catB.elements[i].value === "number" ? catB.elements[i].value : 0
      if (sectionR && catR?.elements?.[i] != null)
        vR = typeof catR.elements[i].value === "number" ? catR.elements[i].value : 0
      elements.push({ name: el.name || "", category: cat.name || "", vT, vB, vR })
    }
  }

  const fmt = (name: string, val: number) => {
    const short = name.length > 60 ? name.slice(0, 57) + "…" : name
    const valStr = Number.isInteger(val) ? String(val) : val.toFixed(1)
    return `${short} (${valStr})`
  }

  if (sectionT) {
    const byT = [...elements].sort((a, b) => b.vT - a.vT)
    if (byT[0]) insights.push({ title: "Top Performing Element (Top Down)", value: fmt(byT[0].name, byT[0].vT), type: "top" })
  }
  if (sectionB) {
    const byB = [...elements].sort((a, b) => b.vB - a.vB)
    if (byB[0]) insights.push({ title: "Top Performing Element (Bottom Up)", value: fmt(byB[0].name, byB[0].vB), type: "top" })
  }
  if (sectionR) {
    const byR = [...elements].sort((a, b) => b.vR - a.vR)
    if (byR[0]) insights.push({ title: "Top Performing Element (Response Time)", value: fmt(byR[0].name, byR[0].vR), type: "top" })
  }

  const metricCount = [sectionT, sectionB, sectionR].filter(Boolean).length
  if (metricCount >= 2 && elements.length) {
    const byT = [...elements].sort((a, b) => b.vT - a.vT)
    const byB = [...elements].sort((a, b) => b.vB - a.vB)
    const byR = [...elements].sort((a, b) => b.vR - a.vR)
    const rankT = new Map<string, number>()
    const rankB = new Map<string, number>()
    const rankR = new Map<string, number>()
    byT.forEach((e, i) => rankT.set(e.name + "\0" + e.category, i + 1))
    byB.forEach((e, i) => rankB.set(e.name + "\0" + e.category, i + 1))
    byR.forEach((e, i) => rankR.set(e.name + "\0" + e.category, i + 1))
    const key = (e: El) => e.name + "\0" + e.category
    const withRankSum = elements.map((e) => ({
      ...e,
      rankSum: (sectionT ? rankT.get(key(e)) ?? 0 : 0) + (sectionB ? rankB.get(key(e)) ?? 0 : 0) + (sectionR ? rankR.get(key(e)) ?? 0 : 0),
    }))
    withRankSum.sort((a, b) => a.rankSum - b.rankSum)
    const best = withRankSum[0]
    if (best) {
      const short = best.name.length > 60 ? best.name.slice(0, 57) + "…" : best.name
      insights.push({ title: "Best Across T, B & R", value: short + " (strong in all metrics)", type: "top" })
    }
  }

  if (sectionT) {
    const catAvgs: { name: string; avg: number }[] = []
    for (const cat of sectionT.categories) {
      const els = cat.elements || []
      const avg = els.length ? els.reduce((a: number, e: any) => a + (typeof e.value === "number" ? e.value : 0), 0) / els.length : 0
      catAvgs.push({ name: cat.name || "", avg })
    }
    catAvgs.sort((a, b) => b.avg - a.avg)
    if (catAvgs[0]) {
      const avgStr = Number.isInteger(catAvgs[0].avg) ? String(catAvgs[0].avg) : catAvgs[0].avg.toFixed(1)
      insights.push({ title: "Strongest Category (Top Down)", value: `${catAvgs[0].name} (avg ${avgStr})`, type: "category" })
    }
    const grandMean = catAvgs.reduce((s, x) => s + x.avg, 0) / catAvgs.length
    const variances = catAvgs.map((c) => ({ ...c, variance: Math.abs(c.avg - grandMean) }))
    variances.sort((a, b) => b.variance - a.variance)
    if (variances[0] && variances[0].variance > 0) {
      const varStr = Number.isInteger(variances[0].variance) ? String(variances[0].variance) : variances[0].variance.toFixed(1)
      insights.push({ title: "Most Polarized Category (Top Down)", value: `${variances[0].name} (deviates ${varStr} from mean)`, type: "variance" })
    }
  }
  return insights
}

/** Filter RawData by segment (Age or Gender) */
export function filterRawDataBySegment(raw: any[], segmentFilter: string | null, segmentField: "Age" | "Gender" | null): any[] {
  if (!segmentFilter || !segmentField) return raw
  const filterLower = String(segmentFilter).toLowerCase()
  return raw.filter((r) => {
    const val = r[segmentField]
    if (val == null) return false
    return String(val).toLowerCase() === filterLower
  })
}

/** Get available segment options for filter (from analysis sections) */
export function getSegmentFilterOptions(analysis: any): { field: "Age" | "Gender"; value: string }[] {
  const options: { field: "Age" | "Gender"; value: string }[] = []
  const ageSection = analysis?.["(T) Age"]
  const genderSection = analysis?.["(T) Gender"]
  if (ageSection?.segments) {
    for (const seg of Object.keys(ageSection.segments).sort()) {
      options.push({ field: "Age", value: seg })
    }
  }
  if (genderSection?.segments) {
    for (const seg of Object.keys(genderSection.segments).sort()) {
      options.push({ field: "Gender", value: seg })
    }
  }
  return options
}

/** Bar chart data: top elements per category for Overall */
export function getBarChartData(analysis: any, metric: string, limit: number = 8): { name: string; value: number; category: string }[] {
  const section = getSection(analysis, metric, "Overall")
  if (!section?.categories?.length) return []

  const all: { name: string; value: number; category: string }[] = []
  for (const cat of section.categories) {
    for (const el of cat.elements || []) {
      const v = typeof el.value === "number" ? el.value : 0
      all.push({ name: el.name || "", value: v, category: cat.name || "" })
    }
  }
  all.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  return all.slice(0, limit)
}

// ─── Fatigue & Resistance Predictor ─────────────────────────────────────────
const RAW_DATA_NON_ELEMENT_KEYS = new Set([
  "Panelist", "Age", "Gender", "Task", "Rating", "ResponseTime",
])

function isElementColumn(key: string): boolean {
  if (RAW_DATA_NON_ELEMENT_KEYS.has(key)) return false
  if (key.includes("?")) return false // classification questions
  return key.includes("-") // element keys are "Category-Element-name"
}

/** Get display name for an element key (Category-Element-slug). Strips leading numeric tokens (e.g. 3-2-3-1-) so only the element name is shown. */
function elementKeyToDisplay(key: string): { category: string; name: string } {
  const firstDash = key.indexOf("-")
  if (firstDash <= 0) return { category: "Other", name: key.replace(/-/g, " ") }
  const category = key.slice(0, firstDash).replace(/-/g, " ")
  let namePart = key.slice(firstDash + 1).replace(/-/g, " ")
  // Strip leading numeric-only tokens (e.g. "3 2 3 1" from keys like "3-2-3-1-A-letter-arrives-...")
  const tokens = namePart.split(/\s+/)
  let start = 0
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d+$/.test(tokens[i])) start = i + 1
    else break
  }
  namePart = tokens.slice(start).join(" ").trim() || namePart
  return { category, name: namePart }
}

export interface FatigueRiskItem {
  elementKey: string
  category: string
  name: string
  /** Short display name (truncated) */
  shortName: string
  /** Positive = declines from early to late (fatigue) */
  ratingDecline: number
  /** Early (first half of tasks) avg rating */
  earlyAvgRating: number
  /** Late (second half) avg rating */
  lateAvgRating: number
  /** Response time increase (late - early); positive = slows down */
  responseTimeShift: number
  /** Variance of rating across all appearances (volatility) */
  ratingVolatility: number
  /** Variance of avg rating across Age/Gender segments (segment inconsistency) */
  segmentInconsistency: number
  /** Combined fatigue score (higher = higher risk) */
  fatigueScore: number
  summary: string
}

/**
 * Fatigue & Resistance Predictor: detects elements that perform well initially
 * but show long-term resistance (decline across repeated exposures).
 * Uses: response time shifts, segment inconsistencies, element volatility.
 */
export function getFatigueRisk(
  analysis: any,
  rawOverride?: any[],
  options: { topN?: number; minAppearances?: number } = {}
): FatigueRiskItem[] {
  const raw = rawOverride ?? analysis?.RawData ?? []
  const { topN = 10, minAppearances = 4 } = options
  if (raw.length === 0) return []

  const taskNumbers: number[] = raw.map((r: any) => Number(r.Task)).filter((t: number) => !isNaN(t) && t > 0)
  const allTaskNumbers: number[] = [...new Set(taskNumbers)].sort((a: number, b: number) => a - b)
  const taskMedian: number = allTaskNumbers.length ? allTaskNumbers[Math.floor(allTaskNumbers.length / 2)] : 0
  const earlyTasks = new Set(allTaskNumbers.filter((t) => t <= taskMedian))
  const lateTasks = new Set(allTaskNumbers.filter((t) => t > taskMedian))

  const keysFromRaw = raw.flatMap((r: any) => Object.keys(r)) as string[]
  const elementKeys: string[] = [...new Set(keysFromRaw.filter(isElementColumn))]
  const results: FatigueRiskItem[] = []

  for (const key of elementKeys) {
    const rows = raw.filter((r: any) => r[key] === 1)
    if (rows.length < minAppearances) continue

    const early = rows.filter((r: any) => earlyTasks.has(Number(r.Task)))
    const late = rows.filter((r: any) => lateTasks.has(Number(r.Task)))
    if (early.length < 2 || late.length < 2) continue

    const earlyRatings = early.map((r: any) => Number(r.Rating)).filter((n: number) => !isNaN(n))
    const lateRatings = late.map((r: any) => Number(r.Rating)).filter((n: number) => !isNaN(n))
    const earlyRT = early.map((r: any) => Number(r.ResponseTime)).filter((n: number) => !isNaN(n))
    const lateRT = late.map((r: any) => Number(r.ResponseTime)).filter((n: number) => !isNaN(n))

    const earlyAvgRating = earlyRatings.length ? earlyRatings.reduce((a: number, b: number) => a + b, 0) / earlyRatings.length : 0
    const lateAvgRating = lateRatings.length ? lateRatings.reduce((a: number, b: number) => a + b, 0) / lateRatings.length : 0
    const ratingDecline = earlyAvgRating - lateAvgRating

    const earlyAvgRT = earlyRT.length ? earlyRT.reduce((a: number, b: number) => a + b, 0) / earlyRT.length : 0
    const lateAvgRT = lateRT.length ? lateRT.reduce((a: number, b: number) => a + b, 0) / lateRT.length : 0
    const responseTimeShift = lateAvgRT - earlyAvgRT

    const allRatings = rows.map((r: any) => Number(r.Rating)).filter((n: number) => !isNaN(n))
    const meanRating = allRatings.length ? allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length : 0
    const ratingVolatility = allRatings.length
      ? allRatings.reduce((s: number, r: number) => s + (r - meanRating) ** 2, 0) / allRatings.length
      : 0

    const bySegment: Record<string, number[]> = {}
    rows.forEach((r: any) => {
      const seg: string = [r.Age, r.Gender].filter((v: any) => v != null).join("|") || "unknown"
      if (!bySegment[seg]) bySegment[seg] = []
      const rating = Number(r.Rating)
      if (!isNaN(rating)) bySegment[seg].push(rating)
    })
    const segmentAvgs = Object.values(bySegment).map((arr) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    )
    const segMean = segmentAvgs.length ? segmentAvgs.reduce((a, b) => a + b, 0) / segmentAvgs.length : 0
    const segmentInconsistency = segmentAvgs.length
      ? segmentAvgs.reduce((s, v) => s + (v - segMean) ** 2, 0) / segmentAvgs.length
      : 0

    const fatigueScore =
      Math.max(0, ratingDecline) * 2 +
      (responseTimeShift > 0 ? Math.min(responseTimeShift, 2) : 0) +
      Math.min(ratingVolatility, 2) * 0.5 +
      Math.min(segmentInconsistency, 2) * 0.5

    const { category, name } = elementKeyToDisplay(key)
    const shortName = name.length > 50 ? name.slice(0, 47) + "…" : name
    let summary: string = ""
    if (ratingDecline > 0.3 && lateAvgRating < earlyAvgRating) {
      summary = "Works first exposure; declines strongly across repeated patterns."
    } else if (responseTimeShift > 0.2) {
      summary = "Slows down over time; possible engagement drop."
    } else if (segmentInconsistency > 0.3) {
      summary = "Segment inconsistency; performance varies by audience."
    } else if (ratingVolatility > 0.5) {
      summary = "Volatile ratings; less predictable long-term."
    } else {
      summary = "Moderate fatigue signals."
    }

    results.push({
      elementKey: key,
      category,
      name,
      shortName,
      ratingDecline,
      earlyAvgRating,
      lateAvgRating,
      responseTimeShift,
      ratingVolatility: Math.sqrt(ratingVolatility),
      segmentInconsistency: Math.sqrt(segmentInconsistency),
      fatigueScore,
      summary,
    })
  }

  results.sort((a, b) => b.fatigueScore - a.fatigueScore)
  return results.slice(0, topN)
}
