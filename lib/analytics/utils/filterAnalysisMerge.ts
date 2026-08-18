/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FilterByCategory, StudyFilterPayload, StudyFilterResponse } from "@/lib/api/ResponseAPI"

type FilterMetric = "Top Down" | "Bottom Up" | "Response Time"

const METRIC_SECTION_KEYS: Record<FilterMetric, string> = {
	"Top Down": "(T) Overall",
	"Bottom Up": "(B) Overall",
	"Response Time": "(R) Overall",
}

function parseCategoryAndElement(key: string): { category: string; element: string } {
	const segments = key.split("-")
	const idx = segments.findIndex((s) => s.includes("."))
	if (idx <= 0) {
		return { category: "Overall", element: key }
	}
	const category = segments.slice(0, idx).join("-")
	const element = segments.slice(idx).join("-")
	return { category, element }
}

function normalizeCoefficientMeansSection(section: any): any {
	if (!section || typeof section !== "object") return null
	const means = section.coefficient_means
	if (!means || typeof means !== "object") return null
	const entries = Object.entries(means) as [string, number][]
	if (entries.length === 0) return null

	const byCategory: Record<string, Array<{ name: string; value: number }>> = {}
	for (const [key, value] of entries) {
		const { category: categoryName, element: elementName } = parseCategoryAndElement(key)
		if (!byCategory[categoryName]) byCategory[categoryName] = []
		byCategory[categoryName].push({ name: elementName, value })
	}
	const categories = Object.entries(byCategory).map(([name, elements]) => ({
		name,
		elements,
	}))
	return { categories }
}

function buildSectionFromByCategory(
	byCategory: FilterByCategory[],
	metric: FilterMetric
): { categories: Array<{ name: string; elements: Array<{ name: string; value: number }> }> } | null {
	if (!byCategory?.length) return null
	const valueKey = metric === "Top Down" ? "top" : metric === "Bottom Up" ? "bottom" : "response"
	const categories = byCategory.map((cat) => ({
		name: cat.category_name,
		elements: (cat.elements || []).map((el) => ({
			name: el.element_name,
			value: typeof (el as any)[valueKey] === "number" ? (el as any)[valueKey] : 0,
			...(el.content ? { content: el.content } : {}),
		})),
	}))
	return { categories }
}

export function buildSectionFromFilterResponse(
	response: StudyFilterResponse,
	metric: FilterMetric
): { categories: Array<{ name: string; elements: Array<{ name: string; value: number }> }> } | null {
	if (response.by_category?.length) {
		return buildSectionFromByCategory(response.by_category, metric)
	}
	const raw =
		metric === "Top Down" ? response.top : metric === "Bottom Up" ? response.bottom : response.response
	if (!raw) return null
	return raw.categories?.length > 0 ? raw : normalizeCoefficientMeansSection(raw)
}

function isFullAnalysisShape(response: StudyFilterResponse): boolean {
	return (
		!!(response as any)["(T) Overall"] ||
		!!(response as any).dashboard_summary ||
		!!(response as any)["Information Block"]
	)
}

function patchDashboardSummary(baseSummary: any, meta: Record<string, any>): any {
	if (!baseSummary || typeof baseSummary !== "object") return baseSummary
	const panelists = meta.panelists_after_filter
	const rows = meta.total_rows_after_filter
	const next = { ...baseSummary }
	if (typeof panelists === "number") {
		next.totalRespondents = panelists
		next.uniquePanelists = panelists
	}
	if (typeof rows === "number") {
		next.totalResponses = rows
	}
	return next
}

/**
 * Merge a filter API response into the base optimized-analysis-json so all analytics views
 * (overview, detail, design configurator) can render segment-specific results.
 */
export function mergeFilterIntoAnalysis(
	baseAnalysis: any,
	filterResponse: StudyFilterResponse,
	appliedFilters?: StudyFilterPayload["filters"]
): any {
	if (!baseAnalysis) return null

	if (isFullAnalysisShape(filterResponse)) {
		const merged = {
			...baseAnalysis,
			...(filterResponse as any),
			"Information Block":
				(filterResponse as any)["Information Block"] ??
				filterResponse.meta?.InformationBlock ??
				baseAnalysis["Information Block"],
			_filterApplied: true,
			_filterMeta: filterResponse.meta ?? {},
			_appliedFilters: appliedFilters ?? {},
		}
		if ((filterResponse as any).dashboard_summary) {
			merged.dashboard_summary = (filterResponse as any).dashboard_summary
		} else if (merged.dashboard_summary && filterResponse.meta) {
			merged.dashboard_summary = patchDashboardSummary(merged.dashboard_summary, filterResponse.meta)
		}
		return merged
	}

	const merged = { ...baseAnalysis }
	const meta = filterResponse.meta ?? {}

	for (const metric of Object.keys(METRIC_SECTION_KEYS) as FilterMetric[]) {
		const section = buildSectionFromFilterResponse(filterResponse, metric)
		if (section?.categories?.length) {
			merged[METRIC_SECTION_KEYS[metric]] = section
		}
	}

	if (meta.InformationBlock) {
		merged["Information Block"] = meta.InformationBlock
	}

	if (merged.dashboard_summary) {
		merged.dashboard_summary = patchDashboardSummary(merged.dashboard_summary, meta)
	}

	merged._filterApplied = true
	merged._filterMeta = meta
	merged._appliedFilters = appliedFilters ?? {}
	return merged
}

