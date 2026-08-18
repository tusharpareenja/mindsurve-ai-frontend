"use client"

import { useMemo } from "react"
import type { DesignElementSnapshot } from "@/lib/types/analyticsAssistant"
import { ProgressiveImage } from "@/components/shared/ProgressiveImage"
import {
  getConfiguratorResponsivePreviewUrl,
  getConfiguratorThumbnailUrl,
} from "@/lib/utils/configuratorImageUrls"

function parseAspect(aspectRatio?: string | null): "portrait" | "landscape" | "square" {
  const raw = (aspectRatio || "9 / 16").replace(/\s+/g, "")
  if (raw === "16/9" || raw === "16:9") return "landscape"
  if (raw === "1/1" || raw === "1:1") return "square"
  return "portrait"
}

/**
 * Shared responsive design preview used by the assistant and configurator cards.
 * Layer elements are stacked by ascending z-index with optional background fit.
 */
export function DesignPreviewComposite({
  studyType,
  elements,
  backgroundUrl,
  aspectRatio,
  className = "",
  compact = false,
  mini = false,
  fullscreen = false,
}: {
  studyType: string
  elements: DesignElementSnapshot[]
  backgroundUrl?: string | null
  aspectRatio?: string | null
  className?: string
  compact?: boolean
  /** Extra-small preview for side-by-side compare columns in the chat panel. */
  mini?: boolean
  fullscreen?: boolean
}) {
  const isLayer = (studyType || "").toLowerCase() === "layer"
  const aspect = parseAspect(aspectRatio)
  const aspectClass =
    aspect === "landscape" ? "aspect-[16/9]" : aspect === "square" ? "aspect-square" : "aspect-[9/16]"

  // Chat cards must stay short: a full-width 9:16 preview is ~2x taller than wide and
  // forces scrolling on phones. Cap height and let width follow aspect ratio.
  const frameClass = fullscreen
    ? `relative mx-auto w-full max-w-[min(90vw,420px)] overflow-hidden rounded-xl border border-gray-200 bg-slate-50 ${aspectClass} max-h-[min(72vh,560px)]`
    : mini
      ? aspect === "landscape"
        ? `relative mx-auto h-[88px] w-auto max-w-full overflow-hidden rounded-lg border border-gray-200 bg-slate-50 ${aspectClass}`
        : aspect === "square"
          ? `relative mx-auto h-[112px] w-[112px] max-w-full overflow-hidden rounded-lg border border-gray-200 bg-slate-50 ${aspectClass}`
          : `relative mx-auto h-[148px] w-auto max-w-[min(100%,96px)] overflow-hidden rounded-lg border border-gray-200 bg-slate-50 ${aspectClass}`
      : compact
        ? aspect === "landscape"
          ? `relative mx-auto h-[140px] w-auto max-w-full overflow-hidden rounded-xl border border-gray-200 bg-slate-50 ${aspectClass}`
          : aspect === "square"
            ? `relative mx-auto h-[168px] w-[168px] max-w-full overflow-hidden rounded-xl border border-gray-200 bg-slate-50 ${aspectClass}`
            : `relative mx-auto h-[220px] w-auto max-w-[min(100%,148px)] overflow-hidden rounded-xl border border-gray-200 bg-slate-50 ${aspectClass}`
        : `relative mx-auto w-full max-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-slate-50 ${aspectClass}`

  const sorted = useMemo(
    () =>
      [...(elements || [])].sort(
        (a, b) =>
          (a.z_index || 0) - (b.z_index || 0) ||
          String(a.category_name || "").localeCompare(String(b.category_name || "")) ||
          String(a.name || "").localeCompare(String(b.name || ""))
      ),
    [elements]
  )

  if (!sorted.length) {
    return (
      <div
        className={`flex items-center justify-center border-dashed text-xs text-gray-500 ${frameClass} ${className}`}
      >
        No elements
      </div>
    )
  }

  if (isLayer) {
    return (
      <div className={`${frameClass} ${className}`}>
        {backgroundUrl ? (
          <ProgressiveImage
            thumbUrl={getConfiguratorThumbnailUrl(backgroundUrl)}
            fullUrl={getConfiguratorResponsivePreviewUrl(backgroundUrl, fullscreen) || backgroundUrl}
            alt=""
            loading={fullscreen ? "eager" : "lazy"}
            wrapperClassName="absolute inset-0"
            wrapperStyle={{ zIndex: 0 }}
            imgClassName="h-full w-full object-contain"
          />
        ) : null}
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          {sorted.map((element) => {
            const transform = element.transform || { x: 0, y: 0, width: 100, height: 100 }
            const width = Math.max(1, Math.min(100, Number(transform.width ?? 100)))
            const height = Math.max(1, Math.min(100, Number(transform.height ?? 100)))
            const left = Math.max(0, Math.min(100 - width, Number(transform.x ?? 0)))
            const top = Math.max(0, Math.min(100 - height, Number(transform.y ?? 0)))
            const isText =
              !element.image_url || String(element.element_type || "").toLowerCase() === "text"
            return (
              <div
                key={element.element_id}
                className="absolute overflow-hidden"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  zIndex: (element.z_index || 0) + 1,
                }}
              >
                {isText ? (
                  <div className="flex h-full w-full items-center justify-center rounded-md bg-white/90 px-1 text-center text-[10px] font-semibold text-gray-800 shadow-sm sm:text-xs">
                    {element.name}
                  </div>
                ) : (
                  <ProgressiveImage
                    thumbUrl={getConfiguratorThumbnailUrl(element.image_url || undefined)}
                    fullUrl={
                      getConfiguratorResponsivePreviewUrl(element.image_url || undefined, fullscreen) ||
                      element.image_url ||
                      ""
                    }
                    alt={element.name}
                    loading={fullscreen ? "eager" : "lazy"}
                    wrapperClassName="absolute inset-0"
                    imgClassName="h-full w-full object-contain"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Grid / text / hybrid: responsive thumbnail mosaic
  const count = sorted.length
  const gridClass =
    count <= 1 ? "grid-cols-1" : count === 2 ? "grid-cols-2" : count === 3 ? "grid-cols-3" : "grid-cols-2"

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-2 sm:p-3 ${className}`}
      style={{ minHeight: compact ? 120 : 160 }}
    >
      <div className={`grid ${gridClass} gap-2`}>
        {sorted.map((element) => {
          const isText =
            !element.image_url || String(element.element_type || "").toLowerCase() === "text"
          return (
            <div
              key={element.element_id}
              className="flex min-h-[64px] items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 p-2 text-center"
            >
              {isText ? (
                <p className="text-[11px] font-semibold leading-snug text-gray-800 sm:text-xs">
                  {element.name}
                </p>
              ) : (
                <ProgressiveImage
                  thumbUrl={getConfiguratorThumbnailUrl(element.image_url || undefined)}
                  fullUrl={
                    getConfiguratorResponsivePreviewUrl(element.image_url || undefined, fullscreen) ||
                    element.image_url ||
                    ""
                  }
                  alt={element.name}
                  loading={fullscreen ? "eager" : "lazy"}
                  wrapperClassName="relative h-24 w-full"
                  imgClassName="h-full w-full object-contain"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
