"use client"

import React from "react"
import { LayoutGrid, Table, BarChart3 } from "lucide-react"

interface AnalyticsToolbarProps {
    activeView: string
    setActiveView: (view: string) => void
    activeMetric: string
    setActiveMetric: (metric: string) => void
    activeTab: string
    setActiveTab: (tab: string) => void
}

export const AnalyticsToolbar: React.FC<AnalyticsToolbarProps> = ({
    activeView,
    setActiveView,
    activeMetric,
    setActiveMetric,
    activeTab,
    setActiveTab
}) => {
    const views = [
        { id: "table", icon: Table },
        { id: "heatmap", icon: LayoutGrid },
        { id: "graph", icon: BarChart3 },
    ]

    const metrics = ["Top Down", "Bottom Up", "Response Time"]
    const tabs = ["Overall", "Age", "Gender", "Prelim", "2 Market Segments", "3 Market Segments"]

    return (
        <div className="w-full space-y-4 mb-6">
            {/* Top Row: Views and Metrics */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-3">
                    {/* View Toggles */}
                    <div className="flex items-center gap-2">
                        {views.map((view) => (
                            <button
                                key={view.id}
                                onClick={() => setActiveView(view.id)}
                                className={`p-2.5 rounded-lg border transition-all duration-200 cursor-pointer ${activeView === view.id
                                    ? "text-white shadow-sm"
                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                                    }`}
                                style={activeView === view.id ? { backgroundColor: "#2674BA", borderColor: "#2674BA" } : undefined}
                            >
                                <view.icon className="w-5 h-5" />
                            </button>
                        ))}
                    </div>

                    {/* Metric Buttons */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                        {metrics.map((metric) => (
                            <button
                                key={metric}
                                onClick={() => setActiveMetric(metric)}
                                className={`px-4 sm:px-6 py-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${activeMetric === metric
                                    ? "text-white shadow-md"
                                    : "bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100 shadow-sm"
                                    }`}
                                style={activeMetric === metric ? { backgroundColor: "#2674BA", borderColor: "#2674BA" } : undefined}
                            >
                                {metric}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Segmentation Tabs */}
            <div className="w-full bg-white rounded-md border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
                <div className="flex items-center px-2 min-w-max">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`relative px-4 sm:px-6 py-4 text-xs sm:text-sm font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap ${activeTab === tab ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <div
                                    className="absolute bottom-0 left-4 right-4 h-[3px] rounded-t-full"
                                    style={{ backgroundColor: '#2674BA' }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