export function isEmptyFilterResponse(response: StudyFilterResponse | null | any): boolean {
	if (!response) return true
	const meta = response.filter_meta ?? response.meta ?? {}
	if (meta.error) return true
	if (meta.panelists_after_filter === 0 || meta.total_rows_after_filter === 0) return true

	if ((response["(T) Overall"]?.base_size ?? 0) > 0) return false
	if ((meta.panelists_after_filter ?? 0) > 0) return false

	if (response.by_category?.length) {
		return !response.by_category.some((cat: any) =>
			(cat.elements || []).some(
				(el: any) =>
					typeof el.top === "number" ||
					typeof el.bottom === "number" ||
					typeof el.response === "number"
			)
		)
	}

	const hasSectionData = (section: any) => {
		if (!section || typeof section !== "object") return false
		if (section.categories?.length > 0) return true
		const means = section.coefficient_means
		return means && typeof means === "object" && Object.keys(means).length > 0
	}

	if (isFullAnalysisShape(response)) {
		return !hasSectionData((response as any)["(T) Overall"])
	}

	return (
		!hasSectionData(response.top) &&
		!hasSectionData(response.bottom) &&
		!hasSectionData(response.response)
	)
}

export function describeAppliedFilters(filters?: StudyFilterPayload["filters"] | null): string {
	if (!filters) return ""
	const parts: string[] = []
	if (filters.genders?.length) parts.push(filters.genders.join(", "))
	if (filters.age_groups?.length) parts.push(`Age ${filters.age_groups.join(", ")}`)
	if (filters.classification_filters) {
		for (const [question, answers] of Object.entries(filters.classification_filters)) {
			if (answers?.length) {
				const shortQ = question.length > 40 ? `${question.slice(0, 37)}…` : question
				parts.push(`${shortQ}: ${answers.join(", ")}`)
			}
		}
	}
	return parts.join(" · ")
}

export function buildFilterPayload(
	ageGroups: string[],
	genders: string[],
	classificationFilters: Record<string, string[]>
): StudyFilterPayload["filters"] {
	const filters: NonNullable<StudyFilterPayload["filters"]> = {}
	if (ageGroups.length) filters.age_groups = ageGroups
	if (genders.length) filters.genders = genders
	if (Object.keys(classificationFilters).length) {
		filters.classification_filters = classificationFilters
	}
	return filters
}

function normalizeStringList(values?: string[]): string[] {
	return [...(values ?? [])]
		.map((v) => v.trim())
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

function normalizeClassificationFilters(
	filters?: Record<string, string[]>
): Record<string, string[]> {
	if (!filters) return {}
	const normalized: Record<string, string[]> = {}
	for (const [question, answers] of Object.entries(filters)) {
		const next = normalizeStringList(answers)
		if (next.length) normalized[question] = next
	}
	return Object.fromEntries(
		Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
	)
}

function filterSignature(filters?: StudyFilterPayload["filters"] | null): string {
	const age = normalizeStringList(filters?.age_groups)
	const genders = normalizeStringList(filters?.genders)
	const classification = normalizeClassificationFilters(filters?.classification_filters)
	const classificationPart = Object.entries(classification)
		.map(([question, answers]) => `${question}=${answers.join("\u001f")}`)
		.join("\u001e")
	return `${age.join("\u001f")}\u001d${genders.join("\u001f")}\u001d${classificationPart}`
}

/** True when two filter payloads represent the same segment selection. */
export function filtersEqual(
	a?: StudyFilterPayload["filters"] | null,
	b?: StudyFilterPayload["filters"] | null
): boolean {
	return filterSignature(a) === filterSignature(b)
}

export function hasAnyFilterSelection(filters?: StudyFilterPayload["filters"] | null): boolean {
	if (!filters) return false
	return !!(
		filters.age_groups?.length ||
		filters.genders?.length ||
		Object.values(filters.classification_filters ?? {}).some((arr) => arr.length > 0)
	)
}
