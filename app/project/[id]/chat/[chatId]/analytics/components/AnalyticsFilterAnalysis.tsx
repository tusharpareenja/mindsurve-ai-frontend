"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
	Filter,
	ChevronDown,
	Loader2,
	ChevronRight,
	ChevronLeft,
	Sparkles,
	Users,
	CalendarRange,
	HelpCircle,
	MessageSquareText,
} from "lucide-react"
import { getStudyDetails } from "@/lib/api/StudyAPI"
import type { ClassificationQuestionPayload } from "@/lib/api/StudyAPI"
import {
	postStudyFilter,
	type StudyFilterResponse,
	type StudyFilterPayload,
	type FilterByCategory,
} from "@/lib/api/ResponseAPI"
import { transformAnalysisForView } from "@/lib/utils/analysisTransform"
import { AnalyticsTable } from "./AnalyticsTable"
import { AnalyticsHeatmap } from "./AnalyticsHeatmap"
import { AnalyticsGraph } from "./AnalyticsGraph"
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal"

/** Age groups for Filter Analysis — onboarding step 1 (user-facing list). */
const FILTER_AGE_GROUPS = ["13-18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
const GENDERS = ["Male", "Female"]

const BRAND_BLUE = "#2674BA"
const STEP_COUNT = 3

interface AnalyticsFilterAnalysisProps {
	studyId: string
	studyType: string
	classificationQuestions?: ClassificationQuestionPayload[] | null
	variant?: "wizard" | "scrollable"
	embedded?: boolean
}

function isOpenTextQuestion(q: ClassificationQuestionPayload): boolean {
	const type = (q.question_type || "").toLowerCase()
	return type === "text" || type === "open_text" || type === "open"
}

function FilterChip({
	label,
	selected,
	onClick,
	delay = 0,
}: {
	label: string
	selected: boolean
	onClick: () => void
	delay?: number
}) {
	return (
		<motion.button
			type="button"
			onClick={onClick}
			initial={{ opacity: 0, scale: 0.92 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay, type: "spring", stiffness: 400, damping: 25 }}
			whileHover={{ scale: 1.03 }}
			whileTap={{ scale: 0.98 }}
			className={`cursor-pointer px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2674BA]/40 ${
				selected
					? "text-white border-transparent shadow-md"
					: "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
			}`}
			style={
				selected
					? { backgroundColor: BRAND_BLUE, boxShadow: `0 4px 14px ${BRAND_BLUE}40` }
					: undefined
			}
		>
			{label}
		</motion.button>
	)
}

function FilterSection({
	icon: Icon,
	title,
	subtitle,
	children,
	badge,
}: {
	icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
	title: string
	subtitle: string
	children: React.ReactNode
	badge?: string
}) {
	return (
		<div className="rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/60 p-4 sm:p-5 shadow-sm">
			<div className="flex items-start gap-3 mb-4">
				<div
					className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
					style={{ backgroundColor: `${BRAND_BLUE}14` }}
				>
					<Icon className="w-5 h-5" style={{ color: BRAND_BLUE }} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="text-base font-bold text-gray-900">{title}</h3>
						{badge ? (
							<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
								{badge}
							</span>
						) : null}
					</div>
					<p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
				</div>
			</div>
			{children}
		</div>
	)
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
	metric: "Top Down" | "Bottom Up" | "Response Time"
): { categories: Array<{ name: string; elements: Array<{ name: string; value: number }> }> } | null {
	if (!byCategory?.length) return null
	const valueKey = metric === "Top Down" ? "top" : metric === "Bottom Up" ? "bottom" : "response"
	const categories = byCategory.map((cat) => ({
		name: cat.category_name,
		elements: (cat.elements || []).map((el) => ({
			name: el.element_name,
			value: typeof (el as any)[valueKey] === "number" ? (el as any)[valueKey] : 0,
		})),
	}))
	return { categories }
}

function FilterResultTableByCategory({
	byCategory,
	metric,
	onElementClick,
}: {
	byCategory: FilterByCategory[]
	metric: "Top Down" | "Bottom Up" | "Response Time"
	onElementClick: (contentUrl: string, elementName: string) => void
}) {
	const valueKey = metric === "Top Down" ? "top" : metric === "Bottom Up" ? "bottom" : "response"
	const formatValue = (v: number) =>
		metric === "Response Time" && Math.abs(v) < 1 && v !== 0
			? (Math.round(v * 1000) / 1000).toFixed(3)
			: String(v)

	return (
		<div className="space-y-12 pb-12">
			{byCategory.map((cat) => (
				<div key={cat.category_name} className="space-y-4">
					<h2 className="text-lg font-bold text-gray-900 text-left">{cat.category_name}</h2>
					<div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full text-sm text-left">
								<thead>
									<tr className="bg-gray-50/50 border-b border-gray-100">
										<th className="px-4 md:px-6 py-4 font-medium text-gray-500 min-w-[200px] md:w-[40%]">
											Response
										</th>
										<th className="px-6 py-4 font-medium text-gray-500">Total</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-50">
									{(cat.elements || []).map((el, idx) => {
										const value = typeof (el as any)[valueKey] === "number" ? (el as any)[valueKey] : 0
										const hasContent = !!el.content && el.content.startsWith("http")
										return (
											<tr key={idx} className="hover:bg-gray-50 transition-colors">
												<td className="px-4 md:px-6 py-4 text-gray-700 font-medium text-xs md:text-sm">
													{hasContent ? (
														<button
															type="button"
															onClick={() => onElementClick(el.content, el.element_name)}
															className="cursor-pointer underline text-left hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#2674BA]/30 rounded"
															style={{ color: BRAND_BLUE }}
														>
															{el.element_name}
														</button>
													) : (
														<span>{el.element_name}</span>
													)}
												</td>
												<td className="px-6 py-4 text-gray-900 font-medium">
													{formatValue(value)}
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			))}
		</div>
	)
}

function buildAnalysisFromFilterResponse(
	response: StudyFilterResponse | null,
	metric: "Top Down" | "Bottom Up" | "Response Time"
): any {
	if (!response) return null
	const key =
		metric === "Top Down"
			? "(T) Overall"
			: metric === "Bottom Up"
				? "(B) Overall"
				: "(R) Overall"
	if (response.by_category?.length) {
		const section = buildSectionFromByCategory(response.by_category, metric)
		if (section?.categories?.length)
			return { [key]: section, "Information Block": response.meta?.InformationBlock ?? {} }
	}
	const raw =
		metric === "Top Down" ? response.top : metric === "Bottom Up" ? response.bottom : response.response
	if (!raw) return null
	const section =
		raw.categories?.length > 0 ? raw : normalizeCoefficientMeansSection(raw)
	if (!section?.categories?.length) return null
	return { [key]: section, "Information Block": response.meta?.InformationBlock ?? {} }
}

const slideVariants = {
	enter: (direction: number) => ({
		opacity: 0,
		x: direction > 0 ? 24 : -24,
		filter: "blur(4px)",
	}),
	center: {
		opacity: 1,
		x: 0,
		filter: "blur(0px)",
		transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const },
	},
	exit: (direction: number) => ({
		opacity: 0,
		x: direction > 0 ? -24 : 24,
		filter: "blur(4px)",
		transition: { duration: 0.25 },
	}),
}

const loadingMessages = [
	"Applying your filters…",
	"Building segment insights…",
	"Crunching the numbers…",
	"Almost there…",
]

export const AnalyticsFilterAnalysis: React.FC<AnalyticsFilterAnalysisProps> = ({
	studyId,
	studyType,
	classificationQuestions: classificationQuestionsProp,
	variant = "wizard",
	embedded = false,
}) => {
	const [classificationQuestionsFetched, setClassificationQuestionsFetched] = useState<
		ClassificationQuestionPayload[]
	>([])
	const hasProp = classificationQuestionsProp != null
	const [loadingStudy, setLoadingStudy] = useState(hasProp === false)
	const classificationQuestions = hasProp ? classificationQuestionsProp : classificationQuestionsFetched

	const [step, setStep] = useState(1)
	const [direction, setDirection] = useState(0)
	const [ageGroups, setAgeGroups] = useState<string[]>([])
	const [genders, setGenders] = useState<string[]>([])
	const [classificationFilters, setClassificationFilters] = useState<Record<string, string[]>>({})
	const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
	const [filterResult, setFilterResult] = useState<StudyFilterResponse | null>(null)
	const [filterLoading, setFilterLoading] = useState(false)
	const [filterError, setFilterError] = useState<string | null>(null)
	const [hasAppliedFilter, setHasAppliedFilter] = useState(false)
	const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
	const [innerTab, setInnerTab] = useState<"Top Down" | "Bottom Up" | "Response Time">("Top Down")
	const [innerView, setInnerView] = useState<"table" | "heatmap" | "graph">("table")
	const [lightbox, setLightbox] = useState<{ isOpen: boolean; src: string | null; alt: string }>({
		isOpen: false,
		src: null,
		alt: "",
	})

	const openLightbox = useCallback((src: string, alt: string) => {
		setLightbox({ isOpen: true, src, alt })
	}, [])
	const closeLightbox = useCallback(() => {
		setLightbox((prev) => ({ ...prev, isOpen: false }))
	}, [])

	useEffect(() => {
		if (!studyId || hasProp) return
		setLoadingStudy(true)
		getStudyDetails(studyId)
			.then((study) => {
				setClassificationQuestionsFetched(study?.classification_questions ?? [])
			})
			.catch(() => setClassificationQuestionsFetched([]))
			.finally(() => setLoadingStudy(false))
	}, [studyId, hasProp])

	useEffect(() => {
		if (!filterLoading) return
		const id = setInterval(() => {
			setLoadingMessageIndex((i) => (i + 1) % loadingMessages.length)
		}, 2200)
		return () => clearInterval(id)
	}, [filterLoading])

	const goNext = useCallback(() => {
		setDirection(1)
		setStep((s) => Math.min(s + 1, STEP_COUNT))
	}, [])
	const goBack = useCallback(() => {
		setDirection(-1)
		setStep((s) => Math.max(s - 1, 1))
	}, [])

	const toggleAge = (age: string) => {
		setAgeGroups((prev) =>
			prev.includes(age) ? prev.filter((a) => a !== age) : [...prev, age]
		)
	}
	const toggleGender = (g: string) => {
		setGenders((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
	}
	const toggleClassificationOption = (questionText: string, optionText: string) => {
		setClassificationFilters((prev) => {
			const arr = prev[questionText] ?? []
			const next = arr.includes(optionText)
				? arr.filter((x) => x !== optionText)
				: [...arr, optionText]
			if (next.length === 0) {
				const { [questionText]: _, ...rest } = prev
				return rest
			}
			return { ...prev, [questionText]: next }
		})
	}
	const toggleQuestionExpanded = (questionId: string) => {
		setExpandedQuestions((prev) => {
			const next = new Set(prev)
			if (next.has(questionId)) next.delete(questionId)
			else next.add(questionId)
			return next
		})
	}

	const handleApplyFilter = async () => {
		setFilterError(null)
		setFilterLoading(true)
		setHasAppliedFilter(true)
		try {
			const filters: StudyFilterPayload["filters"] = {}
			if (ageGroups.length) filters.age_groups = ageGroups
			if (genders.length) filters.genders = genders
			if (Object.keys(classificationFilters).length)
				filters.classification_filters = classificationFilters
			const res = await postStudyFilter(studyId, {
				filters,
				include_per_panelist: false,
			})
			setFilterResult(res)
		} catch (e) {
			setFilterError((e as Error)?.message ?? "Filter request failed")
			setFilterResult(null)
		} finally {
			setFilterLoading(false)
		}
	}

	const isEmptyResult = useMemo(() => {
		if (!hasAppliedFilter || !filterResult) return false
		const meta = filterResult.meta ?? {}
		if (meta.error) return true
		if (meta.total_rows_after_filter === 0 || meta.panelists_after_filter === 0) return true
		const hasSectionData = (section: any) => {
			if (!section || typeof section !== "object") return false
			if (section.categories?.length > 0) return true
			const means = section.coefficient_means
			return means && typeof means === "object" && Object.keys(means).length > 0
		}
		const byCat = filterResult.by_category
		if (byCat?.length) {
			const hasAnyValue = byCat.some((cat) =>
				(cat.elements || []).some(
					(el: any) =>
						typeof el.top === "number" ||
						typeof el.bottom === "number" ||
						typeof el.response === "number"
				)
			)
			if (!hasAnyValue) return true
			return false
		}
		return !hasSectionData(filterResult.top) && !hasSectionData(filterResult.bottom) && !hasSectionData(filterResult.response)
	}, [hasAppliedFilter, filterResult])

	const analysisForMetric = useMemo(
		() => buildAnalysisFromFilterResponse(filterResult, innerTab),
		[filterResult, innerTab]
	)
	const { categories } = useMemo(
		() => transformAnalysisForView(analysisForMetric ?? {}, innerTab, "Overall"),
		[analysisForMetric, innerTab]
	)
	const hasData = categories.length > 0

	const elementContentMap = useMemo(() => {
		const byCat = filterResult?.by_category
		if (!byCat?.length) return undefined
		const map: Record<string, string> = {}
		for (const cat of byCat) {
			for (const el of cat.elements || []) {
				if (el.content) map[`${cat.category_name}|${el.element_name}`] = el.content
			}
		}
		return Object.keys(map).length ? map : undefined
	}, [filterResult?.by_category])

	const resetToFilters = useCallback(() => {
		setHasAppliedFilter(false)
		if (variant === "wizard") {
			setStep(1)
			setDirection(0)
		}
	}, [variant])

	const activeFilterCount =
		genders.length +
		ageGroups.length +
		Object.values(classificationFilters).reduce((sum, arr) => sum + arr.length, 0)

	const scrollableFilterPanel = (
		<div className="space-y-4">
			<FilterSection
				icon={Users}
				title="Gender"
				subtitle="Choose who to include in your segment. Leave empty to include all."
			>
				<div className="flex flex-wrap gap-2">
					{GENDERS.map((g, i) => (
						<FilterChip
							key={g}
							label={g}
							selected={genders.includes(g)}
							onClick={() => toggleGender(g)}
							delay={i * 0.03}
						/>
					))}
				</div>
			</FilterSection>

			<FilterSection
				icon={CalendarRange}
				title="Age Group"
				subtitle="Select one or more age ranges. Leave empty to include all ages."
			>
				<div className="flex flex-wrap gap-2">
					{FILTER_AGE_GROUPS.map((age, i) => (
						<FilterChip
							key={age}
							label={age}
							selected={ageGroups.includes(age)}
							onClick={() => toggleAge(age)}
							delay={i * 0.02}
						/>
					))}
				</div>
			</FilterSection>

			{classificationQuestions.length > 0 ? (
				classificationQuestions.map((q: any, qIdx: number) => {
					const isOpen = isOpenTextQuestion(q)
					const options = (q.answer_options ?? []) as Array<{ id?: string; text?: string }>
					const questionText = String(q.question_text || "")
					const selected = classificationFilters[questionText] ?? []
					return (
						<FilterSection
							key={q.question_id || questionText}
							icon={isOpen ? MessageSquareText : HelpCircle}
							title={questionText}
							subtitle={
								isOpen
									? "Open-ended response — shown for context; filter by choice-based answers below."
									: "Select one or more answers to narrow your segment."
							}
							badge={isOpen ? "Open question" : undefined}
						>
							{isOpen ? (
								<div className="rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-500">
									Responses to this question are free text and are not used as filter criteria.
								</div>
							) : options.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{options.map((opt: any, oIdx: number) => {
										const label = String(opt.text || "")
										return (
										<FilterChip
											key={opt.id || label}
											label={label}
											selected={selected.includes(label)}
											onClick={() => toggleClassificationOption(questionText, label)}
											delay={qIdx * 0.02 + oIdx * 0.02}
										/>
										)
									})}
								</div>
							) : (
								<p className="text-sm text-gray-500">No answer options configured.</p>
							)}
						</FilterSection>
					)
				})
			) : (
				<FilterSection
					icon={HelpCircle}
					title="Classification Questions"
					subtitle="No classification questions are configured for this study."
				>
					<p className="text-sm text-gray-500">Add classification questions in study setup to filter by them here.</p>
				</FilterSection>
			)}
		</div>
	)

	// Show filter panel only when not yet applied or no result yet; hide during filter loading
	const showFilterPanel = !filterLoading && (!hasAppliedFilter || !filterResult)
	const isScrollable = variant === "scrollable"

	return (
		<div className={`${embedded ? "" : "space-y-8"} transition-opacity duration-200`}>
			{/* Filter panel — wizard or scrollable */}
			{!filterLoading && (showFilterPanel || loadingStudy) && (
			<div className={embedded ? "" : "bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden"}>
				{!isScrollable && (
				<div className="h-1 bg-gray-100 flex">
					<motion.div
						className="h-full rounded-r"
						style={{ backgroundColor: BRAND_BLUE }}
						initial={false}
						animate={{ width: `${(step / STEP_COUNT) * 100}%` }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
					/>
				</div>
				)}

				<div className={embedded ? "" : "px-6 sm:px-8 py-6 sm:py-8 min-h-[320px]"}>
					{loadingStudy && (
						<div className="flex items-center justify-center gap-3 text-gray-500 py-12">
							<Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND_BLUE }} />
							<span className="text-sm font-medium">Loading study questions…</span>
						</div>
					)}

					{!loadingStudy && showFilterPanel && isScrollable && (
						<div className="space-y-5">
							<div className="max-h-[min(52vh,520px)] overflow-y-auto pr-1 sm:pr-2 -mr-1 sm:-mr-2 scrollbar-thin">
								{scrollableFilterPanel}
							</div>
							<div className="sticky bottom-0 pt-2 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3">
									<p className="text-xs text-gray-500">
										{activeFilterCount > 0
											? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} selected`
											: "No filters selected — all respondents will be included"}
									</p>
									<motion.button
										type="button"
										onClick={handleApplyFilter}
										disabled={filterLoading}
										whileHover={!filterLoading ? { scale: 1.02 } : undefined}
										whileTap={!filterLoading ? { scale: 0.98 } : undefined}
										className="cursor-pointer inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-80 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2674BA]/40"
										style={{
											backgroundColor: BRAND_BLUE,
											boxShadow: `0 8px 28px ${BRAND_BLUE}45`,
										}}
									>
										<Filter className="w-4 h-4" />
										Apply Filter
									</motion.button>
								</div>
								{filterError && (
									<p className="text-sm text-red-600 mt-2" role="alert">
										{filterError}
									</p>
								)}
							</div>
						</div>
					)}

					{!loadingStudy && showFilterPanel && !isScrollable && (
						<AnimatePresence mode="wait" custom={direction}>
							{step === 1 && (
								<motion.div
									key="step1"
									custom={direction}
									variants={slideVariants}
									initial="enter"
									animate="center"
									exit="exit"
									className="space-y-8"
								>
									<div>
										<motion.p
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.1 }}
											className="text-sm font-medium text-gray-500 uppercase tracking-wider"
										>
											Step 1 of 3
										</motion.p>
										<motion.h2
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.15 }}
											className="text-xl sm:text-2xl font-bold text-gray-900 mt-1"
										>
											Which age group would you like to analyze?
										</motion.h2>
										<motion.p
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.2 }}
											className="text-gray-500 text-sm mt-2"
										>
											Select one or more — leave empty to include all ages.
										</motion.p>
									</div>
									<div className="flex flex-wrap gap-3">
										{FILTER_AGE_GROUPS.map((age, i) => {
											const selected = ageGroups.includes(age)
											return (
												<motion.button
													key={age}
													type="button"
													onClick={() => toggleAge(age)}
													initial={{ opacity: 0, scale: 0.92 }}
													animate={{ opacity: 1, scale: 1 }}
													transition={{ delay: 0.25 + i * 0.04, type: "spring", stiffness: 400, damping: 25 }}
													whileHover={{ scale: 1.03 }}
													whileTap={{ scale: 0.98 }}
													className={`cursor-pointer relative px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white ${
														selected
															? "text-white border-transparent shadow-md"
															: "bg-gray-50/80 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
													}`}
													style={
														selected
															? { backgroundColor: BRAND_BLUE, boxShadow: `0 4px 14px ${BRAND_BLUE}40` }
															: undefined
													}
												>
													{age}
												</motion.button>
											)
										})}
									</div>
									<div className="flex justify-end pt-4">
										<motion.button
											type="button"
											onClick={goNext}
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.98 }}
											className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-md transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white"
											style={{ backgroundColor: BRAND_BLUE }}
										>
											Next
											<ChevronRight className="w-4 h-4" />
										</motion.button>
									</div>
								</motion.div>
							)}

							{step === 2 && (
								<motion.div
									key="step2"
									custom={direction}
									variants={slideVariants}
									initial="enter"
									animate="center"
									exit="exit"
									className="space-y-8"
								>
									<div>
										<motion.p
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											className="text-sm font-medium text-gray-500 uppercase tracking-wider"
										>
											Step 2 of 3
										</motion.p>
										<motion.h2
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.05 }}
											className="text-xl sm:text-2xl font-bold text-gray-900 mt-1"
										>
											Gender selection
										</motion.h2>
										<motion.p
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.1 }}
											className="text-gray-500 text-sm mt-2"
										>
											Choose who to include in your segment.
										</motion.p>
									</div>
									<div className="grid grid-cols-2 gap-4 max-w-md">
										{GENDERS.map((g, i) => {
											const selected = genders.includes(g)
											return (
												<motion.button
													key={g}
													type="button"
													onClick={() => toggleGender(g)}
													initial={{ opacity: 0, y: 12 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 400, damping: 28 }}
													whileHover={{ scale: 1.02, y: -2 }}
													whileTap={{ scale: 0.98 }}
													className={`cursor-pointer relative px-6 py-5 rounded-xl border-2 text-base font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white ${
														selected
															? "text-white border-transparent shadow-lg"
															: "bg-gray-50/80 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
													}`}
													style={
														selected
															? { backgroundColor: BRAND_BLUE, boxShadow: `0 8px 24px ${BRAND_BLUE}35` }
															: undefined
													}
												>
													{g}
												</motion.button>
											)
										})}
									</div>
									<div className="flex items-center justify-between pt-4">
										<motion.button
											type="button"
											onClick={goBack}
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.98 }}
											className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
										>
											<ChevronLeft className="w-4 h-4" />
											Back
										</motion.button>
										<motion.button
											type="button"
											onClick={goNext}
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.98 }}
											className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white"
											style={{ backgroundColor: BRAND_BLUE }}
										>
											Next
											<ChevronRight className="w-4 h-4" />
										</motion.button>
									</div>
								</motion.div>
							)}

							{step === 3 && (
								<motion.div
									key="step3"
									custom={direction}
									variants={slideVariants}
									initial="enter"
									animate="center"
									exit="exit"
									className="space-y-6"
								>
									<div>
										<motion.p
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											className="text-sm font-medium text-gray-500 uppercase tracking-wider"
										>
											Step 3 of 3
										</motion.p>
										<motion.h2
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.05 }}
											className="text-xl sm:text-2xl font-bold text-gray-900 mt-1"
										>
											Classification filters
										</motion.h2>
										<motion.p
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.1 }}
											className="text-gray-500 text-sm mt-2"
										>
											Select questions, then pick the answers to filter by. Optional.
										</motion.p>
									</div>

									{classificationQuestions.length > 0 ? (
										<div className="space-y-3">
											{classificationQuestions.map((q: any, qIdx: number) => {
												const questionId = String(q.question_id || q.question_text || qIdx)
												const questionText = String(q.question_text || "")
												const isExpanded = expandedQuestions.has(questionId)
												const options = (q.answer_options ?? []) as Array<{ id?: string; text?: string }>
												const selected = classificationFilters[questionText] ?? []
												return (
													<motion.div
														key={questionId}
														initial={{ opacity: 0, y: 8 }}
														animate={{ opacity: 1, y: 0 }}
														transition={{ delay: 0.12 + qIdx * 0.05 }}
														className="rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50/50"
													>
														<button
															type="button"
															onClick={() => toggleQuestionExpanded(questionId)}
															className="cursor-pointer w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2674BA]/30"
														>
															<span className="text-sm font-semibold text-gray-800 pr-2">
																{questionText}
															</span>
															<motion.div
																animate={{ rotate: isExpanded ? 180 : 0 }}
																transition={{ duration: 0.25 }}
															>
																<ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
															</motion.div>
														</button>
														<AnimatePresence>
															{isExpanded && (
																<motion.div
																	initial={{ height: 0, opacity: 0 }}
																	animate={{ height: "auto", opacity: 1 }}
																	exit={{ height: 0, opacity: 0 }}
																	transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
																	className="overflow-hidden"
																>
																	<div className="px-4 pb-4 pt-1 flex flex-wrap gap-2">
																		{options.map((opt: any, oIdx: number) => {
																			const label = String(opt.text || "")
																			const isOptSelected = selected.includes(label)
																			return (
																				<motion.button
																					key={opt.id || label}
																					type="button"
																					onClick={() =>
																						toggleClassificationOption(questionText, label)
																					}
																					initial={{ opacity: 0, scale: 0.9 }}
																					animate={{ opacity: 1, scale: 1 }}
																					transition={{ delay: 0.05 * oIdx }}
																					whileHover={{ scale: 1.03 }}
																					whileTap={{ scale: 0.97 }}
																					className={`cursor-pointer px-3.5 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
																						isOptSelected
																							? "text-white border-transparent"
																							: "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
																					}`}
																					style={
																						isOptSelected ? { backgroundColor: BRAND_BLUE } : undefined
																					}
																				>
																					{label}
																				</motion.button>
																			)
																		})}
																	</div>
																</motion.div>
															)}
														</AnimatePresence>
													</motion.div>
												)
											})}
										</div>
									) : (
										<p className="text-sm text-gray-500 py-4">No classification questions for this study.</p>
									)}

									<div className="flex items-center justify-between pt-4">
										<motion.button
											type="button"
											onClick={goBack}
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.98 }}
											className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
										>
											<ChevronLeft className="w-4 h-4" />
											Back
										</motion.button>
										<motion.button
											type="button"
											onClick={handleApplyFilter}
											disabled={filterLoading}
											whileHover={!filterLoading ? { scale: 1.02 } : undefined}
											whileTap={!filterLoading ? { scale: 0.98 } : undefined}
											className="cursor-pointer inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-80 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white"
											style={{
												backgroundColor: BRAND_BLUE,
												boxShadow: `0 8px 28px ${BRAND_BLUE}45`,
											}}
										>
											<Filter className="w-4 h-4" />
											Apply Filter
										</motion.button>
									</div>
									{filterError && (
										<p className="text-sm text-red-600 mt-2" role="alert">
											{filterError}
										</p>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					)}
				</div>
			</div>
			)}

			{/* Premium loading state */}
			{hasAppliedFilter && filterLoading && (
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.35 }}
					className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden"
				>
					<div className="p-8 sm:p-12">
						<div className="flex flex-col items-center text-center max-w-md mx-auto">
							<div className="relative w-20 h-20 rounded-full flex items-center justify-center mb-6">
								{/* Pulsing dots around the symbol */}
								{[0, 1, 2, 3, 4, 5].map((i) => (
									<div
										key={i}
										className="absolute top-1/2 left-1/2 w-2 h-2 -ml-1 -mt-1"
										style={{
											transform: `rotate(${i * 60}deg) translateY(-28px)`,
										}}
									>
										<motion.span
											className="block w-2 h-2 rounded-full"
											style={{ backgroundColor: BRAND_BLUE }}
											animate={{
												opacity: [0.3, 0.9, 0.3],
												scale: [0.8, 1.2, 0.8],
											}}
											transition={{
												duration: 1.2,
												repeat: Infinity,
												delay: i * 0.12,
											}}
										/>
									</div>
								))}
								<motion.div
									animate={{ rotate: 360 }}
									transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
									className="absolute inset-0 rounded-full border-2 border-gray-200 border-t-transparent"
									style={{ borderTopColor: BRAND_BLUE }}
								/>
								<motion.div
									animate={{ opacity: [0.7, 1, 0.7] }}
									transition={{ repeat: Infinity, duration: 1.5 }}
									className="relative z-10"
								>
									<Sparkles className="w-6 h-6" style={{ color: BRAND_BLUE }} />
								</motion.div>
							</div>
							<p className="text-lg font-semibold text-gray-800 transition-opacity duration-300">
								{loadingMessages[loadingMessageIndex]}
							</p>
							<p className="text-sm text-gray-500 mt-1">Building your segment analysis…</p>
							{/* Skeleton blocks */}
							<div className="w-full mt-8 space-y-4">
								{[1, 2, 3].map((i) => (
									<motion.div
										key={i}
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ delay: i * 0.1 }}
										className="h-12 rounded-xl bg-gray-100 overflow-hidden"
									>
										<motion.div
											className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent"
											animate={{ x: ["-100%", "200%"] }}
											transition={{ repeat: Infinity, duration: 1.8, delay: i * 0.2 }}
										/>
									</motion.div>
								))}
							</div>
						</div>
					</div>
				</motion.div>
			)}

			{/* Results panel — after loading completes */}
			{hasAppliedFilter && !filterLoading && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
					className={embedded ? "mt-4" : "bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"}
				>
					{isEmptyResult ? (
						<div className="flex flex-col items-center justify-center py-16 px-6">
							<p className="text-center text-gray-600 font-medium">
								{(filterResult?.meta as any)?.error ?? "There is no response for the selected segment."}
							</p>
							<p className="text-sm text-gray-500 mt-2">
								Try different age, gender, or classification filters.
							</p>
							<motion.button
								type="button"
								onClick={resetToFilters}
								className="cursor-pointer mt-6 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
								style={{ backgroundColor: BRAND_BLUE }}
							>
								Adjust filters
							</motion.button>
						</div>
					) : filterResult && hasData ? (
						<>
							<div className="border-b border-gray-200 bg-gray-50/50 px-4">
								<div className="flex flex-wrap items-center justify-between gap-2 pt-2 pb-2">
									<div className="flex gap-1">
									{(["Top Down", "Bottom Up", "Response Time"] as const).map((tab) => (
										<button
											key={tab}
											type="button"
											onClick={() => setInnerTab(tab)}
											className={`cursor-pointer relative px-4 py-3 text-sm font-semibold transition-colors ${
												innerTab === tab ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
											}`}
										>
											{tab}
											{innerTab === tab && (
												<div
													className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
													style={{ backgroundColor: BRAND_BLUE }}
												/>
											)}
										</button>
									))}
									</div>
									<motion.button
										type="button"
										onClick={resetToFilters}
										whileHover={{ scale: 1.02 }}
										whileTap={{ scale: 0.98 }}
										className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200/80 transition-colors"
									>
										<Filter className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
										Refine filters
									</motion.button>
								</div>
							</div>
							<div className="px-4 py-3 border-b border-gray-100 flex gap-2">
								{(["table", "heatmap", "graph"] as const).map((view) => (
									<button
										key={view}
										type="button"
										onClick={() => setInnerView(view)}
										className={`cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
											innerView === view
												? "text-white"
												: "bg-gray-100 text-gray-600 hover:bg-gray-200"
										}`}
										style={
											innerView === view ? { backgroundColor: BRAND_BLUE } : undefined
										}
									>
										{view}
									</button>
								))}
							</div>
							<div className="p-6">
								{innerView === "table" &&
									(filterResult.by_category?.length ? (
										<FilterResultTableByCategory
											byCategory={filterResult.by_category}
											metric={innerTab}
											onElementClick={openLightbox}
										/>
									) : (
										<AnalyticsTable
											analysisData={analysisForMetric}
											activeMetric={innerTab}
											activeTab="Overall"
											studyType={studyType}
										/>
									))}
								{innerView === "heatmap" && (
									<AnalyticsHeatmap
										analysisData={analysisForMetric}
										activeMetric={innerTab}
										activeTab="Overall"
										studyType={studyType}
										elementContentMap={elementContentMap}
										onElementClick={openLightbox}
									/>
								)}
								{innerView === "graph" && (
									<AnalyticsGraph
										analysisData={analysisForMetric}
										activeMetric={innerTab}
										activeTab="Overall"
										studyType={studyType}
										elementContentMap={elementContentMap}
										onElementClick={openLightbox}
									/>
								)}
							</div>
						</>
					) : hasAppliedFilter && filterResult && !hasData ? (
						<div className="flex flex-col items-center justify-center py-16 px-6">
							<p className="text-center text-gray-600 font-medium">
								{(filterResult?.meta as any)?.error ?? "There is no response for the selected segment."}
							</p>
							<p className="text-sm text-gray-500 mt-2">
								Try different age, gender, or classification filters.
							</p>
							<motion.button
								type="button"
								onClick={resetToFilters}
								className="cursor-pointer mt-6 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
								style={{ backgroundColor: BRAND_BLUE }}
							>
								Adjust filters
							</motion.button>
						</div>
					) : null}
				</motion.div>
			)}

			<ImageLightboxModal
				src={lightbox.src}
				alt={lightbox.alt}
				isOpen={lightbox.isOpen}
				onClose={closeLightbox}
			/>
		</div>
	)
}
