"use client"

import React from "react"
import { motion } from "framer-motion"
import { Lightbulb, TrendingUp, BarChart2, GitCompare } from "lucide-react"
import { getKeyInsights } from "@/lib/utils/analysisDashboard"

const ICON_MAP = { top: TrendingUp, category: BarChart2, variance: GitCompare }
const COLORS = { top: "#2674BA", category: "#22C55E", variance: "#F7945A" }

interface AnalyticsInsightCardsProps {
  analysisData: any
  studyType?: string
}

export function AnalyticsInsightCards({ analysisData, studyType }: AnalyticsInsightCardsProps) {
  const insightsRaw = getKeyInsights(analysisData || {})
  const isLayerStudy = (studyType || "").toLowerCase() === "layer"
  const insights = isLayerStudy
    ? insightsRaw.map((i) => ({ ...i, title: i.title.replace(/\bCategory\b/g, "Layer") }))
    : insightsRaw

  if (insights.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-5 h-5" style={{ color: "#2674BA" }} />
        <h3 className="text-base font-bold text-gray-800">Key Insights</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Top per metric (T, B, R); Best across = strong in all. Strongest & Polarized from Top Down only.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight, i) => {
          const Icon = ICON_MAP[insight.type] || Lightbulb
          const color = COLORS[insight.type] || "#2674BA"
          return (
            <motion.div
              key={insight.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-3 items-start"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                  {insight.title}
                </p>
                <p className="text-sm font-medium text-gray-800 leading-snug">{insight.value}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
