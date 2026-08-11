"use client"

import {
  formatAvgDuration,
  type ResponseStats,
} from "@/lib/mock/study-generation"

type ResponseStatisticsProps = {
  stats: ResponseStats
  title?: string
}

const CARDS: {
  key: keyof ResponseStats | "avgDuration"
  label: string
  format: (s: ResponseStats) => string
}[] = [
  {
    key: "total",
    label: "Total Responses",
    format: (s) => String(s.total),
  },
  {
    key: "inProgress",
    label: "In Progress",
    format: (s) => String(s.inProgress),
  },
  {
    key: "completed",
    label: "Completed",
    format: (s) => String(s.completed),
  },
  {
    key: "abandoned",
    label: "Abandoned",
    format: (s) => String(s.abandoned),
  },
  {
    key: "completionRate",
    label: "Completion Rate",
    format: (s) => `${s.completionRate.toFixed(1)}%`,
  },
  {
    key: "avgDuration",
    label: "Avg Duration",
    format: (s) => formatAvgDuration(s.avgDurationSeconds),
  },
]

export function ResponseStatistics({
  stats,
  title = "Response Statistics",
}: ResponseStatisticsProps) {
  return (
    <div className="w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-blue-600">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 px-2 py-3 text-center"
          >
            <p className="text-lg font-bold tabular-nums text-blue-600 sm:text-xl">
              {card.format(stats)}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-gray-600 sm:text-xs">
              {card.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
