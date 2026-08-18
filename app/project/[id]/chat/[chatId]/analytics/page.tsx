"use client"

import { Suspense, useEffect, useState, useMemo, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
    getStudyBasicDetails,
    createSavedDesign,
    type StudyDetails,
} from "@/lib/api/StudyAPI"
import {
    createSavedFilterReport,
    deleteSavedFilterReport,
    downloadStudyResponsesCsv,
    getAnalyticsSession,
    getSavedFilterReports,
    postClassificationCohort,
    renameSavedFilterReport,
    resetActiveFilter,
    saveActiveFilter,
    type ClassificationCohortResponse,
    type SavedFilterReport,
    type StudyFilterPayload,
} from "@/lib/api/ResponseAPI"
import {
    describeAppliedFilters,
    filtersEqual,
    hasAnyFilterSelection,
    isEmptyFilterResponse,
} from "@/lib/utils/filterAnalysisMerge"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, BarChart3, ChevronDown, Download, Filter, LayoutDashboard, Settings2, Sparkles, X } from "lucide-react"
import { exportDesignConfiguratorHtml, ExportHtmlStage } from "@/lib/export/designConfiguratorHtmlExport"
import Link from "next/link"
import { AnalyticsToolbar } from "./components/AnalyticsToolbar"
import { AnalyticsTable } from "./components/AnalyticsTable"
import { AnalyticsHeatmap } from "./components/AnalyticsHeatmap"
import { AnalyticsGraph } from "./components/AnalyticsGraph"
import { AnalyticsKPICards } from "./components/AnalyticsKPICards"
import { AnalyticsResponseTimeSection } from "./components/AnalyticsResponseTimeSection"
import { AnalyticsPieCharts } from "./components/AnalyticsPieCharts"
import { AnalyticsTopBottomPerformers } from "./components/AnalyticsTopBottomPerformers"
import { AnalyticsPersonaBlueprints } from "./components/AnalyticsPersonaBlueprints"
import { AnalyticsDesignConfigurator } from "./components/AnalyticsDesignConfigurator"
import { AnalyticsSettingsModal } from "./components/AnalyticsSettingsModal"
import { AnalyticsAdvancedFilterModal } from "./components/AnalyticsAdvancedFilterModal"
import { AnalyticsPrelimCohortModal } from "./components/AnalyticsPrelimCohortModal"
import { AnalyticsSavedReportsSidebar } from "./components/AnalyticsSavedReportsSidebar"
import { AnalyticsAssistantPanel } from "./components/AnalyticsAssistantPanel"
import { AnalyticsNavbar } from "./components/AnalyticsNavbar"
import { useAnalyticsAssistant } from "@/lib/hooks/useAnalyticsAssistant"
import type { AssistantAction, AssistantQueryResponse } from "@/lib/types/analyticsAssistant"
import { downloadAnalyticsAssistantPpt } from "@/lib/api/AnalyticsAssistantAPI"
import { studyBriefApi } from "@/lib/api/studyBrief"
import { AuthGate } from "@/components/auth/AuthGate"
import { useAuth } from "@/context/AuthContext"

function StudyAnalyticsPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { accessToken } = useAuth()
    const projectId = String(params.id || "")
    const chatId = String(params.chatId || "")
    const chatHref = `/project/${projectId}/chat/${chatId}`
    const queryStudyId = searchParams.get("studyId")?.trim() || ""
    const [studyId, setStudyId] = useState(queryStudyId)

    const [study, setStudy] = useState<StudyDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [exporting, setExporting] = useState(false)
    const [exportStage, setExportStage] = useState(0)
    const [exportMenuOpen, setExportMenuOpen] = useState(false)
    const [exportModeLabel, setExportModeLabel] = useState("Exporting...")
    const exportMenuRef = useRef<HTMLDivElement | null>(null)
    // The real scroll container for the page content (window does not scroll — see h-screen root)
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)
    const [exportingHtml, setExportingHtml] = useState(false)
    const [exportHtmlStage, setExportHtmlStage] = useState<ExportHtmlStage>("preparing")
    const [analysisData, setAnalysisData] = useState<any>(null)
    const [fullAnalysisData, setFullAnalysisData] = useState<any>(null)
    const [analysisLoading, setAnalysisLoading] = useState(true)
    const [analysisError, setAnalysisError] = useState<string | null>(null)
    const [filterError, setFilterError] = useState<string | null>(null)
    const [activeFilters, setActiveFilters] = useState<StudyFilterPayload["filters"] | null>(null)
    const [isFilterActive, setIsFilterActive] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false)
    const [filterRunning, setFilterRunning] = useState(false)
    const [saveAndRunPending, setSaveAndRunPending] = useState(false)
    const [cohortOpen, setCohortOpen] = useState(false)
    const [cohortSelection, setCohortSelection] = useState<{ questionText: string; answer: string; baseSize?: number } | null>(null)
    const [cohortData, setCohortData] = useState<ClassificationCohortResponse | null>(null)
    const [cohortLoading, setCohortLoading] = useState(false)
    const [cohortLoadingMore, setCohortLoadingMore] = useState(false)
    const [cohortError, setCohortError] = useState<string | null>(null)
    const [savedReports, setSavedReports] = useState<SavedFilterReport[]>([])
    const [savedReportsLoading, setSavedReportsLoading] = useState(false)
    const [saveReportError, setSaveReportError] = useState<string | null>(null)
    const [applyingReportId, setApplyingReportId] = useState<string | null>(null)
    const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null)

    const loadSavedReports = async () => {
        if (!studyId) return
        setSavedReportsLoading(true)
        try {
            const rows = await getSavedFilterReports(studyId)
            setSavedReports(rows)
        } catch (e) {
            console.warn("Failed to load saved reports:", e)
        } finally {
            setSavedReportsLoading(false)
        }
    }

    const loadAnalysis = async () => {
        if (!studyId) return
        setAnalysisLoading(true)
        setAnalysisError(null)
        setFilterError(null)
        try {
            const session = await getAnalyticsSession(studyId)
            const data = session.analysis
            setAnalysisData(data)
            if (session.has_active_filter && session.active_filters) {
                setActiveFilters(session.active_filters)
                setIsFilterActive(true)
                setFullAnalysisData(null)
            } else {
                setFullAnalysisData(data)
                setActiveFilters(null)
                setIsFilterActive(false)
            }
        } catch (e) {
            console.warn("Failed to load analysis:", e)
            setAnalysisError((e as Error)?.message ?? "Failed to load analysis")
        } finally {
            setAnalysisLoading(false)
        }
    }

    const runFilteredAnalysis = async (filters: StudyFilterPayload["filters"]) => {
        if (!studyId) return

        setAdvancedFilterOpen(false)
        setFilterRunning(true)
        setAnalysisLoading(true)
        setFilterError(null)
        setAnalysisError(null)
        setSaveReportError(null)

        try {
            if (!hasAnyFilterSelection(filters)) {
                const reset = await resetActiveFilter(studyId)
                setAnalysisData(reset.analysis)
                setFullAnalysisData(reset.analysis)
                setActiveFilters(null)
                setIsFilterActive(false)
                return
            }

            const response = await saveActiveFilter(studyId, { filters: filters ?? {} })

            if (isEmptyFilterResponse(response.analysis)) {
                setFilterError(
                    (response.analysis?.filter_meta as any)?.error ?? "There is no response for the selected segment."
                )
                const reset = await resetActiveFilter(studyId)
                setAnalysisData(reset.analysis)
                setFullAnalysisData(reset.analysis)
                setActiveFilters(null)
                setIsFilterActive(false)
                return
            }

            setAnalysisData(response.analysis)
            setActiveFilters(response.filters ?? filters ?? {})
            setIsFilterActive(true)
            setFullAnalysisData(null)
        } catch (e) {
            setFilterError((e as Error)?.message ?? "Filter analysis failed")
            if (fullAnalysisData) {
                setAnalysisData(fullAnalysisData)
            }
            setActiveFilters(null)
            setIsFilterActive(false)
        } finally {
            setAnalysisLoading(false)
            setFilterRunning(false)
            setApplyingReportId(null)
        }
    }

    const saveAndRunFilteredAnalysis = async (
        name: string,
        filters: StudyFilterPayload["filters"]
    ) => {
        if (!studyId) return
        setSaveAndRunPending(true)
        setSaveReportError(null)
        try {
            await createSavedFilterReport(studyId, { name, filters: filters ?? {} })
            await loadSavedReports()
            await runFilteredAnalysis(filters)
        } catch (e) {
            const err = e as Error & { status?: number }
            setSaveReportError(err.message ?? "Failed to save report")
            if (err.status !== 409) {
                throw e
            }
        } finally {
            setSaveAndRunPending(false)
        }
    }

    const applySavedReport = async (report: SavedFilterReport) => {
        if (isFilterActive && filtersEqual(report.filters, activeFilters)) return
        setApplyingReportId(report.id)
        await runFilteredAnalysis(report.filters)
    }

    const clearActiveFilter = async () => {
        if (!studyId) return
        setAnalysisLoading(true)
        setFilterError(null)
        try {
            const reset = await resetActiveFilter(studyId)
            setAnalysisData(reset.analysis)
            setFullAnalysisData(reset.analysis)
            setActiveFilters(null)
            setIsFilterActive(false)
        } catch (e) {
            setFilterError((e as Error)?.message ?? "Failed to reset filter")
        } finally {
            setAnalysisLoading(false)
        }
    }

    const loadClassificationCohort = async (
        selection: { questionText: string; answer: string; baseSize?: number },
        offset = 0,
        append = false
    ) => {
        if (!studyId) return

        if (append) {
            setCohortLoadingMore(true)
        } else {
            setCohortLoading(true)
            setCohortError(null)
        }

        try {
            const response = await postClassificationCohort(studyId, {
                filters: isFilterActive ? activeFilters ?? {} : {},
                question_text: selection.questionText,
                answer: selection.answer,
                limit: 120,
                offset,
            })

            setCohortData((prev) => {
                if (!append || !prev) return response
                return {
                    ...response,
                    respondents: [...(prev.respondents || []), ...(response.respondents || [])],
                }
            })
        } catch (e) {
            setCohortError((e as Error)?.message ?? "Failed to load cohort insights")
        } finally {
            setCohortLoading(false)
            setCohortLoadingMore(false)
        }
    }

    const handlePrelimColumnClick = (selection: { questionText: string; answer: string; baseSize?: number }) => {
        setCohortSelection(selection)
        setCohortData(null)
        setCohortError(null)
        setCohortOpen(true)
        void loadClassificationCohort(selection, 0, false)
    }

    const loadMoreCohort = () => {
        if (!cohortSelection || !cohortData || cohortLoadingMore || !cohortData.meta?.has_more) return
        void loadClassificationCohort(cohortSelection, cohortData.respondents.length, true)
    }

    useEffect(() => {
        if (queryStudyId) {
            setStudyId(queryStudyId)
            return
        }
        if (!chatId) return
        let cancelled = false
        void (async () => {
            try {
                const out = await studyBriefApi.get(chatId)
                const id = out.study_brief?.study_id?.trim() || ""
                if (!cancelled && id) setStudyId(id)
                else if (!cancelled && !id) {
                    setLoading(false)
                    setError("No study is linked to this chat yet.")
                }
            } catch (err) {
                console.error("Failed to resolve study from chat:", err)
                if (!cancelled) {
                    setLoading(false)
                    setError("Couldn’t find the study for this chat.")
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [chatId, queryStudyId])

    useEffect(() => {
        if (!studyId || !accessToken) return
        loadStudyDetails()
    }, [studyId, accessToken])

    useEffect(() => {
        if (!studyId || !accessToken) return
        void loadAnalysis()
        void loadSavedReports()
    }, [studyId, accessToken])

    const loadStudyDetails = async () => {
        try {
            setLoading(true)
            setError(null)
            const studyData = await getStudyBasicDetails(studyId)
            setStudy(studyData)
        } catch (err: unknown) {
            console.error("Failed to load study details:", err)
            setError((err as Error)?.message || "Failed to load study details")
        } finally {
            setLoading(false)
        }
    }

    const buildHtmlExport = async () => {
        if (!study || !analysisData) return

        const exportTitle =
            study.title || analysisData?.["Information Block"]?.["Study Title"] || "Study Analytics"
        const exportStudyType =
            (study.study_type || analysisData?.["Information Block"]?.["Study Type"] || "text").toLowerCase()

        try {
            setExportingHtml(true)
            setExportHtmlStage("preparing")
            await exportDesignConfiguratorHtml({
                studyId,
                studyTitle: exportTitle,
                studyType: exportStudyType,
                analysisData,
                designConstraints: study.design_constraints || [],
                studyLayers: study.study_layers || [],
                onStageChange: setExportHtmlStage,
            })
        } catch (e) {
            console.error("Export HTML failed:", e)
            alert((e as Error)?.message || "Failed to export HTML")
        } finally {
            setExportingHtml(false)
            setExportHtmlStage("preparing")
        }
    }

    const hasFilteredExport = isFilterActive && hasAnyFilterSelection(activeFilters)

    const safeFileNamePart = (value: string | null | undefined, fallback: string) => {
        const cleaned = (value || fallback)
            .trim()
            .replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
        return cleaned || fallback
    }

    useEffect(() => {
        if (!exportMenuOpen) return

        const handlePointerDown = (event: MouseEvent) => {
            if (!exportMenuRef.current?.contains(event.target as Node)) {
                setExportMenuOpen(false)
            }
        }

        document.addEventListener("mousedown", handlePointerDown)
        return () => document.removeEventListener("mousedown", handlePointerDown)
    }, [exportMenuOpen])

    const downloadCsv = async (
        filters: StudyFilterPayload["filters"] | null | undefined,
        suffix: string
    ) => {
        if (!study) return

        const blob = await downloadStudyResponsesCsv(studyId, filters ?? undefined)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${safeFileNamePart(study?.title, "study")}-${safeFileNamePart(suffix, "analysis")}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
    }

    const buildCsvAndDownload = async (mode: "filtered" | "complete" = hasFilteredExport ? "filtered" : "complete") => {
        if (!study) return

        const shouldUseFilters = mode === "filtered" && hasFilteredExport
        const filters = shouldUseFilters ? activeFilters : undefined
        const suffix = shouldUseFilters ? "filtered-analysis" : "analysis"

        try {
            setExportMenuOpen(false)
            setExporting(true)
            setExportModeLabel(shouldUseFilters ? "Exporting filtered CSV..." : "Exporting complete CSV...")
            setExportStage(1)
            await new Promise(resolve => setTimeout(resolve, 1000))
            setExportStage(2)
            await new Promise(resolve => setTimeout(resolve, 1000))
            setExportStage(3)
            await new Promise(resolve => setTimeout(resolve, 500))

            await downloadCsv(filters, suffix)
        } catch (e) {
            console.error('Export CSV failed:', e)
            alert('Failed to export CSV')
        } finally {
            setExporting(false)
            setExportStage(0)
            setExportModeLabel("Exporting...")
        }
    }

    const downloadSavedReportCsv = async (report: SavedFilterReport) => {
        if (!study || downloadingReportId || exporting) return

        try {
            setDownloadingReportId(report.id)
            await downloadCsv(report.filters, `${report.name || "saved-report"}-filtered-analysis`)
        } catch (e) {
            console.error("Saved report export failed:", e)
            alert((e as Error)?.message || "Failed to export saved report")
        } finally {
            setDownloadingReportId(null)
        }
    }

    const [analyticsView, setAnalyticsView] = useState<"overview" | "configurator" | "detail">("overview")
    const [pendingAssistantDesign, setPendingAssistantDesign] = useState<{
        elements?: any[]
        selected_by_category?: Record<string, string>
        metric?: string | null
        segment_label?: string | null
        requestId?: string | number | null
    } | null>(null)
    const [activeView, setActiveView] = useState("table")

    // Smooth scroll to top when switching tabs to prevent jarring layout shift.
    // The page content scrolls inside scrollContainerRef (h-screen root + overflow-auto),
    // not the window, so scroll that container.
    useEffect(() => {
        if (!analysisData) return
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        window.scrollTo({ top: 0, behavior: "smooth" })
    }, [analyticsView, analysisData])
    const [activeMetric, setActiveMetric] = useState("Top Down")
    const [activeTab, setActiveTab] = useState("Overall")

    const studyTypeForAssistant = useMemo(() => {
        const raw = study?.study_type || analysisData?.["Information Block"]?.["Study Type"] || "text"
        return typeof raw === "string" ? raw.toLowerCase() : "text"
    }, [study?.study_type, analysisData])

    const handleAssistantAction = async (action: AssistantAction, response?: AssistantQueryResponse) => {
        try {
            if (action.type === "open_view") {
                const view = String(action.payload?.view || "overview")
                if (view === "overview" || view === "configurator" || view === "detail") {
                    setAnalyticsView(view)
                }
                return
            }
            if (action.type === "open_configurator") {
                const design = action.payload?.design
                if (design) {
                    setPendingAssistantDesign({
                        elements: Array.isArray(design.elements) ? design.elements : [],
                        selected_by_category: design.selected_by_category || {},
                        metric:
                            action.payload?.metric ||
                            response?.applied_context?.metric ||
                            null,
                        segment_label:
                            action.payload?.segment_label ||
                            response?.applied_context?.segment_label ||
                            null,
                        requestId: `${Date.now()}-${design.fact_id || design.rank || "design"}`,
                    })
                }
                setAnalyticsView("configurator")
                return
            }
            if (action.type === "set_metric") {
                const metric = String(action.payload?.metric || "Top Down")
                setActiveMetric(metric)
                setAnalyticsView("detail")
                return
            }
            if (action.type === "apply_filter") {
                const filters = action.payload?.filters
                if (filters) await runFilteredAnalysis(filters)
                return
            }
            if (action.type === "export_csv") {
                await buildCsvAndDownload("filtered")
                return
            }
            if (action.type === "download_ppt") {
                const payloadFilters =
                    (action.payload?.filters as StudyFilterPayload["filters"] | undefined) ||
                    (isFilterActive ? activeFilters : undefined)
                const { blob, filename } = await downloadAnalyticsAssistantPpt(studyId, {
                    filters: payloadFilters || null,
                    use_active_filters: Boolean(isFilterActive) && !action.payload?.filters,
                    metric: String(action.payload?.metric || "T"),
                    segment_section: action.payload?.segment_section || null,
                    segment_key: action.payload?.segment_key || null,
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = filename || `${safeFileNamePart(study?.title, "study")}-MindSurve-analytics.pptx`
                a.click()
                URL.revokeObjectURL(url)
                return
            }
            if (action.type === "save_design") {
                const design = action.payload?.design
                if (!design || !studyId) return
                const metricLabel = String(action.payload?.metric || response?.applied_context?.metric || "Top Down")
                const elements = Array.isArray(design.elements) ? design.elements : []
                const selected_by_category: Record<string, string> = design.selected_by_category || {}
                const configuration = {
                    metric: metricLabel as "Top Down" | "Bottom Up" | "Response Time",
                    study_type: studyTypeForAssistant as "grid" | "layer" | "text" | "hybrid",
                    design_type: "configurator" as const,
                    segment: {
                        label: String(action.payload?.segment_label || response?.applied_context?.segment_label || "Overall"),
                    },
                    selected_by_category,
                    selected_elements: elements.map((el: any) => ({
                        id: el.element_id,
                        name: el.name,
                        category: el.category_name,
                        value: el.value,
                        imageUrl: el.image_url,
                        elementType: el.element_type,
                        zIndex: el.z_index,
                        layerId: el.layer_id,
                        imageId: el.image_id,
                        transform: el.transform,
                    })),
                    total_coefficient: design.score,
                    background_url:
                        response?.blocks?.find((b) =>
                          ["top_k_designs", "side_by_side_compare", "design_explanation"].includes(b.type)
                        )?.data?.background_url ?? null,
                    aspect_ratio:
                        response?.blocks?.find((b) =>
                          ["top_k_designs", "side_by_side_compare", "design_explanation"].includes(b.type)
                        )?.data?.aspect_ratio ?? null,
                    show_layer_background: true,
                }
                const name = `Assistant design #${design.rank} · ${new Date().toLocaleString()}`
                await createSavedDesign(studyId, name, configuration, "configurator")
                setAnalyticsView("configurator")
                alert("Design saved to the configurator.")
                return
            }
            if (action.type === "compare_designs") {
                setAnalyticsView("configurator")
            }
        } catch (e) {
            console.warn("Assistant action failed:", e)
            alert((e as Error)?.message || "Assistant action failed")
        }
    }

    const assistant = useAnalyticsAssistant({
        studyId,
        studyType: studyTypeForAssistant,
        activeFilters: activeFilters as Record<string, any> | null,
        isFilterActive,
        onAction: handleAssistantAction,
    })

    const loadingMessages = useMemo(
        () =>
            isFilterActive || filterRunning
                ? [
                      "Applying your filters…",
                      "Building segment insights…",
                      "Crunching the numbers…",
                      "Updating your dashboard…",
                      "Almost there…",
                  ]
                : [
                      "Getting your responses...",
                      "Crunching the numbers...",
                      "Building your analysis...",
                      "Creating insights...",
                      "Almost there...",
                  ],
        [isFilterActive, filterRunning]
    )
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
    useEffect(() => {
        if (!analysisLoading) return
        const id = setInterval(() => {
            setLoadingMessageIndex((i) => (i + 1) % loadingMessages.length)
        }, 2200)
        return () => clearInterval(id)
    }, [analysisLoading, loadingMessages.length])

    if (loading || !studyId) {
        return (
            <AuthGate requireAuth>
            <div className="flex min-h-screen flex-col bg-gray-50">
                <AnalyticsNavbar />
                <div className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
                </div>
            </div>
            </AuthGate>
        )
    }

    const classificationQuestions =
        (study as any)?.classification_questions ??
        (analysisData as any)?.classification_questions ??
        (analysisData as any)?.meta?.classification_questions

    const pageTitle = study?.title || analysisData?.["Information Block"]?.["Study Title"] || "Study Analytics"
    const rawStudyType = study?.study_type || analysisData?.["Information Block"]?.["Study Type"] || "text"
    const studyType = typeof rawStudyType === "string" ? rawStudyType.toLowerCase() : "text"

    if (error && !analysisData) {
        return (
            <AuthGate requireAuth>
            <div className="flex min-h-screen flex-col bg-gray-50">
                <AnalyticsNavbar />
                <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
                        <h2 className="mb-2 text-lg font-semibold text-red-800">Error</h2>
                        <p className="text-red-600">{error || "Study not found"}</p>
                        <button
                            type="button"
                            onClick={() => router.push(chatHref)}
                            className="mt-4 cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                        >
                            Back to chat
                        </button>
                    </div>
                </div>
            </div>
            </AuthGate>
        )
    }

    return (
            <AuthGate requireAuth>
            <>
            {/* h-screen (not min-h-screen) is required: it bounds the overflow-auto child
                so IT becomes the real scroll container. position:sticky inside (design
                configurator columns) resolves against the nearest overflow ancestor —
                with min-h-screen that ancestor never scrolls (the window does) and
                sticky silently never engages. */}
            <div className="flex h-screen bg-gray-50">
            <AnalyticsSavedReportsSidebar
                reports={savedReports}
                onSelectReport={(report) => void applySavedReport(report)}
                onRename={async (reportId, name) => {
                    const snapshot = savedReports
                    setSavedReports((prev) =>
                        prev.map((r) => (r.id === reportId ? { ...r, name } : r))
                    )
                    try {
                        await renameSavedFilterReport(studyId, reportId, name)
                    } catch (e) {
                        setSavedReports(snapshot)
                        console.warn("Failed to rename saved report:", e)
                        alert((e as Error)?.message ?? "Failed to rename report")
                    }
                }}
                onDelete={async (reportId) => {
                    const snapshot = savedReports
                    setSavedReports((prev) => prev.filter((r) => r.id !== reportId))
                    try {
                        await deleteSavedFilterReport(studyId, reportId)
                    } catch (e) {
                        setSavedReports(snapshot)
                        console.warn("Failed to delete saved report:", e)
                        alert((e as Error)?.message ?? "Failed to delete report")
                    }
                }}
                onDownloadReport={(report) => void downloadSavedReportCsv(report)}
                activeFilters={isFilterActive ? activeFilters : null}
                loading={savedReportsLoading}
                applyingId={applyingReportId}
                downloadingId={downloadingReportId}
                assistantOpen={assistant.open}
            />

            <div ref={scrollContainerRef} className="@container/analytics flex-1 overflow-auto min-w-0">
                <AnalyticsNavbar />

                {/* Header Section */}
                <div className="relative z-10 text-white overflow-visible" style={{ backgroundColor: '#2674BA' }}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6">
                        {/* Breadcrumbs */}
                        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs md:text-sm mb-3 sm:mb-4">
                            <Link href={chatHref} className="cursor-pointer text-blue-200 hover:text-white transition-colors shrink-0">Chat</Link>
                            <span className="text-blue-300 opacity-50 shrink-0">/</span>
                            <span className="text-white font-medium break-words">
                                {studyType === "grid" ? "Grid Study" : studyType === "hybrid" ? "Hybrid Study" : studyType === "text" ? "Text Study" : "Layer Study"} Analytics
                            </span>
                        </nav>

                        {/* Title and Actions — stack until content is wide enough; never crush title beside a button row */}
                        <div className="flex flex-col gap-4 @5xl/analytics:flex-row @5xl/analytics:items-start @5xl/analytics:justify-between @5xl/analytics:gap-6">
                            <h1 className="w-full min-w-0 text-lg @md/analytics:text-xl @3xl/analytics:text-2xl @5xl/analytics:flex-1 @5xl/analytics:text-3xl font-bold tracking-tight leading-snug break-words">
                                {pageTitle}
                            </h1>
                            <div className="grid w-full grid-cols-2 gap-2 @5xl/analytics:flex @5xl/analytics:w-auto @5xl/analytics:max-w-none @5xl/analytics:flex-wrap @5xl/analytics:items-center @5xl/analytics:justify-end @5xl/analytics:gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSettingsOpen(true)}
                                    className="cursor-pointer flex w-full items-center justify-center gap-1.5 px-3 py-2.5 border rounded-lg transition-all duration-200 hover:bg-white/10 active:scale-95 text-xs @md/analytics:text-sm font-semibold @5xl/analytics:w-auto @5xl/analytics:gap-2 @5xl/analytics:px-4"
                                    style={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: '#FFFFFF' }}
                                >
                                    <Settings2 className="w-4 h-4 shrink-0" />
                                    <span className="truncate">Analysis Settings</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterError(null)
                                        setSaveReportError(null)
                                        setAdvancedFilterOpen(true)
                                    }}
                                    className="cursor-pointer flex w-full items-center justify-center gap-1.5 px-3 py-2.5 border rounded-lg transition-all duration-200 hover:bg-white/10 active:scale-95 text-xs @md/analytics:text-sm font-semibold @5xl/analytics:w-auto @5xl/analytics:gap-2 @5xl/analytics:px-4"
                                    style={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: '#FFFFFF' }}
                                >
                                    <Filter className="w-4 h-4 shrink-0" />
                                    <span className="truncate">Advanced Filter</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => router.push(chatHref)}
                                    className="cursor-pointer flex w-full items-center justify-center gap-1.5 px-3 py-2.5 border rounded-lg transition-all duration-200 hover:bg-white/10 active:scale-95 text-xs @md/analytics:text-sm font-semibold @5xl/analytics:w-auto @5xl/analytics:gap-2 @5xl/analytics:px-4"
                                    style={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: '#FFFFFF' }}
                                >
                                    <ArrowLeft className="w-4 h-4 shrink-0" />
                                    <span className="truncate">Back to chat</span>
                                </button>

                                <div
                                    ref={exportMenuRef}
                                    className="relative z-30 col-span-2 w-full overflow-visible @5xl/analytics:col-span-1 @5xl/analytics:w-auto"
                                >
                                    <div
                                        className={`flex w-full items-stretch overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-white/30 transition-all duration-200 hover:shadow-lg ${
                                            exportMenuOpen ? "ring-2 ring-white/50 shadow-lg" : ""
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => void buildCsvAndDownload()}
                                            disabled={exporting || !study}
                                            className="cursor-pointer flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2.5 transition-all duration-200 active:scale-[0.98] font-bold text-xs @md/analytics:text-sm disabled:cursor-not-allowed disabled:opacity-70 @5xl/analytics:flex-none @5xl/analytics:gap-2 @5xl/analytics:px-4"
                                            style={{ color: '#2674BA' }}
                                        >
                                            {exporting ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current shrink-0" />
                                                    <span className="truncate">
                                                        {exportStage === 1 && "Extracting..."}
                                                        {exportStage === 2 && "Processing..."}
                                                        {exportStage === 3 && "Generating..."}
                                                        {exportStage === 0 && exportModeLabel}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="w-4 h-4 shrink-0" />
                                                    <span>{hasFilteredExport ? "Export CSV with filters" : "Export CSV"}</span>
                                                </>
                                            )}
                                        </button>
                                        {hasFilteredExport && (
                                            <>
                                                <div className="w-px shrink-0 bg-[#2674BA]/12 self-stretch my-2" aria-hidden="true" />
                                                <button
                                                    type="button"
                                                    onClick={() => setExportMenuOpen((open) => !open)}
                                                    disabled={exporting || !study}
                                                    className={`cursor-pointer flex shrink-0 items-center justify-center px-2.5 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                                                        exportMenuOpen ? "bg-[#2674BA]/8" : "hover:bg-[#2674BA]/6"
                                                    }`}
                                                    style={{ color: '#2674BA' }}
                                                    aria-label="More export options"
                                                    aria-expanded={exportMenuOpen}
                                                    aria-haspopup="menu"
                                                >
                                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${exportMenuOpen ? "rotate-180" : ""}`} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <AnimatePresence>
                                        {hasFilteredExport && exportMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                transition={{ duration: 0.15, ease: "easeOut" }}
                                                role="menu"
                                                className="absolute right-0 top-[calc(100%+0.5rem)] z-[200] w-72 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-2xl"
                                            >
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => void buildCsvAndDownload("complete")}
                                                    className="cursor-pointer flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-50"
                                                >
                                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                                        <Download className="h-4 w-4" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-semibold text-slate-900">Export complete CSV</span>
                                                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                                                            Download the full study report without any filters applied.
                                                        </span>
                                                    </span>
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {analysisError && (
                        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                            <p className="font-medium">Analysis could not be loaded</p>
                            <p className="text-sm mt-1">{analysisError}</p>
                        </div>
                    )}

                    {filterError && (
                        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                            <p className="font-medium">Filter could not be applied</p>
                            <p className="text-sm mt-1">{filterError}</p>
                        </div>
                    )}

                    {isFilterActive && activeFilters && !analysisLoading && (
                        <div className="mb-6 flex flex-col @3xl/analytics:flex-row @3xl/analytics:items-center @3xl/analytics:justify-between gap-3 rounded-xl border border-[#2674BA]/25 bg-[#2674BA]/5 px-4 py-3">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="shrink-0 w-9 h-9 rounded-lg bg-[#2674BA]/15 flex items-center justify-center">
                                    <Filter className="w-4 h-4 text-[#2674BA]" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[#2674BA]">Filtered analysis active</p>
                                    <p className="text-sm text-gray-600 truncate">
                                        {describeAppliedFilters(activeFilters)}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => void clearActiveFilter()}
                                className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 shrink-0"
                            >
                                <X className="w-3.5 h-3.5" />
                                Clear filter
                            </button>
                        </div>
                    )}

                    {analysisLoading ? (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50/80 rounded-xl border border-gray-100">
                            <div className="animate-spin rounded-full h-14 w-14 border-2 border-[#2674BA] border-t-transparent" />
                            <p className="mt-5 text-lg font-medium text-gray-700 transition-opacity duration-300">
                                {loadingMessages[loadingMessageIndex]}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Something good is cooking…
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Overview / Design Configurator / Detail Analysis toggle */}
                            {analysisData && (
                                <div className="flex flex-wrap gap-2 mb-6">
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsView("overview")}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                            analyticsView === "overview"
                                                ? "text-white shadow-sm"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                        style={analyticsView === "overview" ? { backgroundColor: "#2674BA" } : undefined}
                                    >
                                        <LayoutDashboard className="w-4 h-4" />
                                        Overview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsView("configurator")}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                            analyticsView === "configurator"
                                                ? "text-white shadow-sm"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                        style={analyticsView === "configurator" ? { backgroundColor: "#2674BA" } : undefined}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Design Configurator
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsView("detail")}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                            analyticsView === "detail"
                                                ? "text-white shadow-sm"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                        style={analyticsView === "detail" ? { backgroundColor: "#2674BA" } : undefined}
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                        Detail Analysis
                                    </button>
                                </div>
                            )}

                            <div className="min-h-[50vh]">
                            <AnimatePresence mode="wait">
                                {analyticsView === "overview" && analysisData && (
                                    <motion.div
                                        key="overview"
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -16 }}
                                        transition={{ duration: 0.25 }}
                                        className="space-y-0"
                                    >
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.4 }}>
                                            <AnalyticsKPICards analysisData={analysisData} studyType={studyType} />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
                                            <AnalyticsResponseTimeSection analysisData={analysisData} />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
                                            <AnalyticsPieCharts analysisData={analysisData} />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.4 }}>
                                            <AnalyticsTopBottomPerformers analysisData={analysisData} studyType={studyType} />
                                        </motion.div>
                                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.4 }} className="mt-10">
                                            <AnalyticsPersonaBlueprints
                                                analysisData={analysisData}
                                                studyType={studyType as "text" | "grid" | "layer" | "hybrid"}
                                            />
                                        </motion.div>
                                    </motion.div>
                                )}
                                {analyticsView === "detail" && analysisData && (
                                    <motion.div
                                        key="detail"
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -16 }}
                                        transition={{ duration: 0.25 }}
                                    >
                                        <AnalyticsToolbar
                                            activeView={activeView}
                                            setActiveView={setActiveView}
                                            activeMetric={activeMetric}
                                            setActiveMetric={setActiveMetric}
                                            activeTab={activeTab}
                                            setActiveTab={setActiveTab}
                                        />
                                        {activeView === "table" ? (
                                            <AnalyticsTable
                                                analysisData={analysisData}
                                                activeMetric={activeMetric}
                                                activeTab={activeTab}
                                                studyType={studyType}
                                                appliedFilters={isFilterActive ? activeFilters : null}
                                                onPrelimColumnClick={handlePrelimColumnClick}
                                            />
                                        ) : activeView === "heatmap" ? (
                                            <AnalyticsHeatmap
                                                analysisData={analysisData}
                                                activeMetric={activeMetric}
                                                activeTab={activeTab}
                                                studyType={studyType}
                                                appliedFilters={isFilterActive ? activeFilters : null}
                                                onPrelimColumnClick={handlePrelimColumnClick}
                                            />
                                        ) : activeView === "graph" ? (
                                            <AnalyticsGraph
                                                analysisData={analysisData}
                                                activeMetric={activeMetric}
                                                activeTab={activeTab}
                                                studyType={studyType}
                                                appliedFilters={isFilterActive ? activeFilters : null}
                                                onPrelimColumnClick={handlePrelimColumnClick}
                                            />
                                        ) : (
                                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center text-gray-500">
                                                <BarChart3 className="w-16 h-16 mx-auto mb-4" style={{ color: "#2674BA" }} />
                                                <h3 className="text-xl font-semibold text-gray-700">Analytics Content for {activeTab}</h3>
                                                <p>Displaying {activeMetric} in {activeView} view.</p>
                                                <p className="mt-2 text-sm italic">We are currently building the detailed visualizations for this section.</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Keep mounted when not active so configurator selections persist when switching tabs */}
                            <div className={analyticsView !== "configurator" ? "hidden" : undefined}>
                                <AnalyticsDesignConfigurator
                                    analysisData={analysisData}
                                    studyId={studyId}
                                    studyType={studyType}
                                    designConstraints={study?.design_constraints || []}
                                    studyLayers={study?.study_layers || []}
                                    pendingAssistantDesign={pendingAssistantDesign}
                                    onPendingAssistantDesignConsumed={() => setPendingAssistantDesign(null)}
                                    onExportHtml={() => void buildHtmlExport()}
                                    isExportingHtml={exportingHtml}
                                    exportHtmlStage={exportHtmlStage}
                                />
                            </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <AnalyticsAssistantPanel
                open={assistant.open}
                onOpenChange={assistant.setOpen}
                messages={assistant.messages}
                input={assistant.input}
                setInput={assistant.setInput}
                loading={assistant.loading}
                historyLoading={assistant.historyLoading}
                loadingOlder={assistant.loadingOlder}
                hasMoreOlder={assistant.hasMoreOlder}
                showWelcome={assistant.showWelcome}
                error={assistant.error}
                starters={assistant.starters}
                studyType={studyType}
                sendMessage={assistant.sendMessage}
                loadOlderMessages={assistant.loadOlderMessages}
                retryLast={assistant.retryLast}
                clearChat={assistant.clearChat}
                runAction={assistant.runAction}
            />
            </div>

            <AnalyticsSettingsModal
                studyId={studyId}
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onOpenAdvancedFilter={() => {
                    setSettingsOpen(false)
                    setFilterError(null)
                    setSaveReportError(null)
                    setAdvancedFilterOpen(true)
                }}
                onSaved={() => {
                    void loadAnalysis()
                }}
            />

            <AnalyticsAdvancedFilterModal
                studyId={studyId}
                classificationQuestions={classificationQuestions}
                initialFilters={activeFilters}
                savedReports={savedReports}
                isOpen={advancedFilterOpen}
                onClose={() => {
                    setAdvancedFilterOpen(false)
                    setSaveReportError(null)
                }}
                onRunAnalysis={(filters) => void runFilteredAnalysis(filters)}
                onSaveAndRun={(name, filters) => saveAndRunFilteredAnalysis(name, filters)}
                isRunning={filterRunning || saveAndRunPending}
                error={filterError}
                saveError={saveReportError}
            />

            <AnalyticsPrelimCohortModal
                isOpen={cohortOpen}
                onClose={() => {
                    setCohortOpen(false)
                    setCohortSelection(null)
                    setCohortData(null)
                    setCohortError(null)
                }}
                selection={cohortSelection}
                data={cohortData}
                isLoading={cohortLoading}
                isLoadingMore={cohortLoadingMore}
                error={cohortError}
                onRetry={() => {
                    if (cohortSelection) {
                        void loadClassificationCohort(cohortSelection, 0, false)
                    }
                }}
                onLoadMore={loadMoreCohort}
            />
            </>
            </AuthGate>
    )
}

export default function AnalyticsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-gray-50">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
                </div>
            }
        >
            <StudyAnalyticsPage />
        </Suspense>
    )
}
