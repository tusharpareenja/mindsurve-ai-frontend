"use client"

import React from "react"
import { motion } from "framer-motion"
import { transformAnalysisForView, groupPrelimCategories } from "@/lib/utils/analysisTransform"
import type { StudyFilterPayload } from "@/lib/api/ResponseAPI"

interface AnalyticsTableProps {
    analysisData: any
    activeMetric: string
    activeTab: string
    studyType?: string
    appliedFilters?: StudyFilterPayload["filters"] | null
    onPrelimColumnClick?: (selection: { questionText: string; answer: string; baseSize?: number }) => void
}

function formatCategoryLabel(title: string, isLayerStudy: boolean) {
    return isLayerStudy ? `Layer: ${title}` : title
}

export const AnalyticsTable: React.FC<AnalyticsTableProps> = ({
    analysisData,
    activeMetric,
    activeTab,
    studyType,
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

    if (!analysisData || categories.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
                <p>No analysis data. Load analysis.json for {activeMetric} / {activeTab}.</p>
            </div>
        )
    }

    const renderTable = (category: (typeof categories)[0], catIndex: number, keyPrefix = "") => {
        const sectionColumns = category.columns || columns
        const sectionTitle = formatCategoryLabel(category.title, isLayerStudy)

        return (
            <motion.div
                key={`${keyPrefix}${category.groupTitle || ""}-${category.title}-${catIndex}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: catIndex * 0.06 }}
                className="space-y-4"
            >
                <h3 className={`font-bold text-gray-900 text-left ${isPrelim ? "text-base" : "text-lg"}`}>
                    {sectionTitle}
                </h3>
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-4 md:px-6 py-4 font-medium text-gray-500 min-w-[200px] md:w-[40%]">
                                        Response
                                    </th>
                                    {sectionColumns.map((col) => {
                                        const count = parseCount(col.subLabel)
                                        const canOpen = isPrelim && !!category.groupTitle && count > 0 && !!onPrelimColumnClick
                                        return (
                                        <th key={col.key} className="px-6 py-4 font-medium text-gray-500">
                                            <div className="flex flex-col">
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
                                                        className="cursor-pointer text-left text-gray-900 font-semibold hover:text-[#2674BA] transition-colors"
                                                        title="Click to compare respondents for this option"
                                                    >
                                                        {col.label}
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-900 font-semibold">{col.label}</span>
                                                )}
                                                {col.subLabel && (
                                                    <span className={`text-xs mt-0.5 ${canOpen ? "text-[#2674BA] font-semibold" : "text-gray-400"}`}>
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
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {category.data.map((row, idx) => (
                                    <motion.tr
                                        key={idx}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.5) }}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-4 md:px-6 py-4 text-gray-700 font-medium text-xs md:text-sm">
                                            {row.response}
                                        </td>
                                        {sectionColumns.map((col) => (
                                            <td key={col.key} className="px-6 py-4 text-gray-900 font-medium">
                                                {row[col.key] !== undefined ? row[col.key] : "-"}
                                            </td>
                                        ))}
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>
        )
    }

    if (isPrelim) {
        const questionGroups = groupPrelimCategories(categories)
        return (
            <div className="space-y-14 pb-12">
                {questionGroups.map((group, groupIndex) => (
                    <div key={group.question || groupIndex} className="space-y-8">
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-1.5 rounded-full bg-[#2674BA] shrink-0 mt-1" />
                            <h2 className="text-xl font-bold text-gray-900 text-left leading-snug">
                                {group.question}
                            </h2>
                        </div>
                        <div className="space-y-10 pl-0 sm:pl-4">
                            {group.tables.map((category, catIndex) =>
                                renderTable(category, catIndex, `${group.question}-`)
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-12 pb-12">
            {categories.map((category, catIndex) => renderTable(category, catIndex))}
        </div>
    )
}
