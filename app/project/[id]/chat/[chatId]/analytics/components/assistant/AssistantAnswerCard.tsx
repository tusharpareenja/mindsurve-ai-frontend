"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useCallback, useState } from "react"
import { Download, Expand, LayoutTemplate, Loader2, X } from "lucide-react"
import { ProgressiveImage } from "@/components/shared/ProgressiveImage"
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal"
import { DesignPreviewComposite } from "./DesignPreviewComposite"
import { ExecutiveSummaryCard } from "./ExecutiveSummaryCard"
import { SideBySideCompareCard } from "./SideBySideCompareCard"
import type { AssistantBlock, DesignRankItem } from "@/lib/types/analyticsAssistant"
import {
  getConfiguratorExportProxyUrl,
  getConfiguratorResponsivePreviewUrl,
  getConfiguratorThumbnailUrl,
} from "@/lib/utils/configuratorImageUrls"
import { renderLayersToCanvas } from "@/lib/canvas-export"

const COLORS = ["#2674BA", "#22C55E", "#FCCD5B", "#F7945A", "#C04E35", "#8B5CF6", "#06B6D4"]

function safeFileName(value: string, fallback = "design") {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || fallback
  )
}

function aspectForCanvas(value?: string | null): "portrait" | "landscape" | "square" {
  const normalized = String(value || "").replace(/\s+/g, "")
  if (normalized === "16/9" || normalized === "16:9") return "landscape"
  if (normalized === "1/1" || normalized === "1:1") return "square"
  return "portrait"
}

function createTextLayerDataUrl(text: string): string {
  const canvas = document.createElement("canvas")
  canvas.width = 1200
  canvas.height = 600
  const context = canvas.getContext("2d")
  if (!context) return ""
  context.fillStyle = "rgba(255,255,255,0.94)"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "#111827"
  context.font = "700 64px Arial, sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  const words = String(text || "").split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width > 1050 && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  const lineHeight = 78
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2
  lines.slice(0, 6).forEach((value, index) => {
    context.fillText(value, canvas.width / 2, startY + index * lineHeight)
  })
  const url = canvas.toDataURL("image/png")
  canvas.width = 1
  canvas.height = 1
  return url
}

