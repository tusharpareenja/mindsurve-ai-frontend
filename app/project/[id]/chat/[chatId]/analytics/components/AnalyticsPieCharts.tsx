"use client"

import React from "react"
import { motion } from "framer-motion"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { getRatingDistribution, getSegmentParticipation, getAgeDistributionByRanges } from "@/lib/utils/analysisDashboard"

const PIE_COLORS = ["#2674BA", "#22C55E", "#FCCD5B", "#F7945A", "#BB8FCE", "#82E0AA", "#C04E35"]

type PieDatum = { name: string; value: number }

interface AnalyticsPieChartsProps {
  analysisData: any
  rawDataOverride?: any[]
}

export function AnalyticsPieCharts({ analysisData, rawDataOverride }: AnalyticsPieChartsProps) {
  const summary = rawDataOverride ? null : analysisData?.dashboard_summary
  const raw = rawDataOverride ?? analysisData?.RawData ?? []
  const ratingData: PieDatum[] = raw.length > 0 ? getRatingDistribution(raw) : summary?.ratingDistribution ?? []
  const ageData: PieDatum[] = raw.length > 0 ? getAgeDistributionByRanges(raw) : summary?.ageDistribution ?? []
  const genderData: PieDatum[] = raw.length > 0 ? getSegmentParticipation(raw, "Gender") : summary?.genderDistribution ?? []

  const charts: { title: string; data: PieDatum[] }[] = [
    { title: "Rating Distribution", data: ratingData },
    { title: "Age Distribution (participants)", data: ageData },
    { title: "Gender Distribution (participants)", data: genderData },
  ].filter((c) => c.data.length > 0)

  if (charts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-500 mb-8">
        <p>No distribution data available.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 @3xl/analytics:grid-cols-2 @6xl/analytics:grid-cols-3 gap-6 mb-8"
    >
      {charts.map((chart, idx) => (
        <div key={chart.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="h-6 w-1 rounded-full"
              style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
            />
            <h3 className="text-base font-bold text-gray-800">{chart.title}</h3>
          </div>
          <div className="h-[240px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={chart.data}
                  cx="50%"
                  cy="45%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={true}
                >
                  {chart.data.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={((value: any, name: any) => {
                    const total = chart.data.reduce((s, d) => s + d.value, 0)
                    const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0
                    return [`${value} (${pct}%)`, name]
                  }) as any}
                />
                <Legend
                  formatter={(value) => {
                    const item = chart.data.find((d) => d.name === value)
                    const total = chart.data.reduce((s, d) => s + d.value, 0)
                    const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : ""
                    return `${value} ${pct}%`
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </motion.div>
  )
}
