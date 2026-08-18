"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, TrendingDown, Clock, BarChart3 } from "lucide-react"
import { getFatigueRisk, type FatigueRiskItem } from "@/lib/utils/analysisDashboard"

interface AnalyticsFatiguePredictorProps {
  analysisData: any
  /** Max number of fatigue-risk elements to show (default 8) */
  maxItems?: number
}

export function AnalyticsFatiguePredictor({
  analysisData,
  maxItems = 8,
}: AnalyticsFatiguePredictorProps) {
  const items = useMemo(
    () => getFatigueRisk(analysisData || {}, undefined, { topN: maxItems, minAppearances: 3 }),
    [analysisData, maxItems]
  )

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-1.5 rounded-full bg-amber-500" />
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Fatigue & Resistance Predictor
          </h3>
        </div>
        <p className="text-gray-500 text-sm">
          No strong fatigue signals detected. Elements need enough early vs. late task appearances to compute risk.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-amber-100 shadow-sm p-6"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-1.5 rounded-full bg-amber-500" />
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Fatigue & Resistance Predictor
        </h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Elements that perform well at first but show decline or resistance across repeated exposures.
      </p>

      <div className="space-y-4">
        {items.map((item, index) => (
          <FatigueRiskCard key={item.elementKey} item={item} index={index} />
        ))}
      </div>
    </motion.div>
  )
}

function FatigueRiskCard({ item, index }: { item: FatigueRiskItem; index: number }) {
  const [expanded, setExpanded] = React.useState(false)
  const displayName = expanded ? item.name : item.shortName

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-amber-200/80 bg-amber-50/50 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-amber-50/80 transition-colors"
      >
        <span className="flex-shrink-0 mt-0.5 text-amber-600" aria-hidden>
          <AlertTriangle className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-800 text-sm leading-snug">
            {displayName}
            {item.name.length > 50 && (
              <span className="text-amber-600 ml-1 text-xs">
                {expanded ? " (collapse)" : " (expand)"}
              </span>
            )}
          </p>
          <p className="text-amber-800 text-sm mt-2 italic">{item.summary}</p>
        </div>
      </button>
      <div className="px-4 pb-3 pt-0 flex flex-wrap gap-4 text-xs text-gray-500 border-t border-amber-100">
        <span className="flex items-center gap-1">
          <TrendingDown className="w-3.5 h-3.5" />
          Early avg: {item.earlyAvgRating.toFixed(1)} → Late: {item.lateAvgRating.toFixed(1)}
        </span>
        {item.responseTimeShift > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            RT +{item.responseTimeShift.toFixed(2)}s
          </span>
        )}
        <span className="flex items-center gap-1">
          <BarChart3 className="w-3.5 h-3.5" />
          Volatility: {(item.ratingVolatility ?? 0).toFixed(2)}
        </span>
      </div>
    </motion.div>
  )
}
