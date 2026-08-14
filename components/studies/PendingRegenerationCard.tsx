"use client"

import { AlertTriangle, Check, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PendingStimulusChange = {
  type: "edited" | "added" | "removed"
  category: string
  before: string
  after: string
}

export type PendingPreview = {
  summary?: string
  items?: PendingStimulusChange[]
  total?: number
}

type PendingRegenerationCardProps = {
  changedFields: string[]
  preview?: PendingPreview
  onApply: () => void
  onDismiss: () => void
  disabled?: boolean
  applied?: boolean
}

const FIELD_LABELS: Record<string, string> = {
  categories: "Statements / elements",
  study_type: "Study type",
}

const TYPE_LABELS: Record<PendingStimulusChange["type"], string> = {
  edited: "Rewritten",
  added: "Added",
  removed: "Removed",
}

const TYPE_STYLES: Record<PendingStimulusChange["type"], string> = {
  edited: "bg-blue-100 text-blue-700",
  added: "bg-emerald-100 text-emerald-700",
  removed: "bg-rose-100 text-rose-700",
}

export function PendingRegenerationCard({
  changedFields,
  preview,
  onApply,
  onDismiss,
  disabled = false,
  applied = false,
}: PendingRegenerationCardProps) {
  const items = preview?.items ?? []
  const hidden = Math.max(0, (preview?.total ?? items.length) - items.length)

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border px-4 py-3",
        applied
          ? "border-gray-200 bg-gray-50/80"
          : "border-amber-200 bg-amber-50/70"
      )}
    >
      <div className="flex items-center gap-2">
        {applied ? (
          <Check className="size-4 shrink-0 text-emerald-500" />
        ) : (
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
        )}
        <p
          className={cn(
            "text-sm font-semibold",
            applied ? "text-gray-500" : "text-amber-950"
          )}
        >
          {applied ? "Applied — tasks regenerating" : "Ready to apply — needs new tasks"}
        </p>
      </div>
      <p
        className={cn(
          "mt-1 text-xs leading-relaxed",
          applied ? "text-gray-400" : "text-amber-900"
        )}
      >
        {applied
          ? preview?.summary
            ? `Applied: ${preview.summary}. Tasks are being rebuilt from this version.`
            : "These changes were applied and the task matrix is being rebuilt."
          : preview?.summary
            ? `Prepared: ${preview.summary}. Nothing is saved until you apply.`
            : "Your edit is ready but not saved yet. Applying it replaces the tasks generated from the current version."}
      </p>

      {items.length > 0 ? (
        <ul className={cn("mt-2.5 space-y-2", applied && "opacity-60 grayscale")}>
          {items.map((item, index) => (
            <li
              key={`${item.category}-${index}`}
              className="rounded-xl border border-amber-100 bg-white px-3 py-2"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_STYLES[item.type]}`}
                >
                  {TYPE_LABELS[item.type]}
                </span>
                <span className="truncate text-[11px] text-gray-500">
                  {item.category}
                </span>
              </div>
              {item.before && (
                <p className="mt-1.5 text-xs leading-relaxed text-gray-400 line-through">
                  {item.before}
                </p>
              )}
              {item.after && (
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-gray-900">
                  {item.after}
                </p>
              )}
            </li>
          ))}
          {hidden > 0 && (
            <li
              className={cn(
                "text-[11px]",
                applied ? "text-gray-400" : "text-amber-900"
              )}
            >
              + {hidden} more change{hidden === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      ) : (
        changedFields.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {changedFields.map((field) => (
              <li
                key={field}
                className={cn(
                  "list-inside list-disc text-xs",
                  applied ? "text-gray-400" : "text-amber-900"
                )}
              >
                {FIELD_LABELS[field] || field}
              </li>
            ))}
          </ul>
        )
      )}

      {!applied && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            onClick={onApply}
            disabled={disabled}
            className="h-9 flex-1 cursor-pointer bg-blue-600 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed"
          >
            <RefreshCw className="size-4" />
            Apply & regenerate
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            disabled={disabled}
            className="h-9 cursor-pointer border-amber-200 bg-white text-sm text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed"
          >
            <X className="size-4" />
            Discard
          </Button>
        </div>
      )}
    </div>
  )
}
