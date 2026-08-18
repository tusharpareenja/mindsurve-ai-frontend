"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Filter, Loader2, Users, CalendarRange, HelpCircle, MessageSquareText } from "lucide-react"
import { getStudyDetails } from "@/lib/api/StudyAPI"
import type { ClassificationQuestionPayload } from "@/lib/api/StudyAPI"
import type { SavedFilterReport, StudyFilterPayload } from "@/lib/api/ResponseAPI"
import { buildFilterPayload, describeAppliedFilters, filtersEqual } from "@/lib/utils/filterAnalysisMerge"

const FILTER_AGE_GROUPS = ["13-18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
const GENDERS = ["Male", "Female"]
const BRAND_BLUE = "#2674BA"

function isOpenTextQuestion(q: ClassificationQuestionPayload): boolean {
	const type = (q.question_type || "").toLowerCase()
	return type === "text" || type === "open_text" || type === "open"
}

function FilterChip({
	label,
	selected,
	onClick,
}: {
	label: string
	selected: boolean
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`cursor-pointer px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2674BA]/40 ${
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
		</button>
	)
}

function FilterSection({
	icon: Icon,
	title,
	subtitle,
	children,
	badge,
	headerAction,
	hideSubtitleOnMobile = false,
}: {
	icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
	title: string
	subtitle: string
	children: React.ReactNode
	badge?: string
	headerAction?: React.ReactNode
	hideSubtitleOnMobile?: boolean
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
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2 flex-wrap">
								<h3 className="text-base font-bold text-gray-900">{title}</h3>
								{badge ? (
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
										{badge}
									</span>
								) : null}
							</div>
							<p
								className={`text-sm text-gray-500 mt-0.5 ${hideSubtitleOnMobile ? "hidden lg:block" : ""}`}
							>
								{subtitle}
							</p>
						</div>
						{headerAction ? <div className="shrink-0">{headerAction}</div> : null}
					</div>
				</div>
			</div>
			{children}
		</div>
	)
}

function QuestionFilterActions({
	allSelected,
	someSelected,
	selectedCount,
	onSelectAll,
	onClearAll,
	disabled,
}: {
	allSelected: boolean
	someSelected: boolean
	selectedCount: number
	onSelectAll: () => void
	onClearAll: () => void
	disabled?: boolean
}) {
	return (
		<div className="flex flex-col items-end gap-1.5">
			<div className="flex items-center gap-3">
				<SelectAllCheckbox
					checked={allSelected}
					indeterminate={someSelected}
					onChange={onSelectAll}
					disabled={disabled}
				/>
				{selectedCount > 0 ? (
					<button
						type="button"
						onClick={onClearAll}
						disabled={disabled}
						className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Clear all
					</button>
				) : null}
			</div>
		</div>
	)
}

function SelectAllCheckbox({
	checked,
	indeterminate,
	onChange,
	disabled,
}: {
	checked: boolean
	indeterminate: boolean
	onChange: () => void
	disabled?: boolean
}) {
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.indeterminate = indeterminate
		}
	}, [indeterminate])

	return (
		<label
			className={`inline-flex items-center gap-2 cursor-pointer select-none ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
		>
			<input
				ref={inputRef}
				type="checkbox"
				checked={checked}
				onChange={onChange}
				disabled={disabled}
				className="h-4 w-4 rounded border-gray-300 text-[#2674BA] focus:ring-[#2674BA]/40 cursor-pointer disabled:cursor-not-allowed"
			/>
			<span className="text-xs font-semibold text-[#2674BA] whitespace-nowrap">Select all</span>
		</label>
	)
}

interface AnalyticsAdvancedFilterPanelProps {
	studyId: string
	classificationQuestions?: ClassificationQuestionPayload[] | null
	initialFilters?: StudyFilterPayload["filters"] | null
	savedReports?: SavedFilterReport[]
	onRunAnalysis: (filters: StudyFilterPayload["filters"]) => void
	onSaveAndRun?: (name: string, filters: StudyFilterPayload["filters"]) => void | Promise<void>
	onCancel?: () => void
	isRunning?: boolean
	error?: string | null
	saveError?: string | null
}

function applyInitialFilters(initialFilters?: StudyFilterPayload["filters"] | null) {
	return {
		ageGroups: [...(initialFilters?.age_groups ?? [])],
		genders: [...(initialFilters?.genders ?? [])],
		classificationFilters: { ...(initialFilters?.classification_filters ?? {}) },
	}
}

export function AnalyticsAdvancedFilterPanel({
	studyId,
	classificationQuestions: classificationQuestionsProp,
	initialFilters = null,
	savedReports = [],
	onRunAnalysis,
	onSaveAndRun,
	onCancel,
	isRunning = false,
	error = null,
	saveError = null,
}: AnalyticsAdvancedFilterPanelProps) {
	const [classificationQuestionsFetched, setClassificationQuestionsFetched] = useState<
		ClassificationQuestionPayload[]
	>([])
	const hasProp = classificationQuestionsProp != null
	const [loadingStudy, setLoadingStudy] = useState(hasProp === false)
	const classificationQuestions = hasProp ? classificationQuestionsProp : classificationQuestionsFetched

	const [ageGroups, setAgeGroups] = useState<string[]>(() => applyInitialFilters(initialFilters).ageGroups)
	const [genders, setGenders] = useState<string[]>(() => applyInitialFilters(initialFilters).genders)
	const [classificationFilters, setClassificationFilters] = useState<Record<string, string[]>>(
		() => applyInitialFilters(initialFilters).classificationFilters
	)
	const [saveStepOpen, setSaveStepOpen] = useState(false)
	const [reportName, setReportName] = useState("")
	const [localSaveError, setLocalSaveError] = useState<string | null>(null)

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

	const toggleAge = (age: string) => {
		setAgeGroups((prev) => (prev.includes(age) ? prev.filter((a) => a !== age) : [...prev, age]))
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

	const toggleSelectAllForQuestion = (questionText: string, optionTexts: string[]) => {
		setClassificationFilters((prev) => {
			const current = prev[questionText] ?? []
			const allSelected =
				optionTexts.length > 0 && optionTexts.every((text) => current.includes(text))
			if (allSelected) {
				const { [questionText]: _, ...rest } = prev
				return rest
			}
			return { ...prev, [questionText]: [...optionTexts] }
		})
	}

	const clearQuestionSelections = (questionText: string) => {
		setClassificationFilters((prev) => {
			const { [questionText]: _, ...rest } = prev
			return rest
		})
	}

	const handleClearAllFilters = () => {
		setAgeGroups([])
		setGenders([])
		setClassificationFilters({})
	}

	const handleRunAnalysis = useCallback(() => {
		setSaveStepOpen(false)
		setLocalSaveError(null)
		onRunAnalysis(buildFilterPayload(ageGroups, genders, classificationFilters))
	}, [ageGroups, genders, classificationFilters, onRunAnalysis])

	const openSaveStep = useCallback(() => {
		const filters = buildFilterPayload(ageGroups, genders, classificationFilters)
		const defaultName = describeAppliedFilters(filters) || "Custom report"
		setReportName(defaultName.slice(0, 255))
		setLocalSaveError(null)
		setSaveStepOpen(true)
	}, [ageGroups, genders, classificationFilters])

	const handleSaveAndRun = useCallback(async () => {
		const filters = buildFilterPayload(ageGroups, genders, classificationFilters)
		const trimmed = reportName.trim()
		if (!trimmed) {
			setLocalSaveError("Please enter a report name.")
			return
		}
		const duplicate = savedReports.find((r) => filtersEqual(r.filters, filters))
		if (duplicate) {
			setLocalSaveError(`This filter is already saved as "${duplicate.name}".`)
			return
		}
		if (!onSaveAndRun) return
		setLocalSaveError(null)
		await onSaveAndRun(trimmed, filters)
	}, [ageGroups, genders, classificationFilters, reportName, savedReports, onSaveAndRun])

	const draftFilters = useMemo(
		() => buildFilterPayload(ageGroups, genders, classificationFilters),
		[ageGroups, genders, classificationFilters]
	)

	const filtersUnchanged = useMemo(
		() => filtersEqual(draftFilters, initialFilters),
		[draftFilters, initialFilters]
	)

	const activeFilterCount =
		genders.length +
		ageGroups.length +
		Object.values(classificationFilters).reduce((sum, arr) => sum + arr.length, 0)

	if (loadingStudy) {
		return (
			<div className="flex items-center justify-center gap-3 text-gray-500 py-12">
				<Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND_BLUE }} />
				<span className="text-sm font-medium">Loading study questions…</span>
			</div>
		)
	}

	return (
		<div className="space-y-5">
			<div className="pr-0 sm:pr-2 sm:-mr-2 sm:max-h-[min(52vh,520px)] sm:overflow-y-auto">
				<div className="space-y-4">
					<FilterSection
						icon={Users}
						title="Gender"
						subtitle="Choose who to include in your segment. Leave empty to include all."
					>
						<div className="flex flex-wrap gap-2">
							{GENDERS.map((g) => (
								<FilterChip
									key={g}
									label={g}
									selected={genders.includes(g)}
									onClick={() => toggleGender(g)}
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
							{FILTER_AGE_GROUPS.map((age) => (
								<FilterChip
									key={age}
									label={age}
									selected={ageGroups.includes(age)}
									onClick={() => toggleAge(age)}
								/>
							))}
						</div>
					</FilterSection>

					{classificationQuestions.length > 0 ? (
						classificationQuestions.map((q: any) => {
							const isOpen = isOpenTextQuestion(q)
							const options = (q.answer_options ?? []) as Array<{ id?: string; text?: string }>
							const optionTexts = options.map((opt) => String(opt.text || ""))
							const questionText = String(q.question_text || "")
							const selected = classificationFilters[questionText] ?? []
							const allSelected =
								optionTexts.length > 0 && optionTexts.every((text) => selected.includes(text))
							const someSelected = selected.length > 0 && !allSelected
							return (
								<FilterSection
									key={q.question_id || questionText}
									icon={isOpen ? MessageSquareText : HelpCircle}
									title={questionText}
									hideSubtitleOnMobile={!isOpen && optionTexts.length > 0}
									subtitle={
										isOpen
											? "Open-ended response — shown for context; filter by choice-based answers below."
											: optionTexts.length > 0
												? `${selected.length} of ${optionTexts.length} selected · Select one or more answers to narrow your segment.`
												: "Select one or more answers to narrow your segment."
									}
									badge={isOpen ? "Open question" : undefined}
									headerAction={
										!isOpen && optionTexts.length > 0 ? (
											<QuestionFilterActions
												allSelected={allSelected}
												someSelected={someSelected}
												selectedCount={selected.length}
												onSelectAll={() => toggleSelectAllForQuestion(questionText, optionTexts)}
												onClearAll={() => clearQuestionSelections(questionText)}
												disabled={isRunning}
											/>
										) : undefined
									}
								>
									{isOpen ? (
										<div className="rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-500">
											Responses to this question are free text and are not used as filter criteria.
										</div>
									) : options.length > 0 ? (
										<div className="flex flex-wrap gap-2">
											{options.map((opt) => {
												const label = String(opt.text || "")
												return (
												<FilterChip
													key={opt.id || label}
													label={label}
													selected={selected.includes(label)}
													onClick={() => toggleClassificationOption(questionText, label)}
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
							<p className="text-sm text-gray-500">
								Add classification questions in study setup to filter by them here.
							</p>
						</FilterSection>
					)}
				</div>
			</div>

			<div className="sticky bottom-0 pt-2 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-3">
					<p className="text-xs text-gray-500">
						{activeFilterCount > 0
							? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} selected`
							: "No filters selected — all respondents will be included"}
					</p>
					<div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-row sm:w-auto">
						{onCancel ? (
							<button
								type="button"
								onClick={onCancel}
								disabled={isRunning}
								className="cursor-pointer inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-sm text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
							>
								Cancel
							</button>
						) : null}
						<button
							type="button"
							onClick={handleClearAllFilters}
							disabled={isRunning || activeFilterCount === 0}
							className="cursor-pointer inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-sm text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
						>
							Clear all filters
						</button>
						<motion.button
							type="button"
							onClick={handleRunAnalysis}
							disabled={isRunning || filtersUnchanged}
							whileHover={!isRunning && !filtersUnchanged ? { scale: 1.02 } : undefined}
							whileTap={!isRunning && !filtersUnchanged ? { scale: 0.98 } : undefined}
							className="cursor-pointer inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-80 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2674BA]/40"
							style={{
								backgroundColor: BRAND_BLUE,
								boxShadow: filtersUnchanged ? undefined : `0 8px 28px ${BRAND_BLUE}45`,
							}}
						>
							{isRunning ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Filter className="w-4 h-4" />
							)}
							{filtersUnchanged && !isRunning ? "Already applied" : "Run Analysis"}
						</motion.button>
						{onSaveAndRun ? (
							<motion.button
								type="button"
								onClick={openSaveStep}
								disabled={isRunning || activeFilterCount === 0}
								whileHover={!isRunning && activeFilterCount > 0 ? { scale: 1.02 } : undefined}
								whileTap={!isRunning && activeFilterCount > 0 ? { scale: 0.98 } : undefined}
								className="cursor-pointer inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm border-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2674BA]/40"
								style={{
									borderColor: BRAND_BLUE,
									color: BRAND_BLUE,
									backgroundColor: "white",
								}}
							>
								Save and Run Analysis
							</motion.button>
						) : null}
					</div>
				</div>
				{error && !saveStepOpen ? (
					<p className="text-sm text-red-600 mt-2" role="alert">
						{error}
					</p>
				) : null}
			</div>
			<AnimatePresence>
				{saveStepOpen ? (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-[130] flex items-center justify-center p-4"
					>
						<button
							type="button"
							className="absolute inset-0 bg-black/35 backdrop-blur-[3px] cursor-pointer"
							onClick={() => {
								if (isRunning) return
								setSaveStepOpen(false)
								setLocalSaveError(null)
							}}
							disabled={isRunning}
							aria-label="Close save report dialog"
						/>
						<motion.div
							initial={{ opacity: 0, y: 18, scale: 0.98 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 10, scale: 0.98 }}
							transition={{ duration: 0.2 }}
							className="relative w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl p-5 sm:p-6"
							onClick={(e) => e.stopPropagation()}
						>
							<h3 className="text-base sm:text-lg font-bold text-gray-900">Save filter report</h3>
							<p className="text-sm text-gray-500 mt-1 mb-4">
								Enter a name for this filter set. You can edit the default name.
							</p>
							<label htmlFor="report-name" className="block text-xs font-semibold text-gray-700 mb-1.5">
								Report name
							</label>
							<input
								id="report-name"
								type="text"
								value={reportName}
								onChange={(e) => setReportName(e.target.value)}
								maxLength={255}
								disabled={isRunning}
								className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2674BA]/30 disabled:opacity-60"
								placeholder="Name this filter report"
								autoFocus
							/>
							<p className="text-[11px] text-gray-500 mt-1.5">
								Default is your current filter selection.
							</p>
							{(localSaveError || saveError) && (
								<p className="text-sm text-red-600 mt-3" role="alert">
									{localSaveError || saveError}
								</p>
							)}
							<div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
								<button
									type="button"
									onClick={() => {
										setSaveStepOpen(false)
										setLocalSaveError(null)
									}}
									disabled={isRunning}
									className="cursor-pointer inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={() => void handleSaveAndRun()}
									disabled={isRunning || !reportName.trim() || activeFilterCount === 0}
									className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#2674BA] hover:bg-[#1f5d95] disabled:opacity-60"
								>
									{isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
									{isRunning ? "Saving and running..." : "Save and run"}
								</button>
							</div>
							{isRunning ? (
								<p className="mt-3 text-xs text-[#2674BA] font-semibold">Saving report and running analysis...</p>
							) : null}
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	)
}
