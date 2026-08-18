"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, RotateCcw, Settings2, X, Filter } from "lucide-react"
import {
	getStudyAnalysisSettings,
	saveStudyAnalysisSettings,
	type StudyAnalysisSettings,
	type StudyAnalysisSettingsResponse,
} from "@/lib/api/ResponseAPI"

const BRAND_BLUE = "#2674BA"

function cloneSettings(settings: StudyAnalysisSettings): StudyAnalysisSettings {
	return {
		top: { hundred: [...settings.top.hundred], zero: [...settings.top.zero] },
		bottom: { hundred: [...settings.bottom.hundred], zero: [...settings.bottom.zero] },
		regression: { include_intercept: settings.regression.include_intercept },
	}
}

function settingsEqual(a: StudyAnalysisSettings, b: StudyAnalysisSettings): boolean {
	const key = (s: StudyAnalysisSettings) =>
		JSON.stringify({
			top: {
				hundred: [...s.top.hundred].sort((x, y) => x - y),
				zero: [...s.top.zero].sort((x, y) => x - y),
			},
			bottom: {
				hundred: [...s.bottom.hundred].sort((x, y) => x - y),
				zero: [...s.bottom.zero].sort((x, y) => x - y),
			},
			regression: { include_intercept: s.regression.include_intercept },
		})
	return key(a) === key(b)
}

interface RatingScoringEditorProps {
	title: string
	subtitle: string
	ratings: number[]
	group: RatingScoringGroup
	onChange: (next: RatingScoringGroup) => void
}

type RatingScoringGroup = StudyAnalysisSettings["top"]