async function downloadLayerDesign(
  design: DesignRankItem,
  backgroundUrl?: string | null,
  aspectRatio?: string | null
) {
  const renderableElements = design.elements || []
  const selectedImageIds: Record<string, string> = {}
  const layers = renderableElements.map((element) => {
    const transform = element.transform || { x: 0, y: 0, width: 100, height: 100 }
    const sourceUrl = element.image_url || createTextLayerDataUrl(element.name)
    selectedImageIds[element.category_key] = element.element_id
    return {
      id: element.category_key,
      name: element.category_name,
      visible: true,
      z: element.z_index || 0,
      transform: {
        x: Number(transform.x ?? 0),
        y: Number(transform.y ?? 0),
        width: Number(transform.width ?? 100),
        height: Number(transform.height ?? 100),
      },
      images: [
        {
          id: element.element_id,
          name: element.name,
          previewUrl: sourceUrl.startsWith("data:")
            ? sourceUrl
            : getConfiguratorExportProxyUrl(sourceUrl),
          secureUrl: sourceUrl.startsWith("data:")
            ? sourceUrl
            : getConfiguratorExportProxyUrl(sourceUrl),
          x: Number(transform.x ?? 0),
          y: Number(transform.y ?? 0),
          width: Number(transform.width ?? 100),
          height: Number(transform.height ?? 100),
        },
      ],
    }
  })

  const canvas = await renderLayersToCanvas(
    backgroundUrl
      ? {
          previewUrl: getConfiguratorExportProxyUrl(backgroundUrl),
          secureUrl: getConfiguratorExportProxyUrl(backgroundUrl),
        }
      : null,
    layers,
    selectedImageIds,
    aspectForCanvas(aspectRatio)
  )

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Could not create image"))),
      "image/png",
      1
    )
  })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = `${safeFileName(`best-design-${design.rank}`)}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
  // Release the large 1080p backing store immediately on low-memory phones.
  canvas.width = 1
  canvas.height = 1
}

function ChartCard({ title, data }: { title?: string | null; data: any }) {
  const items = Array.isArray(data?.items) ? data.items : []
  const chartType = data?.chart_type || "horizontal_bar"
  if (!items.length) return null

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
      <div className="h-44 w-full sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" || chartType === "donut" ? (
            <PieChart>
              <Pie
                data={items}
                dataKey="value"
                nameKey="name"
                innerRadius={chartType === "donut" ? "55%" : 0}
                outerRadius="80%"
                paddingAngle={2}
              >
                {items.map((_: any, idx: number) => (
                  <Cell key={idx} fill={items[idx]?.fill || COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart
              data={items.slice(0, 10)}
              layout={chartType === "bar" ? "horizontal" : "vertical"}
              margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
            >
              {chartType === "bar" ? (
                <>
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {items.slice(0, 10).map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </>
              ) : (
                <>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {items.slice(0, 10).map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </>
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function KpiCard({ title, data }: { title?: string | null; data: any }) {
  const items = Array.isArray(data?.items) ? data.items : []
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {items.map((item: any) => (
          <div key={item.label} className="rounded-lg bg-[#2674BA]/5 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#2674BA]/80">
              {item.label}
            </p>
            <p className="text-base font-black tabular-nums text-gray-900 sm:text-lg">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ElementsCard({ title, data }: { title?: string | null; data: any }) {
  const items = Array.isArray(data?.items) ? data.items : []
  const [lightbox, setLightbox] = useState<{ isOpen: boolean; src: string | null; alt: string }>({
    isOpen: false,
    src: null,
    alt: "",
  })

  const openLightbox = useCallback((imageUrl: string, name: string) => {
    setLightbox({
      isOpen: true,
      src: getConfiguratorResponsivePreviewUrl(imageUrl, true),
      alt: name || "Element",
    })
  }, [])

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
      <div className="space-y-2">
        {items.map((item: any) => (
          <div
            key={item.fact_id || item.element_id}
            className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-2"
          >
            {item.image_url ? (
              <button
                type="button"
                onClick={() => openLightbox(item.image_url, item.name)}
                className="group relative shrink-0 cursor-pointer rounded-lg outline-none ring-[#2674BA]/0 transition hover:ring-2 hover:ring-[#2674BA]/40 focus-visible:ring-2 focus-visible:ring-[#2674BA]"
                aria-label={`View ${item.name} fullscreen`}
                title="Click to view larger"
              >
                <ProgressiveImage
                  thumbUrl={getConfiguratorThumbnailUrl(item.image_url)}
                  fullUrl={getConfiguratorResponsivePreviewUrl(item.image_url)}
                  alt={item.name}
                  wrapperClassName="relative h-12 w-12 overflow-hidden rounded-lg bg-white"
                  imgClassName="h-full w-full object-contain p-1"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition group-hover:bg-black/25">
                  <Expand className="h-3.5 w-3.5 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                </span>
              </button>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-white text-[10px] font-bold text-[#2674BA]">
                #{item.rank}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-gray-900 sm:text-sm">{item.name}</p>
              <p className="truncate text-[11px] text-gray-500">
                {item.category} · [{item.fact_id}]
              </p>
            </div>
            <p className="shrink-0 text-sm font-black tabular-nums text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>
      <ImageLightboxModal
        src={lightbox.src}
        alt={lightbox.alt}
        isOpen={lightbox.isOpen}
        onClose={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

function ClassificationCard({ title, data }: { title?: string | null; data: any }) {
  const options = Array.isArray(data?.options) ? data.options : []
  const focus = new Set(
    (Array.isArray(data?.focus_options) ? data.focus_options : []).map((value: string) =>
      String(value || "").trim().toLowerCase()
    )
  )
  const totalAnswered = Number(data?.answered ?? 0)
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
      <p className="mb-3 text-xs text-gray-600">
        Total answered:{" "}
        <span className="font-black tabular-nums text-gray-900">{totalAnswered}</span>
        {data?.total_respondents != null ? (
          <span className="text-gray-500"> of {data.total_respondents}</span>
        ) : null}
        {data?.segment_label && data.segment_label !== "Overall" ? (
          <span className="text-gray-500"> · {data.segment_label}</span>
        ) : (
          <span className="text-gray-500"> completed</span>
        )}
      </p>
      <div className="space-y-2">
        {options.map((opt: any) => {
          const highlighted = focus.has(String(opt.option || "").trim().toLowerCase())
          return (
            <div
              key={opt.fact_id || opt.option}
              className={highlighted ? "rounded-lg bg-[#2674BA]/5 px-2 py-1.5 -mx-1" : undefined}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-semibold text-gray-800">{opt.option}</span>
                <span className="shrink-0 tabular-nums text-gray-600">
                  {opt.count} ({opt.percentage}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#2674BA]"
                  style={{ width: `${Math.max(0, Math.min(100, Number(opt.percentage) || 0))}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DesignsCard({
  title,
  data,
  onOpenInConfigurator,
}: {
  title?: string | null
  data: any
  onOpenInConfigurator?: (design: DesignRankItem, meta?: Record<string, any>) => void
}) {
  const designs = (Array.isArray(data?.designs) ? data.designs : []) as DesignRankItem[]
  const studyType = data?.study_type || "grid"
  const [previewDesign, setPreviewDesign] = useState<DesignRankItem | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = async (design: DesignRankItem) => {
    if (studyType !== "layer" || downloadingId) return
    setDownloadingId(design.fact_id)
    try {
      await downloadLayerDesign(design, data?.background_url, data?.aspect_ratio)
    } catch (error) {
      console.error("Assistant design download failed", error)
      alert("Failed to download this design. Please try again.")
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
      {data?.constraints_applied ? (
        <p className="mb-2 text-[11px] font-medium text-emerald-700">
          Design constraints applied
          {data?.constraint_count ? ` (${data.constraint_count})` : ""} · complete layer stack
        </p>
      ) : studyType === "layer" ? (
        <p className="mb-2 text-[11px] font-medium text-gray-500">Complete layer stack</p>
      ) : null}
      {Array.isArray(data?.must_include) && data.must_include.length > 0 ? (
        <p className="mb-2 text-[11px] font-medium text-[#2674BA]">
          Required in design: {data.must_include.join(" · ")}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3">
        {designs.map((design) => (
          <div key={design.fact_id} className="rounded-xl border border-gray-100 bg-gray-50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-gray-900">
                #{design.rank} · [{design.fact_id}]
              </p>
              <div className="flex items-center gap-1">
                <p className="mr-1 text-sm font-black tabular-nums text-[#2674BA]">{design.score}</p>
                <button
                  type="button"
                  onClick={() => setPreviewDesign(design)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-gray-500 ring-1 ring-gray-200 hover:text-[#2674BA]"
                  aria-label={`Preview design ${design.rank}`}
                  title="Fullscreen preview"
                >
                  <Expand className="h-4 w-4" />
                </button>
                {studyType === "layer" ? (
                  <button
                    type="button"
                    onClick={() => void handleDownload(design)}
                    disabled={Boolean(downloadingId)}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#2674BA] text-white hover:bg-[#1f5f99] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Download design ${design.rank}`}
                    title="Download full-quality PNG"
                  >
                    {downloadingId === design.fact_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewDesign(design)}
              className="group relative mx-auto flex w-full max-w-[220px] cursor-pointer justify-center rounded-xl outline-none ring-[#2674BA]/0 transition hover:ring-2 hover:ring-[#2674BA]/35 focus-visible:ring-2 focus-visible:ring-[#2674BA]"
              aria-label={`View design ${design.rank} fullscreen`}
              title="Click to view larger"
            >
              <DesignPreviewComposite
                studyType={studyType}
                elements={design.elements || []}
                backgroundUrl={data?.background_url}
                aspectRatio={data?.aspect_ratio}
                compact
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition group-hover:bg-black/20">
                <Expand className="h-5 w-5 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
              </span>
            </button>
            <p className="mt-2 line-clamp-2 text-[11px] text-gray-600">
              {(design.elements || []).map((el) => el.name).join(" · ")}
            </p>
            {onOpenInConfigurator ? (
              <button
                type="button"
                onClick={() =>
                  onOpenInConfigurator(design, {
                    metric: data?.metric,
                    background_url: data?.background_url,
                    aspect_ratio: data?.aspect_ratio,
                  })
                }
                className="mt-2.5 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#2674BA] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#1f5f99]"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                Open in Design Configurator
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {previewDesign ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview design ${previewDesign.rank}`}
          onClick={() => setPreviewDesign(null)}
        >
          <div
            className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white p-3 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Design #{previewDesign.rank}</p>
                <p className="text-xs text-gray-500">Score {previewDesign.score}</p>
              </div>
              <div className="flex items-center gap-2">
                {studyType === "layer" ? (
                  <button
                    type="button"
                    onClick={() => void handleDownload(previewDesign)}
                    disabled={Boolean(downloadingId)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#2674BA] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloadingId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download PNG
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreviewDesign(null)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
              <DesignPreviewComposite
                studyType={studyType}
                elements={previewDesign.elements || []}
                backgroundUrl={data?.background_url}
                aspectRatio={data?.aspect_ratio}
                fullscreen
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DesignExplanationCard({
  title,
  data,
  onOpenInConfigurator,
}: {
  title?: string | null
  data: any
  onOpenInConfigurator?: (design: DesignRankItem, meta?: Record<string, any>) => void
}) {
  const best = data?.best as DesignRankItem | undefined
  const runnerUp = data?.runner_up as DesignRankItem | undefined
  const contributions = Array.isArray(data?.contributions) ? data.contributions : []
  if (!best) return null
  const maxAbs = Math.max(1, ...contributions.map((item: any) => Math.abs(Number(item.value) || 0)))

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
      <div className="flex justify-center">
        <DesignPreviewComposite
          studyType={data?.study_type || "grid"}
          elements={best.elements || []}
          backgroundUrl={data?.background_url}
          aspectRatio={data?.aspect_ratio}
          compact
        />
      </div>
      {onOpenInConfigurator ? (
        <button
          type="button"
          onClick={() =>
            onOpenInConfigurator(best, {
              metric: data?.metric,
              background_url: data?.background_url,
              aspect_ratio: data?.aspect_ratio,
            })
          }
          className="mt-2.5 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#2674BA] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#1f5f99]"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Open in Design Configurator
        </button>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-[#2674BA]/5 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-[#2674BA]">Best score</p>
          <p className="text-lg font-black tabular-nums text-gray-900">{best.score}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-emerald-700">Lead</p>
          <p className="text-lg font-black tabular-nums text-gray-900">
            {data?.delta == null ? "—" : `+${data.delta}`}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
          Element contributions
        </p>
        {contributions.map((item: any, index: number) => {
          const value = Number(item.value) || 0
          return (
            <div key={`${item.category}-${item.name}-${index}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-semibold text-gray-800">{item.name}</span>
                <span className="shrink-0 font-bold tabular-nums text-gray-700">{value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${value >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                  style={{ width: `${Math.max(3, (Math.abs(value) / maxAbs) * 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {runnerUp ? (
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          Runner-up score: {runnerUp.score}. The ranking compares only complete, valid designs
          under the same metric, segment, and constraints.
        </p>
      ) : null}
    </div>
  )
}

function UseAvoidCard({ title, data }: { title?: string | null; data: any }) {
  const [lightbox, setLightbox] = useState<{ isOpen: boolean; src: string | null; alt: string }>({
    isOpen: false,
    src: null,
    alt: "",
  })

  const openLightbox = useCallback((imageUrl: string, name: string) => {
    setLightbox({
      isOpen: true,
      src: getConfiguratorResponsivePreviewUrl(imageUrl, true),
      alt: name || "Element",
    })
  }, [])

  const renderRow = (item: any, tone: "use" | "avoid") => (
    <div
      key={item.fact_id || item.name}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
        tone === "use" ? "bg-emerald-50" : "bg-rose-50"
      }`}
    >
      {item.image_url ? (
        <button
          type="button"
          onClick={() => openLightbox(item.image_url, item.name)}
          className="group relative shrink-0 cursor-pointer rounded-md outline-none ring-[#2674BA]/0 transition hover:ring-2 hover:ring-[#2674BA]/40 focus-visible:ring-2 focus-visible:ring-[#2674BA]"
          aria-label={`View ${item.name} fullscreen`}
          title="Click to view larger"
        >
          <ProgressiveImage
            thumbUrl={getConfiguratorThumbnailUrl(item.image_url)}
            fullUrl={getConfiguratorResponsivePreviewUrl(item.image_url)}
            alt={item.name}
            wrapperClassName="relative h-9 w-9 overflow-hidden rounded-md bg-white"
            imgClassName="h-full w-full object-contain p-0.5"
          />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-gray-900">{item.name}</span>
        <span className="ml-1 text-gray-500">({item.value})</span>
      </div>
    </div>
  )

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase text-emerald-700">Use</p>
          <div className="space-y-1">{(data?.use || []).map((item: any) => renderRow(item, "use"))}</div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase text-rose-700">Avoid</p>
          <div className="space-y-1">{(data?.avoid || []).map((item: any) => renderRow(item, "avoid"))}</div>
        </div>
      </div>
      <ImageLightboxModal
        src={lightbox.src}
        alt={lightbox.alt}
        isOpen={lightbox.isOpen}
        onClose={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

export function AssistantAnswerCard({
  block,
  onOpenInConfigurator,
}: {
  block: AssistantBlock
  onOpenInConfigurator?: (design: DesignRankItem, meta?: Record<string, any>) => void
}) {
  const type = block.type
  const title = block.title
  const data = block.data || {}

  if (type === "kpi") return <KpiCard title={title} data={data} />
  if (type === "chart") return <ChartCard title={title} data={data} />
  if (type === "top_bottom_elements") return <ElementsCard title={title} data={data} />
  if (type === "classification_distribution") return <ClassificationCard title={title} data={data} />
  if (type === "top_k_designs") {
    return <DesignsCard title={title} data={data} onOpenInConfigurator={onOpenInConfigurator} />
  }
  if (type === "design_explanation") {
    return (
      <DesignExplanationCard title={title} data={data} onOpenInConfigurator={onOpenInConfigurator} />
    )
  }
  if (type === "side_by_side_compare") {
    return (
      <SideBySideCompareCard title={title} data={data} onOpenInConfigurator={onOpenInConfigurator} />
    )
  }
  if (type === "executive_summary") {
    return (
      <ExecutiveSummaryCard
        title={title}
        data={data}
        onOpenInConfigurator={onOpenInConfigurator}
      />
    )
  }
  if (type === "use_avoid") return <UseAvoidCard title={title} data={data} />
  if (type === "segment_comparison") {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
        <div className="space-y-1.5">
          {(data?.rows || []).map((row: any) => (
            <div key={row.fact_id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5 text-xs">
              <span className="font-semibold text-gray-800">{row.segment}</span>
              <span className="tabular-nums text-gray-700">top {row.top}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (type === "mindset") {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase text-emerald-700">Attracted to</p>
            {(data?.attracted || []).map((item: any, idx: number) => (
              <div key={`a-${idx}`} className="rounded-lg bg-emerald-50 px-2 py-1.5 text-xs mb-1">
                <span className="font-semibold">{item.name}</span>
                <span className="ml-1 text-gray-500">({item.value})</span>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase text-rose-700">Less attracted</p>
            {(data?.avoid || []).map((item: any, idx: number) => (
              <div key={`n-${idx}`} className="rounded-lg bg-rose-50 px-2 py-1.5 text-xs mb-1">
                <span className="font-semibold">{item.name}</span>
                <span className="ml-1 text-gray-500">({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  if (type === "fatigue") {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 px-2 py-2">
            <p className="text-[10px] font-semibold text-gray-500">Risk</p>
            <p className="text-sm font-black capitalize text-gray-900">{data?.risk}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-2">
            <p className="text-[10px] font-semibold text-gray-500">Early</p>
            <p className="text-sm font-black text-gray-900">{Number(data?.early || 0).toFixed(2)}s</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-2">
            <p className="text-[10px] font-semibold text-gray-500">Late</p>
            <p className="text-sm font-black text-gray-900">{Number(data?.late || 0).toFixed(2)}s</p>
          </div>
        </div>
      </div>
    )
  }
  if (type === "saved_designs") {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        {title ? <p className="mb-2 text-xs font-bold text-gray-800 sm:text-sm">{title}</p> : null}
        <div className="space-y-1.5">
          {(data?.items || []).map((item: any) => (
            <div key={item.fact_id || item.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5 text-xs">
              <span className="truncate font-semibold text-gray-800">{item.name}</span>
              <span className="tabular-nums text-gray-600">{item.total_coefficient ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}
