"use client"

import type { ReactNode } from "react"
import { ExternalLink, FileText, Play, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type StudyArtifactTab = "details" | "preview"

type StudyArtifactPanelProps = {
  activeTab: StudyArtifactTab
  onTabChange: (tab: StudyArtifactTab) => void
  onClose: () => void
  previewUrl?: string | null
  details: ReactNode
}

export function StudyArtifactPanel({
  activeTab,
  onTabChange,
  onClose,
  previewUrl,
  details,
}: StudyArtifactPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-gray-200 px-3">
        <button
          type="button"
          onClick={() => onTabChange("details")}
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
            activeTab === "details"
              ? "bg-blue-50 text-blue-700"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          )}
          aria-pressed={activeTab === "details"}
        >
          <FileText className="size-4" />
          Study details
        </button>
        <button
          type="button"
          onClick={() => onTabChange("preview")}
          disabled={!previewUrl}
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            activeTab === "preview"
              ? "bg-blue-50 text-blue-700"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          )}
          aria-pressed={activeTab === "preview"}
          title={previewUrl ? "Preview as one respondent" : "Preview will appear when tasks are ready"}
        >
          <Play className="size-4" />
          Preview
        </button>
        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex size-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 md:w-auto md:px-2.5"
            title="Open preview in a new tab"
            aria-label="Open preview in full screen"
          >
            <ExternalLink className="size-4" />
            <span className="hidden text-sm font-medium md:inline">Open full screen</span>
          </a>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700",
            !previewUrl && "ml-auto"
          )}
          aria-label="Close study panel"
        >
          <X className="size-5" />
        </button>
      </div>

      {activeTab === "details" ? (
        <div className="flex min-h-0 flex-1 flex-col">{details}</div>
      ) : previewUrl ? (
        <div className="relative min-h-0 flex-1 bg-gray-50">
          <iframe
            key={previewUrl}
            src={previewUrl}
            title="Study preview — one respondent"
            className="absolute inset-0 size-full border-0 bg-white"
            allow="clipboard-read; clipboard-write"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <div>
            <Play className="mx-auto size-8 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-700">
              Preview is being prepared
            </p>
            <p className="mt-1 text-xs text-gray-500">
              It will appear here as soon as the one-respondent task set is ready.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
