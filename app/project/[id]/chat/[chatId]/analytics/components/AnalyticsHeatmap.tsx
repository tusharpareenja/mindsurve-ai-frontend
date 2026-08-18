"use client"

import React from "react"
import { motion } from "framer-motion"
import { transformAnalysisForView, groupPrelimCategories } from "@/lib/utils/analysisTransform"
import type { StudyFilterPayload } from "@/lib/api/ResponseAPI"

interface AnalyticsHeatmapProps {
    analysisData: any
    activeMetric: string
    activeTab: string
    studyType?: string
    elementContentMap?: Record<string, string>
    onElementClick?: (contentUrl: string, elementName: string) => void
    appliedFilters?: StudyFilterPayload["filters"] | null
    onPrelimColumnClick?: (selection: { questionText: string; answer: string; baseSize?: number }) => void
}

function formatCategoryLabel(title: string, isLayerStudy: boolean) {
    return isLayerStudy ? `Layer: ${title}` : title
}

export const AnalyticsHeatmap: React.FC<AnalyticsHeatmapProps> = ({
    analysisData,
    activeMetric,
    activeTab,
    studyType,
    elementContentMap,
    onElementClick,
    appliedFilters,
    onPrelimColumnClick,
}) => {
    const { categories, columns } = transformAnalysisForView(
        analysisData || {},
        activeMetric,
        activeTab,
        appliedFilters
    )
    const isLayerStudy = (studyType || "").toLowerCase() === "layer"
    const isPrelim = activeTab === "Prelim"

    const parseCount = (subLabel?: string) => {
        if (!subLabel) return 0
        const match = subLabel.match(/\d+/)
        return match ? Number(match[0]) : 0
    }

    const getCellColor = (value: number) => {
        const v = Number(value)
        if (v === 0 || isNaN(v)) return "rgba(148, 163, 184, 0.5)"
        if (v < 0) return "#E11D48"
        if (activeMetric === "Response Time") {
            if (v < 0.5) return "#22C55E"
            if (v < 1) return "#82E0AA"
            if (v < 2) return "#FCCD5B"
            return "#F7945A"
        }
        if (v >= 20) return "#2674BA"
        if (v >= 10) return "#22C55E"
        return "#82E0AA"
    }

    if (!analysisData || categories.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
                <p>No analysis data. Load analysis.json for {activeMetric} / {activeTab}.</p>
            </div>
        )
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 },
        },
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 },
    }

    const renderHeatmap = (category: (typeof categories)[0], keyPrefix = "") => {
        const sectionColumns = category.columns || columns
        const sectionTitle = formatCategoryLabel(category.title, isLayerStudy)

        return (
            <div key={`${keyPrefix}${category.groupTitle || ""}-${category.title}`} className="space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h3 className={`font-bold text-gray-900 ${isPrelim ? "text-base" : "text-xl"}`}>
                        {sectionTitle}
                    </h3>
                    {!isPrelim && (
                        <div className="flex items-center gap-4 text-xs flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(148, 163, 184, 0.5)" }} />{" "}
                                Low / Zero
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#82E0AA" }} /> Low+
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#22C55E" }} /> Medium
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#2674BA" }} /> High
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#E11D48" }} /> Negative
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 md:p-8">
                    <div className="flex flex-col md:flex-row">
                        <div className="w-full md:w-[30%] space-y-1 md:pr-6 md:pt-10 mb-4 md:mb-0">
                            {category.data.map((row, i) => {
                                const contentUrl = elementContentMap?.[`${category.title}|${row.response}`]
                                const hasContent = !!contentUrl && contentUrl.startsWith("http")
                                return (
                                    <div key={i} className="h-12 md:h-24 flex items-center md:justify-end md:text-right">
                                        {hasContent && onElementClick ? (
                                            <button
                                                type="button"
                                                onClick={() => onElementClick(contentUrl, String(row.response))}
                                                className="text-[10px] md:text-xs font-bold leading-tight md:max-w-[200px] underline cursor-pointer text-left hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#2674BA]/30 rounded"
                                                style={{ color: "#2674BA" }}
                                            >
                                                {row.response}
                                            </button>
                                        ) : (
                                            <span className="text-[10px] md:text-xs font-bold text-gray-800 leading-tight md:max-w-[200px]">
                                                {row.response}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex-1 overflow-x-auto scrollbar-hide">
                            <div className="min-w-[400px] md:min-w-0">
                                <div className="flex">
                                    {sectionColumns.map((col) => {
                                        const count = parseCount(col.subLabel)
                                        const canOpen = isPrelim && !!category.groupTitle && count > 0 && !!onPrelimColumnClick
                                        return (
                                            <div
                                                key={col.key}
                                                className="flex-1 text-center py-2 text-[10px] md:text-xs font-semibold text-gray-500"
                                            >
                                                {canOpen ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onPrelimColumnClick?.({
                                                                questionText: category.groupTitle || "",
                                                                answer: col.optionFullText || col.label,
                                                                baseSize: count,
                                                            })
                                                        }
                                                        className="cursor-pointer text-gray-800 hover:text-[#2674BA] transition-colors"
                                                        title="Compare respondents for this option"
                                                    >
                                                        {col.label}
                                                    </button>
                                                ) : (
                                                    <div>{col.label}</div>
                                                )}
                                                {col.subLabel && (
                                                    <div className={`text-[8px] md:text-[10px] font-normal ${canOpen ? "text-[#2674BA]" : "text-gray-400"}`}>
                                                        {canOpen ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    onPrelimColumnClick?.({
                                                                        questionText: category.groupTitle || "",
                                                                        answer: col.optionFullText || col.label,
                                                                        baseSize: count,
                                                                    })
                                                                }
                                                                className="cursor-pointer hover:underline"
                                                                title="Open cohort comparison"
                                                            >
                                                                {col.subLabel}
                                                            </button>
                                                        ) : (
                                                            col.subLabel
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                <motion.div
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    key={`${activeTab}-${category.title}-${category.groupTitle || ""}`}
                                    className="space-y-1"
                                >
                                    {category.data.map((row, rowIndex) => (
                                        <div key={rowIndex} className="flex gap-1 h-12 md:h-24">
                                            {sectionColumns.map((col) => {
                                                const val = Number(row[col.key] ?? 0)
                                                const display =
                                                    typeof row[col.key] === "number" &&
                                                    (row[col.key] as number) % 1 !== 0
                                                        ? (row[col.key] as number).toFixed(3)
                                                        : val
                                                return (
                                                    <motion.div
                                                        key={col.key}
                                                        variants={itemVariants}
                                                        whileHover={{
                                                            scale: 1.02,
                                                            filter: "brightness(1.1)",
                                                            cursor: "pointer",
                                                        }}
                                                        className="flex-1 rounded-sm flex items-center justify-center text-white font-bold text-xs md:text-sm transition-all duration-300"
                                                        style={{ backgroundColor: getCellColor(val) }}
                                                    >
                                                        {display}
                                                    </motion.div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (isPrelim) {
        const questionGroups = groupPrelimCategories(categories)
        return (
            <div className="space-y-14 pb-12">
                <div className="flex items-center gap-4 text-xs flex-wrap px-1">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(148, 163, 184, 0.5)" }} /> Low / Zero
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#82E0AA" }} /> Low+
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#22C55E" }} /> Medium
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#2674BA" }} /> High
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#E11D48" }} /> Negative
                    </div>
                </div>
                {questionGroups.map((group, groupIndex) => (
                    <div key={group.question || groupIndex} className="space-y-8">
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-1.5 rounded-full bg-[#2674BA] shrink-0 mt-1" />
                            <h2 className="text-xl font-bold text-gray-900 leading-snug">{group.question}</h2>
                        </div>
                        <div className="space-y-10 pl-0 sm:pl-4">
                            {group.tables.map((category) => renderHeatmap(category, `${group.question}-`))}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return <div className="space-y-12 pb-12">{categories.map((category) => renderHeatmap(category))}</div>
}
