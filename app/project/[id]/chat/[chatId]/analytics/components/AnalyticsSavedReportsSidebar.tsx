"use client"

import React, { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bookmark, Download, Loader2, Menu, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SavedFilterReport, StudyFilterPayload } from "@/lib/api/ResponseAPI"
import { describeAppliedFilters, filtersEqual } from "@/lib/utils/filterAnalysisMerge"

interface AnalyticsSavedReportsSidebarProps {
	reports: SavedFilterReport[]
	onSelectReport: (report: SavedFilterReport) => void
	onDownloadReport?: (report: SavedFilterReport) => void
	onRename: (reportId: string, name: string) => Promise<void>
	onDelete: (reportId: string) => Promise<void>
	activeFilters?: StudyFilterPayload["filters"] | null
	loading?: boolean
	applyingId?: string | null
	downloadingId?: string | null
	/** Hide the mobile menu launcher while the analytics assistant is open. */
	assistantOpen?: boolean
}

export function AnalyticsSavedReportsSidebar({
	reports,
	onSelectReport,
	onDownloadReport,
	onRename,
	onDelete,
	activeFilters,
	loading = false,
	applyingId = null,
	downloadingId = null,
	assistantOpen = false,
}: AnalyticsSavedReportsSidebarProps) {
	const [isCollapsed, setIsCollapsed] = useState(true)
	const [isMobile, setIsMobile] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editName, setEditName] = useState("")
	const [busyId, setBusyId] = useState<string | null>(null)

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 1024)
		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	const activeReportId = useMemo(() => {
		const match = reports.find((r) => filtersEqual(r.filters, activeFilters))
		return match?.id ?? null
	}, [reports, activeFilters])

	const startEdit = (report: SavedFilterReport) => {
		setEditingId(report.id)
		setEditName(report.name)
	}

	const cancelEdit = () => {
		setEditingId(null)
		setEditName("")
	}

	const submitEdit = (reportId: string) => {
		const trimmed = editName.trim()
		if (!trimmed) return
		cancelEdit()
		void onRename(reportId, trimmed)
	}

	const handleDelete = (reportId: string, name: string) => {
		if (!window.confirm(`Delete saved report "${name}"?`)) return
		if (editingId === reportId) cancelEdit()
		void onDelete(reportId)
	}

	const handleSelectReport = (report: SavedFilterReport) => {
		if (filtersEqual(report.filters, activeFilters)) {
			if (isMobile) setIsCollapsed(true)
			return
		}
		onSelectReport(report)
		if (isMobile) setIsCollapsed(true)
	}

	useEffect(() => {
		if (assistantOpen && isMobile) setIsCollapsed(true)
	}, [assistantOpen, isMobile])

	const showMobileMenuLauncher = isMobile && isCollapsed && !assistantOpen

	const handleDownload = (event: React.MouseEvent<HTMLButtonElement>, report: SavedFilterReport) => {
		event.stopPropagation()
		onDownloadReport?.(report)
	}

	return (
		<>
			<AnimatePresence>
				{isMobile && !isCollapsed && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setIsCollapsed(true)}
						className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm lg:hidden"
					/>
				)}
			</AnimatePresence>

			<motion.aside
				initial={false}
				animate={{
					width: isCollapsed ? (isMobile ? 0 : 80) : 280,
					x: isMobile && isCollapsed ? -280 : 0,
				}}
				transition={{ duration: 0.15, ease: "easeInOut" }}
				className={`bg-white border-r border-[rgba(209,223,235,1)] flex flex-col h-screen shadow-sm overflow-hidden z-[101] shrink-0
					${isMobile ? "fixed left-0 top-0 bottom-0 shadow-2xl" : "sticky top-0"}
				`}
			>
				<div className="p-4 flex items-center justify-between border-b border-[rgba(209,223,235,1)] h-[65px] shrink-0">
					<AnimatePresence mode="wait">
						{!isCollapsed && (
							<motion.div
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -10 }}
								transition={{ duration: 0.1 }}
								className="flex flex-col min-w-0 flex-1"
							>
								<div className="text-lg font-bold text-gray-800 flex items-center gap-2">
									<Bookmark className="w-5 h-5 text-[rgba(38,116,186,1)] shrink-0" />
									<span className="truncate">Saved Reports</span>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsCollapsed(!isCollapsed)}
						className="hover:bg-gray-100 rounded-full text-gray-500 hover:text-[rgba(38,116,186,1)] transition-colors shrink-0"
						aria-label={isCollapsed ? "Open saved reports" : "Close saved reports"}
					>
						{isCollapsed ? (
							<Menu className="w-10 h-10 transition-transform" />
						) : (
							<X className="w-5 h-5 transition-transform hover:rotate-90" />
						)}
					</Button>
				</div>

				<div className="flex-1 min-h-0 overflow-y-auto px-2 py-4">
					{!isCollapsed && (
						<p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
							This study
						</p>
					)}

					{loading ? (
						<div className="px-4 py-8 flex flex-col items-center justify-center gap-3">
							<div className="w-6 h-6 border-2 border-[rgba(38,116,186,0.2)] border-t-[rgba(38,116,186,1)] rounded-full animate-spin" />
							{!isCollapsed && <p className="text-xs text-gray-400">Loading reports…</p>}
						</div>
					) : reports.length === 0 ? (
						!isCollapsed && (
							<div className="mx-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
								<p className="text-sm font-medium text-slate-700">No saved reports yet</p>
								<p className="text-xs text-slate-500 mt-1">
									Use Advanced Filter → Save and Run Analysis to save one.
								</p>
							</div>
						)
					) : (
						<div className="space-y-1">
							{reports.map((report) => {
								const isActive = report.id === activeReportId
								const isEditing = editingId === report.id
								const isDownloading = downloadingId === report.id
								const isBusy = busyId === report.id || applyingId === report.id || isDownloading
								const summary = describeAppliedFilters(report.filters)

								if (isCollapsed) {
									return (
										<button
											key={report.id}
											type="button"
											onClick={() => handleSelectReport(report)}
											disabled={isBusy}
											title={report.name}
											className={`w-full flex items-center justify-center p-3 rounded-lg transition-colors cursor-pointer disabled:opacity-60 ${
												isActive
													? "bg-[rgba(38,116,186,0.1)] text-[rgba(38,116,186,1)]"
													: "text-gray-600 hover:bg-gray-50"
											}`}
										>
											{isBusy ? (
												<Loader2 className="w-5 h-5 animate-spin shrink-0" />
											) : (
												<Bookmark
													className={`w-5 h-5 shrink-0 ${
														isActive ? "text-[rgba(38,116,186,1)]" : "text-gray-400"
													}`}
												/>
											)}
										</button>
									)
								}

								return (
									<div
										key={report.id}
										className={`rounded-lg transition-all mx-1 group relative ${
											isActive
												? "bg-[rgba(38,116,186,0.1)] text-[rgba(38,116,186,1)] border-l-4 border-[rgba(38,116,186,1)] rounded-l-none"
												: "text-gray-600 hover:bg-gray-50"
										}`}
									>
										{isEditing ? (
											<div className="p-3 space-y-2">
												<input
													type="text"
													value={editName}
													onChange={(e) => setEditName(e.target.value)}
													maxLength={255}
													className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(38,116,186,0.3)]"
													autoFocus
												/>
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() => void submitEdit(report.id)}
														disabled={!editName.trim() || isBusy}
														className="cursor-pointer flex-1 rounded-lg bg-[rgba(38,116,186,1)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
													>
														Save
													</button>
													<button
														type="button"
														onClick={cancelEdit}
														className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
													>
														Cancel
													</button>
												</div>
											</div>
										) : (
											<>
												<button
													type="button"
													onClick={() => handleSelectReport(report)}
													disabled={isBusy}
													className="cursor-pointer w-full text-left px-4 py-3 pr-24 disabled:opacity-60"
												>
													<div className="flex items-start justify-between gap-2">
														<div className="min-w-0 flex-1">
															<p className="text-sm font-medium truncate">{report.name}</p>
															{summary ? (
																<p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
																	{summary}
																</p>
															) : null}
														</div>
														{isBusy ? (
															<Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5" />
														) : isActive ? (
															<span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-[rgba(38,116,186,0.15)] px-1.5 py-0.5 rounded">
																Active
															</span>
														) : null}
													</div>
												</button>
												<div
													className={`absolute right-2 top-2 flex items-center gap-1 transition-all ${
														isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
													}`}
												>
													<button
														type="button"
														onClick={(event) => handleDownload(event, report)}
														disabled={isBusy || !onDownloadReport}
														className="cursor-pointer p-1.5 rounded-full hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
														aria-label={`Download ${report.name}`}
														title="Export saved report CSV"
													>
														{isDownloading ? (
															<Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
														) : (
															<Download className="w-3.5 h-3.5 text-emerald-600" />
														)}
													</button>
													<button
														type="button"
														onClick={() => startEdit(report)}
														disabled={isBusy}
														className="cursor-pointer p-1.5 rounded-full hover:bg-[rgba(38,116,186,0.1)]"
														aria-label={`Rename ${report.name}`}
													>
														<Pencil className="w-3.5 h-3.5 text-[rgba(38,116,186,1)]" />
													</button>
													<button
														type="button"
														onClick={() => void handleDelete(report.id, report.name)}
														disabled={isBusy}
														className="cursor-pointer p-1.5 rounded-full hover:bg-red-50"
														aria-label={`Delete ${report.name}`}
													>
														<Trash2 className="w-3.5 h-3.5 text-red-500" />
													</button>
												</div>
											</>
										)}
									</div>
								)
							})}
						</div>
					)}

					{!isCollapsed && !loading && reports.length > 0 && (
						<p className="px-4 pt-4 text-xs text-gray-400">
							Tap a report to apply its filters.
						</p>
					)}
				</div>
			</motion.aside>

			<AnimatePresence>
				{showMobileMenuLauncher && (
					<motion.button
						initial={{ scale: 0, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0, opacity: 0 }}
						onClick={() => setIsCollapsed(false)}
						className="fixed left-4 bottom-4 w-12 h-12 bg-[rgba(38,116,186,1)] text-white rounded-full shadow-lg flex items-center justify-center z-[110] lg:hidden hover:scale-110 active:scale-95 transition-transform"
						style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
						aria-label="Open saved reports"
						title="Saved reports"
					>
						<Menu className="w-6 h-6" />
					</motion.button>
				)}
			</AnimatePresence>
		</>
	)
}
