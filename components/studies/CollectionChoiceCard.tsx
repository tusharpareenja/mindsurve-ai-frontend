"use client"

import { Bot, Dices, Loader2, RefreshCw, Users, BarChart3 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ResponseStatistics } from "@/components/studies/ResponseStatistics"
import type { ResponseStats } from "@/types/synthetic-collection"
import type { SyntheticMode } from "@/types/synthetic-collection"

export type CollectionMode = "ai" | "cint"

type CollectionChoiceCardProps = {
  studyTitle?: string
  choice: CollectionMode | null
  /** Temporary: AI vs randomize engine choice after Collect with AI. */
  engineChoice: SyntheticMode | null
  selecting?: CollectionMode | null
  engineSelecting?: SyntheticMode | null
  onChoose: (mode: CollectionMode) => void
  onChooseEngine: (mode: SyntheticMode) => void
  stats?: ResponseStats | null
  progress?: number | null
  statusMessage?: string | null
  collecting?: boolean
  collectionFailed?: boolean
  onRetryCollection?: () => void
  retrying?: boolean
  /** When collection finished successfully — link to full analytics. */
  analyticsHref?: string | null
  showCompleteAnalysis?: boolean
}

export function CollectionChoiceCard({
  studyTitle,
  choice,
  engineChoice,
  selecting = null,
  engineSelecting = null,
  onChoose,
  onChooseEngine,
  stats = null,
  progress = null,
  statusMessage = null,
  collecting = false,
  collectionFailed = false,
  onRetryCollection,
  retrying = false,
  analyticsHref = null,
  showCompleteAnalysis = false,
}: CollectionChoiceCardProps) {
  if (choice === "cint") {
    return (
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="px-4 py-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Cint request sent
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            Your Cint request for{" "}
            <span className="font-medium text-gray-700">
              {studyTitle || "this study"}
            </span>{" "}
            has been sent to our team. We’ll run it and let you know when it’s
            completed.
          </p>
        </div>
      </div>
    )
  }

  if (choice === "ai" && !engineChoice) {
    return (
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="px-4 py-4">
          <h3 className="text-sm font-semibold text-gray-900">
            How should AI respondents rate?
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            Temporary choice — we’ll simplify this later. Pick AI ratings or
            randomized ratings for the synthetic respondent job.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => onChooseEngine("ai")}
              disabled={engineSelecting !== null}
              className="cursor-pointer flex-1 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed"
            >
              {engineSelecting === "ai" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bot className="size-4" />
              )}
              Use AI ratings
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onChooseEngine("randomize")}
              disabled={engineSelecting !== null}
              className="cursor-pointer flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed"
            >
              {engineSelecting === "randomize" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Dices className="size-4" />
              )}
              Randomize
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (choice === "ai" && engineChoice) {
    return (
      <div className="w-full max-w-3xl space-y-3">
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {collecting
                ? "Collecting synthetic responses…"
                : collectionFailed
                  ? "Synthetic collection needs attention"
                  : "Synthetic collection complete"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {statusMessage ||
                (engineChoice === "randomize"
                  ? "Randomized respondents are filling your study."
                  : "AI respondents are filling your study.")}
            </p>
            {collectionFailed && onRetryCollection && (
              <Button
                type="button"
                onClick={onRetryCollection}
                disabled={retrying}
                className="mt-2 h-9 cursor-pointer bg-blue-600 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed"
              >
                {retrying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Retry collection
              </Button>
            )}
          </div>
        </div>
        {stats && (
          <ResponseStatistics
            stats={stats}
            subtitle={
              collecting
                ? "Live progress from the study engine"
                : "Latest response totals for this study"
            }
            progress={collecting ? progress : null}
          />
        )}
        {showCompleteAnalysis && analyticsHref && !collecting && !collectionFailed && (
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">
                  Analysis is ready
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                  Open the full analytics dashboard for this study.
                </p>
              </div>
              <Link
                href={analyticsHref}
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <BarChart3 className="size-4" />
                See complete analysis
              </Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="px-4 py-4">
        <h3 className="text-sm font-semibold text-gray-900">
          How should we collect responses?
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
          Your study is live and can no longer be changed in this chat. Choose
          how you want to complete collection.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => onChoose("ai")}
            disabled={selecting !== null}
            className="cursor-pointer flex-1 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed"
          >
            {selecting === "ai" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bot className="size-4" />
            )}
            Collect with AI
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChoose("cint")}
            disabled={selecting !== null}
            className="cursor-pointer flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed"
          >
            {selecting === "cint" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Users className="size-4" />
            )}
            Complete with Cint
          </Button>
        </div>
      </div>
    </div>
  )
}
