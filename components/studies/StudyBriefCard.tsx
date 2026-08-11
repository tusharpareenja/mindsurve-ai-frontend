"use client"

import { useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BriefPhase, StudyBrief } from "@/types/study-brief"

type StudyBriefCardProps = {
  brief: StudyBrief
  phase: BriefPhase
  confirming?: boolean
  onContinue: () => void
  onSaveEdit: (patch: Partial<StudyBrief>) => Promise<void>
}

export function StudyBriefCard({
  brief,
  phase,
  confirming = false,
  onContinue,
  onSaveEdit,
}: StudyBriefCardProps) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(brief.title)
  const [background, setBackground] = useState(brief.background)
  const [mainQuestion, setMainQuestion] = useState(brief.main_question)
  const [orientation, setOrientation] = useState(brief.orientation_text)

  const created = phase === "created" || brief.status === "created"
  const canContinue = phase === "brief_ready" && !created
  const missingImages =
    brief.study_type === "grid" &&
    brief.categories.some((c) =>
      c.elements.some((e) => e.element_type === "image" && !e.content?.trim())
    )
  const elementCount = brief.categories.reduce((n, c) => n + c.elements.length, 0)

  const startEdit = () => {
    setTitle(brief.title)
    setBackground(brief.background)
    setMainQuestion(brief.main_question)
    setOrientation(brief.orientation_text)
    setEditing(true)
    setExpanded(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSaveEdit({
        title: title.trim(),
        background: background.trim(),
        main_question: mainQuestion.trim(),
        orientation_text: orientation.trim(),
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-blue-100/80 bg-white/95 shadow-sm">
      <div className="flex items-start justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-blue-600">
            Study brief
          </p>
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {brief.title || "Untitled study"}
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {brief.study_type === "grid"
              ? "Grid"
              : brief.study_type === "text"
                ? "Text"
                : "Pending"}{" "}
            · {brief.categories.length} cats · {elementCount} elements
            {brief.classification_questions.length > 0
              ? ` · ${brief.classification_questions.length} Qs`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {created ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="size-3" />
              Created
            </span>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={expanded ? "Collapse brief" : "Expand brief"}
          >
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2.5 border-t border-gray-100 px-3.5 py-3 text-sm text-gray-700">
          {editing ? (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="brief-title">Title</Label>
                <Input
                  id="brief-title"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="brief-bg">Background</Label>
                <textarea
                  id="brief-bg"
                  value={background}
                  maxLength={2000}
                  onChange={(e) => setBackground(e.target.value)}
                  rows={3}
                  className="w-full cursor-text rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="brief-mq">Main question</Label>
                <Input
                  id="brief-mq"
                  value={mainQuestion}
                  onChange={(e) => setMainQuestion(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="brief-or">Orientation</Label>
                <textarea
                  id="brief-or"
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                  rows={2}
                  className="w-full cursor-text rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || title.trim().length < 3}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 text-xs text-gray-500 hover:bg-gray-100"
                >
                  <X className="size-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="line-clamp-3 text-xs leading-5 text-gray-600">
                {brief.background || "No description yet."}
              </p>
              <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                <p className="text-[11px] font-medium text-gray-500">Main question</p>
                <p className="mt-0.5 text-xs">{brief.main_question || "—"}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-gray-500">
                  Categories & elements
                </p>
                {brief.categories.map((cat) => (
                  <div
                    key={cat.name}
                    className="rounded-lg border border-gray-100 px-2.5 py-2"
                  >
                    <p className="text-xs font-semibold text-gray-800">{cat.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {cat.elements.map((el) => (
                        <div
                          key={`${cat.name}-${el.name}-${el.content}`}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-gray-50 px-1.5 py-1"
                        >
                          {el.element_type === "image" && el.content ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={el.content}
                              alt={el.name}
                              className="size-7 shrink-0 rounded object-cover"
                            />
                          ) : null}
                          <span className="truncate text-[11px] text-gray-700">
                            {el.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-gray-500">
                  Classification questions
                </p>
                {brief.classification_questions.length > 0 ? (
                  <ul className="space-y-1 text-[11px] text-gray-600">
                    {brief.classification_questions.map((q) => (
                      <li
                        key={q.question_text}
                        className="rounded-md bg-gray-50 px-2 py-1.5"
                      >
                        <span className="font-medium text-gray-800">
                          {q.question_text}
                        </span>
                        <span className="mt-0.5 block text-gray-500">
                          {q.options.join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-gray-400">None yet</p>
                )}
              </div>
              {missingImages && (
                <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                  Some elements still need images. Upload a folder
                  (Category/images) or attach files, then send.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {canContinue && !editing && (
        <div className="border-t border-gray-100 px-3.5 py-2.5">
          <Button
            type="button"
            onClick={onContinue}
            disabled={confirming || missingImages}
            className="h-9 w-full cursor-pointer bg-blue-600 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating study…
              </>
            ) : (
              "Continue with study"
            )}
          </Button>
        </div>
      )}

      {created && brief.study_id && (
        <div className="border-t border-emerald-100 bg-emerald-50/50 px-3.5 py-2 text-[11px] text-emerald-800">
          Draft study created. Task generation comes next.
        </div>
      )}
    </div>
  )
}
