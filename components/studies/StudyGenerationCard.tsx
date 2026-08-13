"use client"

import { useState } from "react"
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
  const [expanded, setExpanded] = useState(true)
  const pct = Math.round(Math.min(100, Math.max(0, run.progress)))
  const failed = run.status === "failed" || run.status === "cancelled"
  const active = steps.find((s) => s.status === "active")

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-blue-50 bg-gradient-to-r from-blue-50/80 to-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-blue-500 text-white">
              {failed ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
            </span>
            <h3 className="text-sm font-semibold text-gray-900">
              {failed ? "Task generation needs attention" : "Generating study tasks"}
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {run.message ||
              (failed
                ? "Something went wrong while building your tasks."
                : "MindSurve is preparing your research matrix…")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-blue-50"
          aria-label={expanded ? "Collapse progress" : "Expand progress"}
        >
          {expanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">
            {failed ? "Stopped" : active?.label || "Working…"}
          </span>
          <span className="text-xs font-semibold tabular-nums text-blue-600">
            {pct}%
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-blue-50"
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

        {expanded && (
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
        )}

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
      </div>

      {!failed && (
        <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-2.5">
          <Clock className="size-3.5 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-500">
            You can leave this page — we’ll keep working and resume when you return.
          </p>
        </div>
      )}
    </div>
  )
}
