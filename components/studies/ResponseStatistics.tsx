"use client"

import { formatAvgDuration, type ResponseStats } from "@/types/synthetic-collection"

type ResponseStatisticsProps = {
  stats: ResponseStats
  title?: string
  subtitle?: string | null
  progress?: number | null
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
  subtitle = null,
  progress = null,
}: ResponseStatisticsProps) {
  const pct =
    progress == null ? null : Math.round(Math.min(100, Math.max(0, progress)))

  return (
    <div className="w-full max-w-3xl rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-blue-600">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {pct != null && (
          <span className="text-xs font-semibold tabular-nums text-blue-600">
            {pct}%
          </span>
        )}
      </div>
      {pct != null && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-blue-50">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className="flex flex-col items-center justify-center rounded-lg border border-blue-200/80 px-2 py-3 text-center"
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
