"use client"

import React, { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Filter, X } from "lucide-react"
import type { ClassificationQuestionPayload } from "@/lib/api/StudyAPI"
import type { SavedFilterReport, StudyFilterPayload } from "@/lib/api/ResponseAPI"
import { AnalyticsAdvancedFilterPanel } from "./AnalyticsAdvancedFilterPanel"

interface AnalyticsAdvancedFilterModalProps {
	studyId: string
	classificationQuestions?: ClassificationQuestionPayload[] | null
	initialFilters?: StudyFilterPayload["filters"] | null
	savedReports?: SavedFilterReport[]
	isOpen: boolean
	onClose: () => void
	onRunAnalysis: (filters: StudyFilterPayload["filters"]) => void
	onSaveAndRun?: (name: string, filters: StudyFilterPayload["filters"]) => void | Promise<void>
	isRunning?: boolean
	error?: string | null
	saveError?: string | null
}

export function AnalyticsAdvancedFilterModal({
	studyId,
	classificationQuestions,
	initialFilters = null,
	savedReports = [],
	isOpen,
	onClose,
	onRunAnalysis,
	onSaveAndRun,
	isRunning = false,
	error = null,
	saveError = null,
}: AnalyticsAdvancedFilterModalProps) {
	const [panelKey, setPanelKey] = useState(0)

	useEffect(() => {
		if (isOpen) setPanelKey((k) => k + 1)
	}, [isOpen])

	useEffect(() => {
		if (!isOpen) return
		const previousBodyOverflow = document.body.style.overflow
		const previousBodyOverscroll = document.body.style.overscrollBehavior
		const previousHtmlOverflow = document.documentElement.style.overflow
		const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior

		document.body.style.overflow = "hidden"
		document.body.style.overscrollBehavior = "none"
		document.documentElement.style.overflow = "hidden"
		document.documentElement.style.overscrollBehavior = "none"

		return () => {
			document.body.style.overflow = previousBodyOverflow
			document.body.style.overscrollBehavior = previousBodyOverscroll
			document.documentElement.style.overflow = previousHtmlOverflow
			document.documentElement.style.overscrollBehavior = previousHtmlOverscroll
		}
	}, [isOpen])

	if (!isOpen) return null

	return (
		<AnimatePresence>
			<motion.div
				className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
			>
				<button
					type="button"
					className="absolute inset-0 bg-black/45 backdrop-blur-[2px] cursor-pointer"
					onClick={isRunning ? undefined : onClose}
					aria-label="Close advanced filter"
					disabled={isRunning}
				/>

				<motion.div
					initial={{ opacity: 0, y: 24, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 16, scale: 0.98 }}
					transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
					className="relative flex flex-col w-full max-w-5xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] rounded-3xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="shrink-0 flex items-start justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 bg-gradient-to-r from-[#2674BA]/10 via-[#2674BA]/5 to-white">
						<div>
							<div className="inline-flex items-center gap-2 rounded-full bg-[#2674BA]/10 px-3 py-1 text-xs font-semibold text-[#2674BA] mb-2">
								<Filter className="w-3.5 h-3.5" />
								Segment Analysis
							</div>
							<h2 className="text-xl sm:text-2xl font-bold text-gray-900">Advanced Filter</h2>
							<p className="text-sm text-gray-500 mt-1 max-w-2xl">
								Select your audience segment, then run analysis. Results will update across Overview, Detail, and Design Configurator.
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							disabled={isRunning}
							className="cursor-pointer rounded-xl p-2 text-gray-500 hover:bg-white/80 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 sm:py-5">
						<AnalyticsAdvancedFilterPanel
							key={panelKey}
							studyId={studyId}
							classificationQuestions={classificationQuestions}
							initialFilters={initialFilters}
							savedReports={savedReports}
							onRunAnalysis={onRunAnalysis}
							onSaveAndRun={onSaveAndRun}
							onCancel={onClose}
							isRunning={isRunning}
							error={error}
							saveError={saveError}
						/>
					</div>

					<div className="shrink-0 px-5 sm:px-6 py-3 border-t border-gray-100 bg-gray-50/80 text-center sm:text-left">
						<p className="text-xs text-gray-500">
							Tip: leave sections empty to include all respondents for that dimension.
						</p>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	)
}
