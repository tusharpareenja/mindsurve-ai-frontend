"use client"

import { useState } from "react"
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Rocket,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { GenerationRun } from "@/types/task-generation"

type StudyReadyCardProps = {
  run: GenerationRun
  studyTitle?: string
  launching?: boolean
  onPreview: () => void
  onEdit?: () => void
  onLaunch: () => Promise<void> | void
  editDisabled?: boolean
}

export function StudyReadyCard({
  run,
  studyTitle,
  launching = false,
  onPreview,
  onEdit,
  onLaunch,
  editDisabled = false,
}: StudyReadyCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const launched =
    run.status === "launched" || run.study_status === "active"
  const shareUrl = run.share_url

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="px-4 py-4">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">
                {launched ? "Your study is live" : "Tasks generated"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {launched ? (
                  <>
                    <span className="font-medium text-gray-700">
                      {studyTitle || "Your study"}
                    </span>{" "}
                    is collecting responses. Share the participant link below.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-gray-700">
                      {studyTitle || "Your study"}
                    </span>{" "}
                    tasks are ready. Preview as a respondent, edit if needed, then
                    launch.
                  </>
                )}
              </p>
            </div>
          </div>

          {!launched && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={onPreview}
                className="cursor-pointer flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
              >
                <ExternalLink className="size-4" />
                Preview study
              </Button>
              {onEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onEdit}
                  disabled={editDisabled}
                  className="cursor-pointer flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <Pencil className="size-4" />
                  Edit study
                </Button>
              )}
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={launching}
                className="cursor-pointer flex-1 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed"
              >
                {launching ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Launching…
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Launch study
                  </>
                )}
              </Button>
            </div>
          )}

          {launched && shareUrl && (
            <div className="mt-1 space-y-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
                <p className="text-[11px] font-medium text-emerald-800">
                  Participant link
                </p>
                <p className="mt-1 break-all text-xs text-emerald-900">{shareUrl}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCopy()}
                  className="cursor-pointer flex-1 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                >
                  <Copy className="size-4" />
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <Button
                  type="button"
                  onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
                  className="cursor-pointer flex-1 bg-blue-600 text-white hover:bg-blue-700"
                >
                  <ExternalLink className="size-4" />
                  Open link
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Launch this study?</DialogTitle>
            <DialogDescription>
              Once live, respondents can start completing tasks. Task-affecting
              edits will be locked in this chat flow.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={launching}
              onClick={() => {
                void (async () => {
                  await onLaunch()
                  setConfirmOpen(false)
                })()
              }}
              className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed"
            >
              {launching ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Launching…
                </>
              ) : (
                "Yes, launch"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
