"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react"
import { Crown, Expand, GitCompareArrows, LayoutTemplate, X } from "lucide-react"
import { DesignPreviewComposite } from "./DesignPreviewComposite"
import type { DesignRankItem } from "@/lib/types/analyticsAssistant"

function ScoreBar({
  left,
  right,
  leftColor,
  rightColor,
}: {
  left: number
  right: number
  leftColor: string
  rightColor: string
}) {
  const total = Math.abs(left) + Math.abs(right)
  const leftPct = total > 0 ? (Math.abs(left) / total) * 100 : 50
  const rightPct = 100 - leftPct
  return (
    <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-100">
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${leftPct}%`, backgroundColor: leftColor }}
      />
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${rightPct}%`, backgroundColor: rightColor }}
      />
    </div>
  )
}

function CompareSidePanel({
  side,
  accent,
  accentSoft,
  studyType,
  backgroundUrl,
  aspectRatio,
  isLeader,
  onPreview,
  onOpenInConfigurator,
}: {
  side: any
  accent: string
  accentSoft: string
  studyType: string
  backgroundUrl?: string | null
  aspectRatio?: string | null
  isLeader: boolean
  onPreview: (design: DesignRankItem) => void
  onOpenInConfigurator?: (design: DesignRankItem) => void
}) {
  const design = side?.top_design as DesignRankItem | undefined
  const element = side?.top_element as
    | { name?: string; value?: number; category?: string; fact_id?: string }
    | undefined
  const available = side?.available !== false && Boolean(design || element)

  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col rounded-2xl border bg-white p-2.5 shadow-sm sm:p-3 ${
        isLeader ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-100"
      }`}
      style={{ backgroundImage: `linear-gradient(180deg, ${accentSoft}, #ffffff 42%)` }}
    >
      {isLeader ? (
        <span className="absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm">
          <Crown className="h-3 w-3" />
          Leads
        </span>
      ) : null}

      <div className="mb-2 flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <p
            className="truncate text-[11px] font-black uppercase tracking-wide"
            style={{
              color:
                side?.polarity === "worst"
                  ? "#BE123C"
                  : side?.polarity === "best"
                    ? "#047857"
                    : accent,
            }}
          >
            {side?.label || "Side"}
          </p>
          {side?.segment_key || side?.gender_key || side?.age_key ? (
            <p className="truncate text-[10px] text-gray-500">
              {[side?.gender_key, side?.age_key, side?.segment_key].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        {design ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold uppercase text-gray-400">Score</p>
            <p className="text-lg font-black tabular-nums text-gray-900 sm:text-xl">
              {design.score}
            </p>
          </div>
        ) : null}
      </div>

      {!available ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/70 px-3 py-8 text-center text-xs text-gray-500">
          No verified data for this side
        </div>
      ) : (
        <>
          {design ? (
            <button
              type="button"
              onClick={() => onPreview(design)}
              className="group relative mx-auto w-full cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2674BA]"
              aria-label={`Preview ${side?.label || "design"}`}
            >
              <DesignPreviewComposite
                studyType={studyType}
                elements={design.elements || []}
                backgroundUrl={backgroundUrl}
                aspectRatio={aspectRatio}
                mini
              />
              <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white opacity-90 transition group-hover:opacity-100 sm:opacity-0">
                <Expand className="h-3 w-3" />
                View
              </span>
            </button>
          ) : null}

          {element ? (
            <div className="mt-2 rounded-xl bg-white/90 px-2.5 py-2 ring-1 ring-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Top element
              </p>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-bold text-gray-900">{element.name}</p>
                <p className="shrink-0 text-xs font-black tabular-nums" style={{ color: accent }}>
                  {element.value}
                </p>
              </div>
              {element.category ? (
                <p className="truncate text-[10px] text-gray-500">{element.category}</p>
              ) : null}
            </div>
          ) : null}

          {design?.elements?.length ? (
            <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-gray-500">
              {design.elements.map((el) => el.name).join(" · ")}
            </p>
          ) : null}

          {design && onOpenInConfigurator ? (
            <button
              type="button"
              onClick={() => onOpenInConfigurator(design)}
              className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <LayoutTemplate className="h-3 w-3" />
              Open
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

export function SideBySideCompareCard({
  title,
  data,
  onOpenInConfigurator,
}: {
  title?: string | null
  data: any
  onOpenInConfigurator?: (design: DesignRankItem, meta?: Record<string, any>) => void
}) {
  const left = data?.left || data?.sides?.[0]
  const right = data?.right || data?.sides?.[1]
  const studyType = data?.study_type || "grid"
  const backgroundUrl = data?.background_url
  const aspectRatio = data?.aspect_ratio
  const [previewDesign, setPreviewDesign] = useState<DesignRankItem | null>(null)
  const [previewLabel, setPreviewLabel] = useState<string>("")

  const leftScore = Number(data?.left_score ?? left?.top_design?.score ?? 0)
  const rightScore = Number(data?.right_score ?? right?.top_design?.score ?? 0)
  const gap = Number(data?.score_gap ?? Math.abs(leftScore - rightScore))
  const leaderLabel =
    data?.leader_label ||
    (leftScore >= rightScore ? left?.label : right?.label) ||
    null

  const modeLabel = useMemo(() => {
    const mode = String(data?.mode || "segment")
    if (mode === "design") return "Designs"
    if (mode === "classification") return "Classification cohorts"
    return "Segments"
  }, [data?.mode])

  if (!left && !right) return null

  const openPreview = (design: DesignRankItem, label: string) => {
    setPreviewDesign(design)
    setPreviewLabel(label)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-r from-[#2674BA]/8 via-white to-[#0D9488]/8 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold text-gray-900 sm:text-sm">
              <GitCompareArrows className="h-3.5 w-3.5 shrink-0 text-[#2674BA]" />
              <span className="truncate">{title || "Side-by-side comparison"}</span>
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-gray-500">
              {modeLabel}
              {data?.metric ? ` · ${data.metric}` : ""}
            </p>
          </div>
          {leaderLabel ? (
            <div className="shrink-0 rounded-xl bg-white px-2.5 py-1.5 text-right shadow-sm ring-1 ring-amber-200">
              <p className="text-[10px] font-semibold uppercase text-amber-700">Gap</p>
              <p className="text-sm font-black tabular-nums text-gray-900">+{gap}</p>
            </div>
          ) : null}
        </div>
        {left?.top_design || right?.top_design ? (
          <ScoreBar
            left={leftScore}
            right={rightScore}
            leftColor="#2674BA"
            rightColor="#0D9488"
          />
        ) : null}
      </div>

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-stretch gap-1 p-2 sm:gap-1.5 sm:p-3">
        <CompareSidePanel
          side={left}
          accent="#2674BA"
          accentSoft="rgba(38,116,186,0.08)"
          studyType={studyType}
          backgroundUrl={backgroundUrl}
          aspectRatio={aspectRatio}
          isLeader={Boolean(leaderLabel && leaderLabel === left?.label)}
          onPreview={(design) => openPreview(design, left?.label || "Left")}
          onOpenInConfigurator={
            onOpenInConfigurator
              ? (design) =>
                  onOpenInConfigurator(design, {
                    metric: data?.metric,
                    background_url: backgroundUrl,
                    aspect_ratio: aspectRatio,
                  })
              : undefined
          }
        />

        <div className="flex items-center justify-center px-0.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-[10px] font-black tracking-wide text-white shadow-md sm:h-9 sm:w-9 sm:text-[11px]">
            VS
          </span>
        </div>

        <CompareSidePanel
          side={right}
          accent="#0D9488"
          accentSoft="rgba(13,148,136,0.08)"
          studyType={studyType}
          backgroundUrl={backgroundUrl}
          aspectRatio={aspectRatio}
          isLeader={Boolean(leaderLabel && leaderLabel === right?.label)}
          onPreview={(design) => openPreview(design, right?.label || "Right")}
          onOpenInConfigurator={
            onOpenInConfigurator
              ? (design) =>
                  onOpenInConfigurator(design, {
                    metric: data?.metric,
                    background_url: backgroundUrl,
                    aspect_ratio: aspectRatio,
                  })
              : undefined
          }
        />
      </div>

      {leaderLabel ? (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-600">
          <span className="font-bold text-gray-900">{leaderLabel}</span> leads by{" "}
          <span className="font-black tabular-nums text-[#2674BA]">{gap}</span> coefficient points
          on best verified design score.
        </div>
      ) : null}

      {previewDesign ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewLabel}`}
          onClick={() => setPreviewDesign(null)}
        >
          <div
            className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white p-3 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{previewLabel}</p>
                <p className="text-xs text-gray-500">Score {previewDesign.score}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDesign(null)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
              <DesignPreviewComposite
                studyType={studyType}
                elements={previewDesign.elements || []}
                backgroundUrl={backgroundUrl}
                aspectRatio={aspectRatio}
                fullscreen
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
