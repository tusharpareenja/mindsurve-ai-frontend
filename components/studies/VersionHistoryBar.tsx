"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronLeft, ChevronRight, History } from "lucide-react"
import { cn } from "@/lib/utils"

type VersionListItem = {
  version: number
  summary: string
  source?: string
  created_at?: string
}

type VersionHistoryBarProps = {
  current: number
  total: number
  viewing: number
  summary?: string
  versions?: VersionListItem[]
  disabled?: boolean
  onView: (version: number) => void
  onRestore?: () => void
  restoring?: boolean
  className?: string
}

export function VersionHistoryBar({
  current,
  total,
  viewing,
  summary,
  versions = [],
  disabled,
  onView,
  onRestore,
  restoring,
  className,
}: VersionHistoryBarProps) {
  const [historyOpen, setHistoryOpen] = useState(false)

  if (total < 1) return null
  const isHistorical = viewing !== current

  return (
    <div
      className={cn(
        "text-[11px] text-gray-500",
        className
      )}
      onMouseEnter={() => !disabled && setHistoryOpen(true)}
      onMouseLeave={() => setHistoryOpen(false)}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setHistoryOpen((open) => !open)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md py-0.5 pr-1 font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-expanded={historyOpen}
          aria-label="Show version history"
        >
          <History className="size-3.5 shrink-0 text-gray-400" />
          <span>Version {viewing} of {total}</span>
          <ChevronDown
            className={cn(
              "size-3 text-gray-400 transition-transform",
              historyOpen && "rotate-180"
            )}
          />
        </button>

        <div className="ml-0.5 flex items-center">
          <button
            type="button"
            disabled={disabled || viewing <= 1}
            onClick={() => onView(viewing - 1)}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous version"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled || viewing >= total}
            onClick={() => onView(viewing + 1)}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next version"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        {isHistorical && (
          <>
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              Viewing
            </span>
            {onRestore && (
              <button
                type="button"
                disabled={disabled || restoring}
                onClick={onRestore}
                className="cursor-pointer rounded-md px-1.5 py-0.5 font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {restoring ? "Restoring…" : "Restore"}
              </button>
            )}
          </>
        )}
        {summary && !isHistorical && (
          <span className="truncate text-gray-400">{summary}</span>
        )}
      </div>

      {historyOpen && versions.length > 0 && (
        <div className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {[...versions].reverse().map((item) => {
            const selected = item.version === viewing
            return (
              <button
                key={item.version}
                type="button"
                onClick={() => {
                  onView(item.version)
                  setHistoryOpen(false)
                }}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-50",
                  selected && "bg-blue-50 hover:bg-blue-50"
                )}
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {selected ? (
                    <Check className="size-3.5 text-blue-600" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-gray-300" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn(
                    "block font-medium",
                    selected ? "text-blue-700" : "text-gray-700"
                  )}>
                    Version {item.version}
                    {item.version === current ? " · Current" : ""}
                  </span>
                  <span className="block truncate text-[10px] text-gray-400">
                    {item.summary || "Study brief updated"}
                  </span>
                </span>
                {item.created_at && (
                  <span className="shrink-0 pt-0.5 text-[10px] text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