function RatingScoringEditor({ title, subtitle, ratings, group, onChange }: RatingScoringEditorProps) {
	const toggleRating = (rating: number, target: "hundred" | "zero") => {
		const hundred = new Set(group.hundred)
		const zero = new Set(group.zero)
		if (target === "hundred") {
			hundred.add(rating)
			zero.delete(rating)
		} else {
			zero.add(rating)
			hundred.delete(rating)
		}
		onChange({
			hundred: ratings.filter((r) => hundred.has(r)),
			zero: ratings.filter((r) => zero.has(r)),
		})
	}

	return (
		<div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/80 p-4 sm:p-5 shadow-sm">
			<div className="mb-4">
				<h3 className="text-base font-bold text-gray-900">{title}</h3>
				<p className="text-sm text-gray-500 mt-1">{subtitle}</p>
			</div>

			<div className="space-y-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BRAND_BLUE }}>
						Coded as 100
					</p>
					<div className="flex flex-wrap gap-2">
						{ratings.map((rating) => {
							const active = group.hundred.includes(rating)
							return (
								<button
									key={`${title}-100-${rating}`}
									type="button"
									onClick={() => toggleRating(rating, "hundred")}
									className={`cursor-pointer min-w-[44px] h-11 px-3 rounded-xl border-2 text-sm font-bold transition-all ${
										active
											? "text-white shadow-md"
											: "border-gray-200 bg-white text-gray-400 hover:border-[#2674BA]/40 hover:text-[#2674BA]"
									}`}
									style={
										active
											? {
													borderColor: BRAND_BLUE,
													backgroundColor: BRAND_BLUE,
													boxShadow: "0 4px 14px rgba(38, 116, 186, 0.25)",
												}
											: undefined
									}
								>
									{rating}
								</button>
							)
						})}
					</div>
				</div>

				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Coded as 0</p>
					<div className="flex flex-wrap gap-2">
						{ratings.map((rating) => {
							const active = group.zero.includes(rating)
							return (
								<button
									key={`${title}-0-${rating}`}
									type="button"
									onClick={() => toggleRating(rating, "zero")}
									className={`cursor-pointer min-w-[44px] h-11 px-3 rounded-xl border-2 text-sm font-bold transition-all ${
										active
											? "border-gray-500 bg-gray-600 text-white shadow-md"
											: "border-gray-200 bg-white text-gray-400 hover:border-gray-400 hover:text-gray-700"
									}`}
								>
									{rating}
								</button>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}

interface AnalyticsSettingsModalProps {
	studyId: string
	isOpen: boolean
	onClose: () => void
	onSaved?: (response: StudyAnalysisSettingsResponse) => void
	onOpenAdvancedFilter?: () => void
}

export function AnalyticsSettingsModal({
	studyId,
	isOpen,
	onClose,
	onSaved,
	onOpenAdvancedFilter,
}: AnalyticsSettingsModalProps) {
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [maxRating, setMaxRating] = useState(5)
	const [defaults, setDefaults] = useState<StudyAnalysisSettings | null>(null)
	const [baseline, setBaseline] = useState<StudyAnalysisSettings | null>(null)
	const [draft, setDraft] = useState<StudyAnalysisSettings | null>(null)

	const ratings = useMemo(
		() => Array.from({ length: maxRating }, (_, i) => i + 1),
		[maxRating]
	)

	const hasChanges = useMemo(() => {
		if (!draft || !baseline) return false
		return !settingsEqual(draft, baseline)
	}, [draft, baseline])

	const loadSettings = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await getStudyAnalysisSettings(studyId)
			setMaxRating(res.max_rating || 5)
			const loaded = cloneSettings(res.settings)
			setDefaults(res.defaults ? cloneSettings(res.defaults) : cloneSettings(res.settings))
			setBaseline(loaded)
			setDraft(loaded)
		} catch (e) {
			setError((e as Error)?.message ?? "Failed to load analysis settings")
		} finally {
			setLoading(false)
		}
	}, [studyId])

	useEffect(() => {
		if (isOpen) {
			void loadSettings()
		}
	}, [isOpen, loadSettings])

	const handleReset = () => {
		if (defaults) setDraft(cloneSettings(defaults))
	}

	const handleSave = async () => {
		if (!draft || !hasChanges) return
		setSaving(true)
		setError(null)
		try {
			const saved = await saveStudyAnalysisSettings(studyId, draft)
			setBaseline(cloneSettings(saved.settings))
			setDraft(cloneSettings(saved.settings))
			onSaved?.(saved)
			onClose()
		} catch (e) {
			setError((e as Error)?.message ?? "Failed to save analysis settings")
		} finally {
			setSaving(false)
		}
	}

	if (!isOpen) return null

	return (
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				<button
					type="button"
					className="absolute inset-0 bg-black/45 backdrop-blur-[2px] cursor-pointer"
					onClick={onClose}
					aria-label="Close analysis settings"
				/>

				<motion.div
					initial={{ opacity: 0, y: 24, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 16, scale: 0.98 }}
					transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
					className="relative flex flex-col w-full max-w-4xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] rounded-3xl bg-white shadow-2xl border border-gray-200"
				>
					<div className="shrink-0 flex items-start justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 bg-gradient-to-r from-[#2674BA]/10 to-white rounded-t-3xl">
						<div>
							<div className="inline-flex items-center gap-2 rounded-full bg-[#2674BA]/10 px-3 py-1 text-xs font-semibold text-[#2674BA] mb-2">
								<Settings2 className="w-3.5 h-3.5" />
								Analysis Settings
							</div>
							<h2 className="text-xl sm:text-2xl font-bold text-gray-900">Configure rating analysis</h2>
							<p className="text-sm text-gray-500 mt-1">
								Choose which ratings count as 100 vs 0 for top-down and bottom-up, and whether regressions include an intercept.
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="cursor-pointer rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					<div className="flex-1 min-h-0 px-5 sm:px-6 py-4 sm:py-5 overflow-y-auto sm:overflow-visible">
						{loading || !draft ? (
							<div className="flex items-center justify-center gap-3 py-12 text-gray-500">
								<Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND_BLUE }} />
								<span>Loading settings…</span>
							</div>
						) : (
							<div className="space-y-4 sm:space-y-5">
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
									<RatingScoringEditor
										title="Top-Down"
										subtitle="Ratings mapped to 100 drive top-box performance."
										ratings={ratings}
										group={draft.top}
										onChange={(top) => setDraft((prev) => (prev ? { ...prev, top } : prev))}
									/>
									<RatingScoringEditor
										title="Bottom-Up"
										subtitle="Ratings mapped to 100 drive bottom-box performance."
										ratings={ratings}
										group={draft.bottom}
										onChange={(bottom) => setDraft((prev) => (prev ? { ...prev, bottom } : prev))}
									/>
								</div>

								<div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
									<h3 className="text-base font-bold text-gray-900 mb-1">Regression model</h3>
									<p className="text-sm text-gray-500 mb-4">
										With intercept fits a baseline term; without intercept forces the model through zero.
									</p>
									<div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
										<button
											type="button"
											onClick={() =>
												setDraft((prev) =>
													prev
														? { ...prev, regression: { include_intercept: true } }
														: prev
												)
											}
											className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
												draft.regression.include_intercept
													? "bg-white text-[#2674BA] shadow-sm"
													: "text-gray-500 hover:text-gray-700"
											}`}
										>
											With intercept
										</button>
										<button
											type="button"
											onClick={() =>
												setDraft((prev) =>
													prev
														? { ...prev, regression: { include_intercept: false } }
														: prev
												)
											}
											className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
												!draft.regression.include_intercept
													? "bg-white text-[#2674BA] shadow-sm"
													: "text-gray-500 hover:text-gray-700"
											}`}
										>
											Without intercept
										</button>
									</div>
								</div>

								{error && (
									<p className="text-sm text-red-600" role="alert">
										{error}
									</p>
								)}
							</div>
						)}
					</div>

					<div className="shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5 border-t border-gray-100 bg-gray-50/80 rounded-b-3xl">
						<div className="flex flex-col sm:flex-row sm:items-center gap-3">
							<button
								type="button"
								onClick={handleReset}
								disabled={loading || saving || !defaults}
								className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<RotateCcw className="w-4 h-4" />
								Reset to default
							</button>
							{onOpenAdvancedFilter ? (
								<button
									type="button"
									onClick={onOpenAdvancedFilter}
									disabled={saving}
									className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#2674BA]/25 text-[#2674BA] bg-white hover:bg-[#2674BA]/5 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<Filter className="w-4 h-4" />
									Advanced Filter
								</button>
							) : null}
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={onClose}
								disabled={saving}
								className="cursor-pointer px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => void handleSave()}
								disabled={loading || saving || !draft || !hasChanges}
								className="cursor-pointer inline-flex items-center justify-center gap-2 min-w-[140px] px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
								style={{ backgroundColor: BRAND_BLUE }}
							>
								{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
								{saving ? "Saving analysis…" : "Save Analysis"}
							</button>
						</div>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	)
}
