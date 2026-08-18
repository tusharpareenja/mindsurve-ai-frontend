"use client"

import React from "react"
import { motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { getBarChartData } from "@/lib/utils/analysisDashboard"

const COLORS = ["#2674BA", "#22C55E", "#FCCD5B", "#F7945A", "#BB8FCE", "#82E0AA", "#C04E35"]

interface AnalyticsKeyInsightsBarProps {
  analysisData: any
  activeMetric: string
  studyType?: string
}

export function AnalyticsKeyInsightsBar({ analysisData, activeMetric, studyType }: AnalyticsKeyInsightsBarProps) {
  const categoryLabel = (studyType || "").toLowerCase() === "layer" ? "Layer" : "Category"
  const data = getBarChartData(analysisData || {}, activeMetric, 10).map((d) => ({
    ...d,
    shortName: d.name.length > 35 ? d.name.slice(0, 32) + "..." : d.name,
  }))

  if (data.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8"
    >
      <div className="flex items-center gap-2 mb-6">
        <div className="h-8 w-1.5 rounded-full bg-[#2674BA]" />
        <h3 className="text-lg font-bold text-gray-800">
          Key Insights – Top Elements by {activeMetric} (Absolute Value)
        </h3>
      </div>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis
              type="category"
              dataKey="shortName"
              width={160}
              tick={{ fontSize: 10, fill: "#475569" }}
              tickLine={false}
            />
            <Tooltip
              content={({ payload }) =>
                payload?.[0] ? (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-sm">
                    <p className="font-semibold text-gray-800 mb-1">{payload[0].payload.name}</p>
                    <p className="text-gray-600">
                      {categoryLabel}: {payload[0].payload.category} · <strong>{payload[0].value}</strong>
                    </p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.value >= 0 ? COLORS[i % COLORS.length] : "#E11D48"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
