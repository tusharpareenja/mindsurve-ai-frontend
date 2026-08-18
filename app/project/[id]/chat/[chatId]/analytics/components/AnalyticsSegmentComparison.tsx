"use client"

import React from "react"
import { motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { getSegmentComparisonData } from "@/lib/utils/analysisDashboard"

const COLORS = ["#2674BA", "#22C55E", "#FCCD5B", "#F7945A", "#BB8FCE", "#82E0AA"]

interface AnalyticsSegmentComparisonProps {
  analysisData: any
  activeMetric: string
  segmentType: "Age" | "Gender"
  studyType?: string
}

export function AnalyticsSegmentComparison({
  analysisData,
  activeMetric,
  segmentType,
  studyType,
}: AnalyticsSegmentComparisonProps) {
  const data = getSegmentComparisonData(analysisData || {}, activeMetric, segmentType)
  const categoryLabel = (studyType || "").toLowerCase() === "layer" ? "Layer" : "Category"

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
        <p>No segment comparison data for {segmentType}.</p>
      </div>
    )
  }

  const segmentKeys = Object.keys(data[0]).filter((k) => k !== "category")

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8"
    >
      <div className="flex items-center gap-2 mb-6">
        <div className="h-8 w-1.5 rounded-full bg-[#2674BA]" />
        <h3 className="text-lg font-bold text-gray-800">
          {segmentType} Comparison by {categoryLabel} ({activeMetric})
        </h3>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 11, fill: "#64748b" }}
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Legend />
            {segmentKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
