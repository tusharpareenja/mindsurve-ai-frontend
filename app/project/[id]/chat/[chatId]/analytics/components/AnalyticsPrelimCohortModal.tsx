"use client"

import React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BarChart3, Loader2, Users, X } from "lucide-react"
import type { ClassificationCohortResponse, StudyFilterPayload } from "@/lib/api/ResponseAPI"

function buildBreakdownFromRespondents(
	respondents: ClassificationCohortResponse["respondents"],
	filters?: StudyFilterPayload["filters"] | null
): { gender?: Record<string, number>; age_group?: Record<string, number> } {
	const genderCounts: Record<string, number> = {}
	const ageCounts: Record<string, number> = {}
	for (const r of respondents) {
		if (r.gender) genderCounts[r.gender] = (genderCounts[r.gender] || 0) + 1
		if (r.age_group) ageCounts[r.age_group] = (ageCounts[r.age_group] || 0) + 1
	}
	const out: { gender?: Record<string, number>; age_group?: Record<string, number> } = {}
	const singleGender = (filters?.genders?.length ?? 0) === 1
	const singleAge = (filters?.age_groups?.length ?? 0) === 1
	if (Object.keys(genderCounts).length > 1 && !singleGender) out.gender = genderCounts
	if (Object.keys(ageCounts).length > 1 && !singleAge) out.age_group = ageCounts
	return out
}

function mergeDemographicBreakdown(
	api?: ClassificationCohortResponse["demographic_breakdown"],
	fallback?: { gender?: Record<string, number>; age_group?: Record<string, number> }
) {
	const gender =
		api?.gender && Object.keys(api.gender).length > 0 ? api.gender : fallback?.gender
	const age_group =
		api?.age_group && Object.keys(api.age_group).length > 0 ? api.age_group : fallback?.age_group
	return { gender, age_group }
}

type CohortSelection = {
	questionText: string
	answer: string
	baseSize?: number
}

