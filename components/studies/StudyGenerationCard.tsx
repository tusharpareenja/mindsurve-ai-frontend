"use client"

import { useEffect, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  GenerationRun,
  GenerationStep,
} from "@/types/task-generation"

type StudyGenerationCardProps = {
  run: GenerationRun
  steps: GenerationStep[]
  onRetry?: () => void
  retrying?: boolean
}

export function StudyGenerationCard({
  run,
  steps,
  onRetry,
  retrying = false,
}: StudyGenerationCardProps) {
  const failed = run.status === "failed" || run.status === "cancelled"
  const [expanded, setExpanded] = useState(failed)
  const pct = Math.round(Math.min(100, Math.max(0, run.progress)))
  const active = steps.find((s) => s.status === "active")

  useEffect(() => {
    if (failed) setExpanded(true)
  }, [failed])

  const statusLabel = run.message || active?.label || "Working…"

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-gray-50/80"
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            failed ? "bg-amber-500" : "animate-pulse bg-blue-500"
          )}
          aria-hidden
        />
        {failed ? (
          <RefreshCw className="size-3.5 shrink-0 text-amber-500" />
        ) : (
          <Sparkles className="size-3.5 shrink-0 text-blue-500" />
        )}
        <span className="shrink-0 text-[13px] font-medium text-gray-900">
          {failed ? "Task generation stopped" : "Generating study tasks"}
        </span>
        <span className="min-w-0 truncate text-xs text-gray-400">
          · {failed ? run.error || "Needs a retry" : statusLabel}
        </span>
        <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-blue-600">
          {pct}%
        </span>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-600">
              {failed ? "Stopped" : active?.label || "Working…"}
            </span>
            <span className="text-xs font-semibold tabular-nums text-blue-600">
              {pct}%
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500 ease-out",
                failed ? "bg-amber-500" : "bg-blue-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          {run.research_tip && !failed && (
            <p className="mt-2.5 text-[11px] leading-relaxed text-gray-500">
              {run.research_tip}
            </p>
          )}

          <ol className="relative mt-3 space-y-0">
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1
              const isPending = step.status === "pending"
              const isActive = step.status === "active"
              return (
                <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {!isLast && (
                    <span
                      className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-gray-200"
                      aria-hidden
                    />
                  )}
                  <div className="relative z-10 shrink-0">
                    {step.status === "completed" ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <Check className="size-3.5" />
                      </span>
                    ) : isActive ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <Loader2 className="size-3.5 animate-spin" />
                      </span>
                    ) : (
                      <span className="flex size-6 items-center justify-center rounded-full bg-gray-50 text-gray-400">
                        <Clock className="size-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isPending && "text-gray-400",
                        isActive && "text-gray-900",
                        step.status === "completed" && "text-gray-700"
                      )}
                    >
                      {step.label}
                    </p>
                    {(isActive || (failed && isActive)) && (
                      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                        {step.description}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          {failed && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
              <p className="text-xs text-amber-900">
                {run.error ||
                  "We couldn’t finish generating tasks. Your draft study is safe — you can retry."}
              </p>
              {run.retryable && onRetry && (
                <Button
                  type="button"
                  onClick={onRetry}
                  disabled={retrying}
                  className="mt-2 h-9 w-full cursor-pointer bg-blue-600 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed"
                >
                  {retrying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Retrying…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4" />
                      Retry generation
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {!failed && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
              <Clock className="size-3 shrink-0" />
              Running in the background — keep chatting or leave this page.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
