"use client"

import { useState } from "react"
import {
  BarChart3,
  Check,
  Clock,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react"
import {
  PHASE_STATUS_COPY,
  type StudyGenerationJob,
  type StudyGenStep,
  type StudyGenStepId,
} from "@/lib/mock/study-generation"
import { cn } from "@/lib/utils"

type StudyGenerationCardProps = {
  job: StudyGenerationJob
}

function StepIcon({
  step,
  id,
}: {
  step: StudyGenStep
  id: StudyGenStepId
}) {
  if (step.status === "completed") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check className="size-3.5" />
      </span>
    )
  }
  if (step.status === "active") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Loader2 className="size-3.5 animate-spin" />
      </span>
    )
  }

  const muted = "flex size-6 items-center justify-center rounded-full bg-gray-50 text-gray-400"
  if (id === "study_review") return <span className={muted}><BarChart3 className="size-3.5" /></span>
  if (id === "study_being_prepared") return <span className={muted}><FileText className="size-3.5" /></span>
  if (id === "study_ready") return <span className={muted}><Clock className="size-3.5" /></span>
  return <span className={muted}><Sparkles className="size-3.5" /></span>
}

export function StudyGenerationCard({ job }: StudyGenerationCardProps) {
  const active = job.steps.find((s) => s.status === "active")
  const [expanded, setExpanded] = useState(false)
  const statusCopy = active
    ? PHASE_STATUS_COPY[active.id]
    : "Will notify when study is ready"

  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{job.title}</h3>
      </div>

      <ol className="relative space-y-0 px-4 py-3">
        {job.steps.map((step, index) => {
          const isLast = index === job.steps.length - 1
          const isActive = step.status === "active"
          const isPending = step.status === "pending"

          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <span
                  className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-gray-200"
                  aria-hidden
                />
              )}
              <div className="relative z-10 shrink-0">
                <StepIcon step={step} id={step.id} />
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
                {isActive && step.description && (
                  <div className="mt-1">
                    <p
                      className={cn(
                        "text-xs leading-relaxed text-gray-500",
                        !expanded && "line-clamp-2"
                      )}
                    >
                      {step.description}
                    </p>
                    {step.description.length > 90 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="cursor-pointer mt-1 text-xs font-medium text-blue-600 hover:text-blue-500"
                      >
                        {expanded ? "Less" : "More"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-2.5">
        <Clock className="size-3.5 shrink-0 text-gray-400" />
        <p className="text-xs text-gray-500">
          {job.phase === "generating"
            ? statusCopy
            : "Will notify when study is ready"}
          {job.phase === "generating" && (
            <span className="text-gray-400"> · Will notify when study is ready</span>
          )}
        </p>
      </div>
    </div>
  )
}
