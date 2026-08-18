"use client"

import React from "react"
import { motion } from "framer-motion"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { getResponseTimeDistribution, getResponseTimeByTask } from "@/lib/utils/analysisDashboard"

const BAR_COLOR = "#2674BA"

interface AnalyticsResponseTimeSectionProps {
  analysisData: any
  rawDataOverride?: any[]
}

type ResponseTimeByTaskDatum = {
  task: number | string
  avg: number
  count: number
}

type ResponseTimePieDatum = {
  name: string
  value: number
  fill: string
}

export function AnalyticsResponseTimeSection({ analysisData, rawDataOverride }: AnalyticsResponseTimeSectionProps) {
  const summary = rawDataOverride ? null : analysisData?.dashboard_summary
  const raw = rawDataOverride ?? analysisData?.RawData ?? []
  const pieData: ResponseTimePieDatum[] = raw.length > 0 ? getResponseTimeDistribution(raw) : summary?.responseTimeDistribution ?? []
  const taskSource: ResponseTimeByTaskDatum[] = raw.length > 0 ? getResponseTimeByTask(raw) : summary?.responseTimeByTask ?? []
  const taskData = taskSource.map((d) => ({
    name: `Task ${d.task}`,
    "Avg Time (s)": Number(d.avg.toFixed(3)),
    count: d.count,
  }))

  if (raw.length === 0 && !summary) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
        <p>No response time data available.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 @5xl/analytics:grid-cols-2 gap-6 mb-8"
    >
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-1.5 rounded-full bg-[#2674BA]" />
          <h3 className="text-lg font-bold text-gray-800">Response Time Distribution</h3>
        </div>
        {pieData.length > 0 ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={((value: any, name: any) => [`${value} responses`, name]) as any} />
                <Legend
                  formatter={(value) => {
                    const item = pieData.find((d) => d.name === value)
                    const total = pieData.reduce((s, d) => s + d.value, 0)
                    const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : ""
                    return `${value} ${pct}%`
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-12">No response time distribution data.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-1.5 rounded-full bg-[#2674BA]" />
          <h3 className="text-lg font-bold text-gray-800">Avg Response Time by Task</h3>
        </div>
        {taskData.length > 0 ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                />
                <Tooltip
                  formatter={((value: any) => [`${(Number(value) * 1000).toFixed(0)} ms`, "Avg Time"]) as any}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="Avg Time (s)" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-12">No task response time data.</p>
        )}
      </div>
    </motion.div>
  )
}
