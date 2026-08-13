"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AGE_SEGMENTS,
  MAX_STATEMENT_CHARS,
  MAX_TEXT_CATEGORIES,
  MAX_TEXT_STATEMENTS,
  MIN_TEXT_CATEGORIES,
  MIN_TEXT_STATEMENTS,
  type BriefPhase,
  type StudyBrief,
} from "@/types/study-brief"

type StudyBriefCardProps = {
  brief: StudyBrief
  phase: BriefPhase
  confirming?: boolean
  /** Allow edits after draft creation (e.g. before launch). */
  allowEdit?: boolean
  /** Friendly lock reason when edits are blocked (study live). */
  editLockedMessage?: string | null
  /** Bump to open the editor (e.g. from Ready card). */
  editRequestId?: number
  onContinue: () => void
  onSaveEdit: (patch: Partial<StudyBrief>) => Promise<void>
}

export function StudyBriefCard({
  brief,
  phase,
  confirming = false,
  allowEdit = false,
  editLockedMessage = null,
  editRequestId = 0,
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
  const [respondents, setRespondents] = useState<string>(
    brief.audience?.number_of_respondents
      ? String(brief.audience.number_of_respondents)
      : ""
  )
  const [ageSegments, setAgeSegments] = useState<string[]>(
    brief.audience?.age_segments ?? []
  )
  const [ageDistribution, setAgeDistribution] = useState<Record<string, number>>(
    brief.audience?.age_distribution ?? {}
  )
  const [countries, setCountries] = useState<string>(
    (brief.audience?.countries ?? []).join(", ")
  )
  const [genderMale, setGenderMale] = useState(
    String(brief.audience?.gender_male ?? 50)
  )
  const [genderFemale, setGenderFemale] = useState(
    String(brief.audience?.gender_female ?? 50)
  )
  const [classificationQuestions, setClassificationQuestions] = useState(
    brief.classification_questions.map((q) => ({
      ...q,
      options: [...q.options],
    }))
  )
  const [categories, setCategories] = useState(
    brief.categories.map((c) => ({
      name: c.name,
      elements: c.elements.map((e) => ({ ...e })),
    }))
  )

  const created = phase === "created" || brief.status === "created"
  const canContinue = phase === "brief_ready" && !created
  const canEdit = (!created || allowEdit) && !editLockedMessage
  const missingImages =
    brief.study_type === "grid" &&
    (editing ? categories : brief.categories).some((c) =>
      c.elements.some((e) => e.element_type === "image" && !e.content?.trim())
    )
  const isTextStudy = brief.study_type === "text"
  const textStructureValid =
    !isTextStudy ||
    (categories.length >= MIN_TEXT_CATEGORIES &&
      categories.length <= MAX_TEXT_CATEGORIES &&
      categories.every(
        (cat) =>
          cat.name.trim().length > 0 &&
          cat.elements.length >= MIN_TEXT_STATEMENTS &&
          cat.elements.length <= MAX_TEXT_STATEMENTS &&
          cat.elements.every((el) => {
            const statement = (el.content || el.name).trim()
            return (
              statement.length > 0 && statement.length <= MAX_STATEMENT_CHARS
            )
          })
      ))
  const missingStatements =
    isTextStudy &&
    (editing ? !textStructureValid : brief.categories.length < MIN_TEXT_CATEGORIES)
  const elementCount = brief.categories.reduce((n, c) => n + c.elements.length, 0)
  const respondentCount = brief.audience?.number_of_respondents ?? null
  const briefAgeSegments = brief.audience?.age_segments ?? []
  const briefCountries = brief.audience?.countries ?? []
  const ageTotal = ageSegments.reduce(
    (total, segment) => total + (ageDistribution[segment] ?? 0),
    0
  )
  const genderTotal =
    (Number.parseInt(genderMale, 10) || 0) +
    (Number.parseInt(genderFemale, 10) || 0)
  const audienceEditValid =
    ageTotal === 100 &&
    genderTotal === 100 &&
    Number.parseInt(respondents, 10) >= 1 &&
    Number.parseInt(respondents, 10) <= 1500 &&
    countries.trim().length > 0
  const screeningEditValid =
    classificationQuestions.length >= 1 &&
    classificationQuestions.every(
      (question) =>
        question.question_text.trim() &&
        question.options.filter((option) => option.trim()).length >= 2
    )

  const toggleAge = (seg: string) => {
    const nextSelected = ageSegments.includes(seg)
      ? ageSegments.filter((s) => s !== seg)
      : [...ageSegments, seg]
    setAgeSegments(nextSelected)
    if (!nextSelected.length) {
      setAgeDistribution({})
      return
    }
    const base = Math.floor(100 / nextSelected.length)
    const remainder = 100 - base * nextSelected.length
    setAgeDistribution(
      Object.fromEntries(
        nextSelected.map((item, index) => [
          item,
          base + (index < remainder ? 1 : 0),
        ])
      )
    )
  }

  const startEdit = () => {
    setTitle(brief.title)
    setBackground(brief.background)
    setMainQuestion(brief.main_question)
    setOrientation(brief.orientation_text)
    setRespondents(
      brief.audience?.number_of_respondents
        ? String(brief.audience.number_of_respondents)
        : ""
    )
    setAgeSegments(brief.audience?.age_segments ?? [])
    setAgeDistribution(brief.audience?.age_distribution ?? {})
    setCountries((brief.audience?.countries ?? []).join(", "))
    setGenderMale(String(brief.audience?.gender_male ?? 50))
    setGenderFemale(String(brief.audience?.gender_female ?? 50))
    setClassificationQuestions(
      brief.classification_questions.map((q) => ({
        ...q,
        options: [...q.options],
      }))
    )
    setCategories(
      brief.categories.map((c) => ({
        name: c.name,
        elements: c.elements.map((e) => ({ ...e })),
      }))
    )
    setEditing(true)
    setExpanded(true)
  }

  // External "Edit study" from ready card.
  useEffect(() => {
    if (editRequestId > 0 && canEdit) {
      startEdit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to request id bumps
  }, [editRequestId])

  const save = async () => {
    setSaving(true)
    try {
      const parsedRespondents = Number.parseInt(respondents, 10)
      const parsedMale = Number.parseInt(genderMale, 10)
      const parsedFemale = Number.parseInt(genderFemale, 10)
      const parsedCountries = countries
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
      await onSaveEdit({
        title: title.trim(),
        background: background.trim(),
        main_question: mainQuestion.trim(),
        orientation_text: orientation.trim(),
        categories: categories.map((c) => ({
          name: c.name.trim(),
          elements: c.elements.map((e) => {
            const statement = (e.content || e.name).trim().slice(0, MAX_STATEMENT_CHARS)
            const isText = isTextStudy || e.element_type === "text"
            return {
              ...e,
              element_type: isText ? ("text" as const) : e.element_type,
              name: isText ? statement : e.name.trim(),
              content: isText ? statement : (e.content || "").trim(),
              description: (e.description || "").trim(),
            }
          }),
        })),
        classification_questions: classificationQuestions
          .map((q) => ({
            ...q,
            question_text: q.question_text.trim(),
            options: q.options.map((option) => option.trim()).filter(Boolean),
          }))
          .filter((q) => q.question_text && q.options.length >= 2),
        audience: {
          ...brief.audience,
          number_of_respondents:
            Number.isFinite(parsedRespondents) && parsedRespondents > 0
              ? parsedRespondents
              : null,
          age_segments: ageSegments,
          age_distribution: Object.fromEntries(
            ageSegments.map((segment) => [
              segment,
              Math.max(0, Math.min(100, ageDistribution[segment] ?? 0)),
            ])
          ),
          countries: parsedCountries,
          gender_male: Number.isFinite(parsedMale) ? parsedMale : 50,
          gender_female: Number.isFinite(parsedFemale) ? parsedFemale : 50,
        },
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-blue-100/80 bg-white/95 shadow-sm">
      <div className="flex items-start justify-between gap-2 px-3 py-3 sm:px-3.5">
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
            · {brief.categories.length} cats · {elementCount}{" "}
            {brief.study_type === "text" ? "statements" : "elements"}
            {brief.classification_questions.length > 0
              ? ` · ${brief.classification_questions.length} Qs`
              : ""}
            {respondentCount ? ` · ${respondentCount} people` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {created && !allowEdit ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="size-3" />
              Created
            </span>
          ) : canEdit ? (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          ) : editLockedMessage ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
              Locked
            </span>
          ) : null}
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
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    {isTextStudy
                      ? "Categories & statements"
                      : "Categories & elements"}
                  </Label>
                  {isTextStudy && categories.length < MAX_TEXT_CATEGORIES && (
                    <button
                      type="button"
                      onClick={() =>
                        setCategories((current) => [
                          ...current,
                          {
                            name: `Category ${current.length + 1}`,
                            elements: [
                              {
                                name: "",
                                element_type: "text" as const,
                                content: "",
                                description: "",
                              },
                              {
                                name: "",
                                element_type: "text" as const,
                                content: "",
                                description: "",
                              },
                              {
                                name: "",
                                element_type: "text" as const,
                                content: "",
                                description: "",
                              },
                            ],
                          },
                        ])
                      }
                      className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <Plus className="size-3" />
                      Add category
                    </button>
                  )}
                </div>
                {isTextStudy && (
                  <p className="text-[10px] text-gray-500">
                    Min {MIN_TEXT_CATEGORIES} categories, max{" "}
                    {MAX_TEXT_CATEGORIES}. Each needs {MIN_TEXT_STATEMENTS}–
                    {MAX_TEXT_STATEMENTS} statements, {MAX_STATEMENT_CHARS}{" "}
                    characters max.
                  </p>
                )}
                {categories.map((cat, catIdx) => (
                  <div
                    key={`cat-${catIdx}`}
                    className="space-y-2 rounded-lg border border-gray-200 p-2.5"
                  >
                    <div className="flex gap-1.5">
                      <Input
                        value={cat.name}
                        onChange={(e) => {
                          const name = e.target.value
                          setCategories((current) =>
                            current.map((item, i) =>
                              i === catIdx ? { ...item, name } : item
                            )
                          )
                        }}
                        placeholder="Category name"
                        className="h-8 text-xs font-semibold"
                      />
                      {isTextStudy && (
                        <button
                          type="button"
                          onClick={() =>
                            setCategories((current) =>
                              current.length <= MIN_TEXT_CATEGORIES
                                ? current
                                : current.filter((_, i) => i !== catIdx)
                            )
                          }
                          disabled={categories.length <= MIN_TEXT_CATEGORIES}
                          className="shrink-0 cursor-pointer rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          aria-label={`Remove category ${catIdx + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {cat.elements.map((el, elIdx) =>
                        isTextStudy ? (
                          <div
                            key={`el-${catIdx}-${elIdx}`}
                            className="space-y-1 rounded-md bg-gray-50 p-2"
                          >
                            <div className="flex items-start gap-1.5">
                              <Textarea
                                value={el.content || el.name}
                                maxLength={MAX_STATEMENT_CHARS}
                                rows={2}
                                placeholder={`Statement ${elIdx + 1}`}
                                onChange={(e) => {
                                  const content = e.target.value.slice(
                                    0,
                                    MAX_STATEMENT_CHARS
                                  )
                                  setCategories((current) =>
                                    current.map((item, i) =>
                                      i === catIdx
                                        ? {
                                            ...item,
                                            elements: item.elements.map(
                                              (elem, j) =>
                                                j === elIdx
                                                  ? {
                                                      ...elem,
                                                      content,
                                                      name: content,
                                                      element_type: "text",
                                                    }
                                                  : elem
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }}
                                className="min-h-12 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setCategories((current) =>
                                    current.map((item, i) =>
                                      i === catIdx
                                        ? {
                                            ...item,
                                            elements:
                                              item.elements.length <=
                                              MIN_TEXT_STATEMENTS
                                                ? item.elements
                                                : item.elements.filter(
                                                    (_, j) => j !== elIdx
                                                  ),
                                          }
                                        : item
                                    )
                                  )
                                }
                                disabled={
                                  cat.elements.length <= MIN_TEXT_STATEMENTS
                                }
                                className="mt-0.5 shrink-0 cursor-pointer rounded p-1 text-gray-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Remove statement"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <p
                              className={`text-right text-[10px] ${
                                (el.content || el.name).length >=
                                MAX_STATEMENT_CHARS
                                  ? "text-amber-700"
                                  : "text-gray-400"
                              }`}
                            >
                              {(el.content || el.name).length}/
                              {MAX_STATEMENT_CHARS}
                            </p>
                          </div>
                        ) : (
                          <div
                            key={`el-${catIdx}-${elIdx}`}
                            className="flex flex-col gap-1.5 rounded-md bg-gray-50 p-2 sm:flex-row sm:items-center"
                          >
                            {el.element_type === "image" && el.content ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={el.content}
                                alt={el.name}
                                className="size-10 shrink-0 rounded object-cover"
                              />
                            ) : null}
                            <div className="min-w-0 flex-1 space-y-1">
                              <Input
                                value={el.name}
                                onChange={(e) => {
                                  const name = e.target.value
                                  setCategories((current) =>
                                    current.map((item, i) =>
                                      i === catIdx
                                        ? {
                                            ...item,
                                            elements: item.elements.map(
                                              (elem, j) =>
                                                j === elIdx
                                                  ? { ...elem, name }
                                                  : elem
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }}
                                placeholder="Element name"
                                className="h-8 text-xs"
                              />
                              <Input
                                value={el.content}
                                onChange={(e) => {
                                  const content = e.target.value
                                  setCategories((current) =>
                                    current.map((item, i) =>
                                      i === catIdx
                                        ? {
                                            ...item,
                                            elements: item.elements.map(
                                              (elem, j) =>
                                                j === elIdx
                                                  ? { ...elem, content }
                                                  : elem
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }}
                                placeholder={
                                  el.element_type === "image"
                                    ? "Image URL"
                                    : "Text content"
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                    {isTextStudy &&
                      cat.elements.length < MAX_TEXT_STATEMENTS && (
                        <button
                          type="button"
                          onClick={() =>
                            setCategories((current) =>
                              current.map((item, i) =>
                                i === catIdx
                                  ? {
                                      ...item,
                                      elements: [
                                        ...item.elements,
                                        {
                                          name: "",
                                          element_type: "text" as const,
                                          content: "",
                                          description: "",
                                        },
                                      ],
                                    }
                                  : item
                              )
                            )
                          }
                          className="cursor-pointer text-[11px] font-medium text-blue-600 hover:text-blue-700"
                        >
                          + Add statement
                        </button>
                      )}
                  </div>
                ))}
                <p className="text-[10px] text-gray-500">
                  {isTextStudy
                    ? "Paste statements in chat or upload a PDF / Word file and the AI will use them. You can edit freely here."
                    : "To replace images, paste a new image URL (re-upload via chat if needed)."}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Screening questions</Label>
                  <button
                    type="button"
                    onClick={() =>
                      setClassificationQuestions((current) => [
                        ...current,
                        {
                          question_text: "",
                          is_required: true,
                          options: ["", ""],
                        },
                      ])
                    }
                    className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="size-3" />
                    Add question
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">
                  AI sizes screeners from sample size (min 5; e.g. 200 people → 8
                  Qs). Add or remove freely (keep ≥1). Each question needs 2+
                  options (2, 3, 4, 5…). AI capacity = product of option counts.
                </p>
                {classificationQuestions.map((question, qIndex) => (
                  <div
                    key={`classification-${qIndex}`}
                    className="space-y-1.5 rounded-lg border border-gray-200 p-2.5"
                  >
                    <div className="flex gap-1.5">
                      <Input
                        value={question.question_text}
                        placeholder={`Question ${qIndex + 1}`}
                        onChange={(e) =>
                          setClassificationQuestions((current) =>
                            current.map((item, index) =>
                              index === qIndex
                                ? { ...item, question_text: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setClassificationQuestions((current) =>
                            current.length <= 1
                              ? current
                              : current.filter((_, index) => index !== qIndex)
                          )
                        }
                        disabled={classificationQuestions.length <= 1}
                        className="shrink-0 cursor-pointer rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        aria-label={`Remove question ${qIndex + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={`classification-${qIndex}-option-${optionIndex}`}
                        className="flex items-center gap-1.5"
                      >
                        <span className="w-4 text-center text-[10px] text-gray-400">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <Input
                          value={option}
                          placeholder={`Option ${optionIndex + 1}`}
                          onChange={(e) =>
                            setClassificationQuestions((current) =>
                              current.map((item, index) =>
                                index === qIndex
                                  ? {
                                      ...item,
                                      options: item.options.map((value, oi) =>
                                        oi === optionIndex ? e.target.value : value
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          className="h-8"
                        />
                        {question.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setClassificationQuestions((current) =>
                                current.map((item, index) =>
                                  index === qIndex
                                    ? {
                                        ...item,
                                        options: item.options.filter(
                                          (_, oi) => oi !== optionIndex
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                            className="shrink-0 cursor-pointer rounded p-1 text-gray-400 hover:text-red-600"
                            aria-label="Remove option"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {question.options.length < 5 && (
                      <button
                        type="button"
                        onClick={() =>
                          setClassificationQuestions((current) =>
                            current.map((item, index) =>
                              index === qIndex
                                ? { ...item, options: [...item.options, ""] }
                                : item
                            )
                          )
                        }
                        className="cursor-pointer text-[11px] font-medium text-blue-600 hover:text-blue-700"
                      >
                        + Add option
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor="brief-respondents">Number of respondents</Label>
                <Input
                  id="brief-respondents"
                  type="number"
                  min={1}
                  max={1500}
                  inputMode="numeric"
                  placeholder="e.g. 100"
                  value={respondents}
                  onChange={(e) => setRespondents(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gender distribution</Label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-xs">
                    <span className="shrink-0 text-gray-600">Male</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      inputMode="numeric"
                      value={genderMale}
                      onChange={(e) => setGenderMale(e.target.value)}
                      className="h-8 min-w-0"
                    />
                    <span>%</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-xs">
                    <span className="shrink-0 text-gray-600">Female</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      inputMode="numeric"
                      value={genderFemale}
                      onChange={(e) => setGenderFemale(e.target.value)}
                      className="h-8 min-w-0"
                    />
                    <span>%</span>
                  </label>
                </div>
                <p
                  className={`text-[10px] ${
                    genderTotal === 100 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  Gender total: {genderTotal}%
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Age distribution</Label>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {AGE_SEGMENTS.map((seg) => {
                    const active = ageSegments.includes(seg)
                    return (
                      <div
                        key={seg}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 p-2"
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleAge(seg)}
                          className="size-4 cursor-pointer accent-blue-600"
                        />
                        <span className="min-w-12 text-xs text-gray-700">{seg}</span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          inputMode="numeric"
                          disabled={!active}
                          value={active ? ageDistribution[seg] ?? 0 : ""}
                          onChange={(e) =>
                            setAgeDistribution((current) => ({
                              ...current,
                              [seg]: Number.parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="ml-auto h-8 w-20"
                        />
                        <span className="text-xs">%</span>
                      </div>
                    )
                  })}
                </div>
                <p
                  className={`text-[10px] ${
                    ageTotal === 100 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  Age distribution total: {ageTotal}%
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="brief-countries">Country / countries</Label>
                <Input
                  id="brief-countries"
                  placeholder="e.g. United States, United Kingdom"
                  value={countries}
                  onChange={(e) => setCountries(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => void save()}
                  disabled={
                    saving ||
                    title.trim().length < 3 ||
                    !audienceEditValid ||
                    !screeningEditValid ||
                    !textStructureValid
                  }
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
                  {brief.study_type === "text"
                    ? "Categories & statements"
                    : "Categories & elements"}
                </p>
                {brief.categories.map((cat) => (
                  <div
                    key={cat.name}
                    className="rounded-lg border border-gray-100 px-2.5 py-2"
                  >
                    <p className="text-xs font-semibold text-gray-800">{cat.name}</p>
                    {brief.study_type === "text" ? (
                      <ul className="mt-1.5 space-y-1">
                        {cat.elements.map((el, idx) => (
                          <li
                            key={`${cat.name}-${idx}-${el.content || el.name}`}
                            className="rounded-md bg-gray-50 px-2 py-1.5 text-[11px] leading-4 text-gray-700"
                          >
                            {el.content || el.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
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
                    )}
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
              <div>
                <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
                  <Users className="size-3" />
                  Audience
                </p>
                {respondentCount ||
                briefAgeSegments.length > 0 ||
                briefCountries.length > 0 ? (
                  <div className="space-y-1.5 rounded-lg bg-gray-50 px-2.5 py-2 text-[11px] text-gray-700">
                    <p>
                      <span className="font-medium text-gray-800">
                        {respondentCount ?? "—"}
                      </span>{" "}
                      respondents
                      {briefCountries.length > 0 && (
                        <> · {briefCountries.join(", ")}</>
                      )}
                    </p>
                    <p className="text-gray-500">
                      Male {brief.audience?.gender_male ?? 50}% · Female{" "}
                      {brief.audience?.gender_female ?? 50}%
                    </p>
                    {briefAgeSegments.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {briefAgeSegments.map((seg) => (
                          <span
                            key={seg}
                            className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-gray-600 ring-1 ring-gray-200"
                          >
                            {seg}: {brief.audience?.age_distribution?.[seg] ?? 0}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700">
                    Tell me how many respondents, which age groups, and which country
                    to target.
                  </p>
                )}
              </div>
              {missingImages && (
                <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                  Some elements still need images. Upload a folder
                  (Category/images) or attach files, then send.
                </p>
              )}
              {missingStatements && (
                <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                  A text study needs at least {MIN_TEXT_CATEGORIES} categories
                  with {MIN_TEXT_STATEMENTS} statements each (max{" "}
                  {MAX_STATEMENT_CHARS} characters). Add them here, paste in
                  chat, or upload a PDF / Word file.
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
            disabled={confirming || missingImages || missingStatements}
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
          {editLockedMessage
            ? editLockedMessage
            : allowEdit
              ? "Draft study created. You can edit task-affecting fields before launch — regenerating may be required."
              : "Draft study created. Task generation is in progress."}
        </div>
      )}
    </div>
  )
}
