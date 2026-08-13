"use client"

import { useEffect, useMemo, useState } from "react"
import { Bot, Check, Loader2 } from "lucide-react"
import type { BriefPhase, MindGenomicStudyType } from "@/types/study-brief"

/** How long each status line stays active before advancing. */
const STEP_MS = 2200
/** How many completed lines stay visible above the current one. */
const TRAIL = 2

const THINKING = "MindSurve is thinking…"

const TEXT_STUDY_STEPS = [
  THINKING,
  "Your statements are getting ready…",
  "Shaping your statement categories…",
  "Matching statements to your idea…",
  "Generating orientation text…",
  "Writing respondent-facing copy…",
  "Drafting your rating scale…",
  "Setting up screening questions…",
  "Checking statement length and variety…",
  "Mapping your audience…",
  "Balancing category coverage…",
  "Polishing stimulus wording…",
  "Preparing your text study…",
]

const GRID_STUDY_STEPS = [
  THINKING,
  "Organizing your images…",
  "Grouping images into categories…",
  "Naming visual elements…",
  "Generating orientation text…",
  "Drafting your rating scale…",
  "Setting up screening questions…",
  "Mapping your audience…",
  "Checking image-to-category fit…",
  "Preparing your visual study…",
]

const BUILD_STEPS = [
  THINKING,
  "Reading your project information…",
  "Figuring out the best study format…",
  "Putting your study together…",
  "Your statements are getting ready…",
  "Generating orientation text…",
  "Drafting your rating scale…",
  "Setting up screening questions…",
  "Mapping your audience…",
  "Preparing your study draft…",
]

function stepsFor(
  phase: BriefPhase,
  studyType: MindGenomicStudyType | null
): string[] {
  if (phase === "created") return [THINKING]
  if (studyType === "text") return TEXT_STUDY_STEPS
  if (studyType === "grid") return GRID_STUDY_STEPS
  return BUILD_STEPS
}

type ThinkingStatusProps = {
  phase: BriefPhase
  studyType: MindGenomicStudyType | null
}

export function ThinkingStatus({ phase, studyType }: ThinkingStatusProps) {
  const steps = useMemo(() => stepsFor(phase, studyType), [phase, studyType])
  const [index, setIndex] = useState(0)

  // Restart only when the step *pool* identity changes (text vs grid vs build),
  // not on every brief field flicker — so the stream keeps advancing.
  const poolKey = `${phase === "created" ? "done" : "build"}:${studyType ?? "unknown"}`

  useEffect(() => {
    setIndex(0)
  }, [poolKey])

  useEffect(() => {
    if (steps.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => {
        // Walk forward; hold on the last line instead of looping the same few.
        if (i >= steps.length - 1) return i
        return i + 1
      })
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [poolKey, steps.length])

  const safeIndex = Math.min(index, steps.length - 1)
  const trailStart = Math.max(0, safeIndex - TRAIL)
  const visible = steps.slice(trailStart, safeIndex + 1)

  return (
    <div className="flex items-start gap-3 text-sm text-gray-500">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500">
        <Bot className="size-4 text-white" />
      </div>
      <div className="min-w-0 max-w-[min(100%,28rem)] flex-1 space-y-1.5 rounded-2xl bg-gray-100 px-4 py-3">
        {visible.map((label, i) => {
          const absolute = trailStart + i
          const isCurrent = absolute === safeIndex
          return (
            <div
              key={`${absolute}-${label}`}
              className={[
                "flex items-start gap-2 transition-all duration-500",
                isCurrent
                  ? "animate-in fade-in slide-in-from-bottom-1 text-gray-700"
                  : "text-gray-400",
              ].join(" ")}
            >
              {isCurrent ? (
                <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-blue-500" />
              ) : (
                <Check className="mt-0.5 size-3.5 shrink-0 text-blue-400" />
              )}
              <span className={isCurrent ? "font-medium text-gray-700" : undefined}>
                {label}
              </span>
            </div>
          )
        })}
        {steps.length > 1 && (
          <div
            className="pt-1"
            aria-hidden
          >
            <div className="h-1 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-400 transition-[width] duration-500 ease-out"
                style={{
                  width: `${((safeIndex + 1) / steps.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