function DemographicBreakdownBlock({
	title,
	counts,
}: {
	title: string
	counts: Record<string, number>
}) {
	const entries = Object.entries(counts)
	if (entries.length === 0) return null
	const segmentTotal = entries.reduce((sum, [, count]) => sum + count, 0)

	return (
		<div className="rounded-xl bg-slate-50 border border-slate-100 p-3 sm:p-4">
			<p className="text-sm font-semibold text-slate-800 mb-3">{title}</p>
			<div className="space-y-3">
				{entries.map(([label, count]) => {
					const pct = segmentTotal > 0 ? Math.round((count / segmentTotal) * 100) : 0
					return (
						<div key={label}>
							<div className="flex items-center justify-between gap-2 text-xs sm:text-sm mb-1">
								<span className="font-medium text-slate-700">{label}</span>
								<span className="text-slate-500 tabular-nums shrink-0">
									{count} ({pct}%)
								</span>
							</div>
							<div className="h-2 rounded-full bg-slate-200/80 overflow-hidden">
								<div
									className="h-full rounded-full bg-[#2674BA] transition-all duration-300"
									style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
								/>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

interface AnalyticsPrelimCohortModalProps {
	isOpen: boolean
	onClose: () => void
	selection: CohortSelection | null
	data: ClassificationCohortResponse | null
	isLoading: boolean
	isLoadingMore?: boolean
	error?: string | null
	onRetry?: () => void
	onLoadMore?: () => void
}

export function AnalyticsPrelimCohortModal({
	isOpen,
	onClose,
	selection,
	data,
	isLoading,
	isLoadingMore = false,
	error = null,
	onRetry,
	onLoadMore,
}: AnalyticsPrelimCohortModalProps) {
	React.useEffect(() => {
		if (!isOpen) return
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [isOpen])

	if (!isOpen || !selection) return null

	const loaded = data?.respondents?.length ?? 0
	const hasMore = !!data?.meta?.has_more
	const clickedQuestion = data?.meta?.question_text || selection.questionText
	const clickedAnswer = data?.meta?.answer || selection.answer
	const demo = mergeDemographicBreakdown(
		data?.demographic_breakdown,
		data ? buildBreakdownFromRespondents(data.respondents, data.meta.filters_applied) : undefined
	)
	const hasGenderChart = !!(demo.gender && Object.keys(demo.gender).length > 0)
	const hasAgeChart = !!(demo.age_group && Object.keys(demo.age_group).length > 0)

	return (
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				<button
					type="button"
					className="absolute inset-0 bg-slate-950/50"
					onClick={isLoading ? undefined : onClose}
					aria-label="Close cohort insights"
					disabled={isLoading}
				/>

				<motion.div
					initial={{ opacity: 0, y: 20, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 14, scale: 0.98 }}
					transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
					className="relative w-full max-w-[96rem] max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-[#2674BA]/12 via-[#2674BA]/5 to-white px-4 sm:px-6 py-4">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<div className="inline-flex items-center gap-2 rounded-full bg-[#2674BA]/10 px-3 py-1 text-xs font-semibold text-[#2674BA]">
									<Users className="w-3.5 h-3.5" />
									Group details
								</div>
								<h2 className="mt-2 text-lg sm:text-2xl font-bold text-slate-900 break-words">
									Who chose this option?
								</h2>
								<div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
									<span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600">
										{clickedQuestion}
									</span>
									<span className="inline-flex rounded-full border border-[#2674BA]/30 bg-[#2674BA]/10 px-3 py-1 font-semibold text-[#2674BA]">
										{clickedAnswer}
									</span>
								</div>
							</div>
							<button
								type="button"
								onClick={onClose}
								disabled={isLoading}
								className="cursor-pointer rounded-xl p-2 text-slate-500 hover:bg-white/80 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								aria-label="Close modal"
							>
								<X className="w-5 h-5" />
							</button>
						</div>
					</div>

					<div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] px-4 sm:px-6 py-4 sm:py-6 space-y-6 bg-slate-50/40">
						{isLoading ? (
							<div className="rounded-2xl border border-slate-200 bg-white p-10 flex flex-col items-center justify-center text-center">
								<Loader2 className="w-9 h-9 animate-spin text-[#2674BA]" />
								<p className="mt-4 text-base font-semibold text-slate-800">
									Loading respondent comparison...
								</p>
								<p className="text-sm text-slate-500 mt-1">
									Pulling only the relevant cohort for fast insights.
								</p>
							</div>
						) : error ? (
							<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
								<p className="text-sm sm:text-base font-semibold text-amber-900">
									Unable to load cohort insights
								</p>
								<p className="text-sm text-amber-700 mt-1">{error}</p>
								{onRetry && (
									<button
										type="button"
										onClick={onRetry}
										className="mt-4 cursor-pointer inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
									>
										Try again
									</button>
								)}
							</div>
						) : data ? (
							<>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="rounded-2xl border border-slate-200 bg-white p-4">
										<p className="text-xs uppercase tracking-wide text-slate-500">Respondents</p>
										<p className="mt-1 text-2xl font-bold text-slate-900">{loaded}</p>
									</div>
									<div className="rounded-2xl border border-slate-200 bg-white p-4">
										<p className="text-xs uppercase tracking-wide text-slate-500">Questions</p>
										<p className="mt-1 text-2xl font-bold text-slate-900">{data.questions.length}</p>
									</div>
 								</div>

								<div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
									<div className="flex items-center gap-2 mb-3">
										<BarChart3 className="w-4 h-4 text-[#2674BA]" />
										<h3 className="text-sm sm:text-base font-semibold text-slate-900">
											Quick breakdown
										</h3>
									</div>
									{hasGenderChart || hasAgeChart ? (
										<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
											{hasGenderChart && demo.gender && (
												<DemographicBreakdownBlock title="By gender" counts={demo.gender} />
											)}
											{hasAgeChart && demo.age_group && (
												<DemographicBreakdownBlock title="By age" counts={demo.age_group} />
											)}
										</div>
									) : (
										<p className="text-sm text-slate-500">
											Not enough mix to show a breakdown. This happens when everyone in the
											group is the same gender and age, or you already filtered to one gender
											or age group.
										</p>
									)}
								</div>

								<div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
									<div className="flex items-center gap-2 mb-3">
										<BarChart3 className="w-4 h-4 text-[#2674BA]" />
										<h3 className="text-sm sm:text-base font-semibold text-slate-900">
											What else did this cohort choose?
										</h3>
									</div>
									{Object.keys(data.cross_tabs || {}).length === 0 ? (
										<p className="text-sm text-slate-500">No additional cross-tab data available.</p>
									) : (
										<div className="space-y-3">
											{Object.entries(data.cross_tabs).map(([question, options]) => (
												<div key={question} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
													<p className="text-sm font-semibold text-slate-800 mb-2">{question}</p>
													<div className="flex flex-wrap gap-2">
														{Object.entries(options).map(([option, count]) => (
															<span
																key={`${question}-${option}`}
																className="inline-flex items-center gap-1 rounded-full border border-[#2674BA]/20 bg-[#2674BA]/10 px-2.5 py-1 text-xs font-medium text-[#1f5d95]"
															>
																{option}
																<span className="font-bold">({count})</span>
															</span>
														))}
													</div>
												</div>
											))}
										</div>
									)}
								</div>

								<div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
									<div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
										<h3 className="text-sm sm:text-base font-semibold text-slate-900">
											Respondent Comparison Matrix
										</h3>
										<div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
											<Users className="w-3.5 h-3.5" />
											{loaded} respondents
										</div>
									</div>
									<div className="overflow-x-auto">
										<table className="min-w-[980px] w-full text-sm">
											<thead>
												<tr className="bg-slate-50 border-b border-slate-100">
													<th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 min-w-[220px]">
														Respondent
													</th>
													{data.questions.map((q) => (
														<th
															key={q.question_text}
															className={`px-4 py-3 text-left text-xs font-semibold min-w-[220px] ${
																q.question_text === clickedQuestion
																	? "text-[#2674BA] bg-[#2674BA]/10"
																	: "text-slate-600"
															}`}
														>
															{q.question_text}
														</th>
													))}
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-100">
												{data.respondents.map((resp) => (
													<tr key={resp.id}>
														<td className="px-4 py-3 align-top">
															<p className="font-semibold text-slate-800">{resp.label}</p>
															<div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
																{resp.gender && (
																	<span className="rounded-md bg-slate-100 px-1.5 py-0.5">
																		{resp.gender}
																	</span>
																)}
																{resp.age_group && (
																	<span className="rounded-md bg-slate-100 px-1.5 py-0.5">
																		{resp.age_group}
																	</span>
																)}
															</div>
														</td>
														{data.questions.map((q) => {
															const value = resp.answers?.[q.question_text]
															return (
																<td
																	key={`${resp.id}-${q.question_text}`}
																	className={`px-4 py-3 align-top ${
																		q.question_text === clickedQuestion
																			? "bg-[#2674BA]/5"
																			: ""
																	}`}
																>
																	<span className="text-slate-800">
																		{value || "—"}
																	</span>
																</td>
															)
														})}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>

								{hasMore && onLoadMore && (
									<div className="flex justify-center">
										<button
											type="button"
											onClick={onLoadMore}
											disabled={isLoadingMore}
											className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-[#2674BA]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#2674BA] hover:bg-[#2674BA]/5 disabled:opacity-60 disabled:cursor-not-allowed"
										>
											{isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
											{isLoadingMore ? "Loading more..." : "Load more respondents"}
										</button>
									</div>
								)}
							</>
						) : (
							<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
								<p className="text-sm text-slate-500">No cohort data available.</p>
							</div>
						)}
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	)
}

