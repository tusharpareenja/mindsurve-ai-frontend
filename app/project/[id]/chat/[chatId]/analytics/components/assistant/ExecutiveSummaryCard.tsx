"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useState } from "react"
import {
  Award,
  BarChart3,
  Expand,
  Filter,
  Layers3,
  LayoutTemplate,
  Scale,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react"
import { ProgressiveImage } from "@/components/shared/ProgressiveImage"
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal"
import {
  getConfiguratorResponsivePreviewUrl,
  getConfiguratorThumbnailUrl,
} from "@/lib/utils/configuratorImageUrls"
import type { DesignRankItem } from "@/lib/types/analyticsAssistant"
import { DesignPreviewComposite } from "./DesignPreviewComposite"

const FINDING_ICONS: LucideIcon[] = [Award, Layers3, Scale, Filter, Sparkles, BarChart3]

const ACCENTS = [
  { ring: "ring-[#2674BA]/20", bg: "bg-[#2674BA]/10", text: "text-[#2674BA]", bar: "bg-[#2674BA]" },
  { ring: "ring-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
  { ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
  { ring: "ring-teal-200", bg: "bg-teal-50", text: "text-teal-700", bar: "bg-teal-500" },
  { ring: "ring-rose-200", bg: "bg-rose-50", text: "text-rose-700", bar: "bg-rose-500" },
]

type LightboxState = { isOpen: boolean; src: string | null; alt: string }

export function ExecutiveSummaryCard({
  title,
  data,
  onOpenInConfigurator,
}: {
  title?: string | null
  data: any
  onOpenInConfigurator?: (design: DesignRankItem, meta?: Record<string, any>) => void
}) {
  const bullets = Array.isArray(data?.bullets) ? data.bullets : []
  const studyType = data?.study_type || "grid"
  const backgroundUrl = data?.background_url
  const aspectRatio = data?.aspect_ratio
  const [lightbox, setLightbox] = useState<LightboxState>({ isOpen: false, src: null, alt: "" })
  const [previewDesign, setPreviewDesign] = useState<DesignRankItem | null>(null)

  const openLightbox = useCallback((imageUrl: string, name: string) => {
    setLightbox({
      isOpen: true,
      src: getConfiguratorResponsivePreviewUrl(imageUrl, true),
      alt: name || "Finding image",
    })
  }, [])

  if (!bullets.length) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-br from-[#2674BA]/10 via-white to-emerald-50/60 px-3 py-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2674BA] text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900 sm:text-sm">
              {title || "Executive summary"}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
              {data?.study_title
                ? `Top verified findings for ${data.study_title}`
                : "Top verified findings from this study"}
            </p>
          </div>
        </div>
      </div>

      <ol className="space-y-2 p-2.5 sm:p-3">
        {bullets.map((bullet: any, index: number) => {
          const accent = ACCENTS[index % ACCENTS.length]
          const Icon = FINDING_ICONS[index % FINDING_ICONS.length]
          const rank = bullet.rank ?? index + 1
          const design = bullet.design as DesignRankItem | undefined
          const hasDesign =
            Boolean(design) && Array.isArray(design?.elements) && (design?.elements?.length || 0) > 0
          const images = Array.isArray(bullet.images)
            ? bullet.images.filter((img: any) => img?.image_url)
            : bullet.image_url
              ? [{ name: bullet.title, image_url: bullet.image_url }]
              : []

          return (
            <li
              key={bullet.fact_id || `finding-${index}`}
              className={`relative overflow-hidden rounded-xl bg-white p-2.5 ring-1 ${accent.ring}`}
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${accent.bar}`} />
              <div className="flex items-start gap-2.5 pl-1.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent.bg} ${accent.text}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${accent.bg} ${accent.text}`}
                    >
                      {rank}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-xs font-bold text-gray-900">
                      {bullet.title || `Finding ${rank}`}
                    </p>
                    {bullet.fact_id ? (
                      <span className="shrink-0 text-[10px] font-semibold text-gray-400">
                        [{bullet.fact_id}]
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[12px] leading-relaxed text-gray-600 sm:text-[13px]">
                    {bullet.text}
                  </p>

                  {hasDesign && design ? (
                    <div className="mt-2 flex w-full min-w-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDesign(design)}
                        className="group relative mx-auto flex w-full max-w-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gray-50 p-1.5 outline-none ring-[#2674BA]/0 transition hover:ring-2 hover:ring-[#2674BA]/35 focus-visible:ring-2 focus-visible:ring-[#2674BA] sm:max-w-[200px]"
                        aria-label="View top design fullscreen"
                        title="Click to view larger"
                      >
                        <DesignPreviewComposite
                          studyType={studyType}
                          elements={design.elements}
                          backgroundUrl={backgroundUrl}
                          aspectRatio={aspectRatio}
                          compact
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition group-hover:bg-black/25">
                          <Expand className="h-4 w-4 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                        </span>
                      </button>
                      {onOpenInConfigurator ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenInConfigurator(design, {
                              metric: data?.metric,
                              background_url: backgroundUrl,
                              aspect_ratio: aspectRatio,
                            })
                          }
                          className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#2674BA] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#1f5f99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2674BA]/40"
                        >
                          <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Open in Design Configurator</span>
                        </button>
                      ) : null}
                    </div>
                  ) : images.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {images.map((img: any, imgIndex: number) => (
                        <button
                          key={`${bullet.fact_id || rank}-img-${imgIndex}`}
                          type="button"
                          onClick={() => openLightbox(img.image_url, img.name || bullet.title)}
                          className="group relative shrink-0 cursor-pointer rounded-lg outline-none ring-[#2674BA]/0 transition hover:ring-2 hover:ring-[#2674BA]/40 focus-visible:ring-2 focus-visible:ring-[#2674BA]"
                          aria-label={`View ${img.name || "image"} fullscreen`}
                          title="Click to view larger"
                        >
                          <ProgressiveImage
                            thumbUrl={getConfiguratorThumbnailUrl(img.image_url)}
                            fullUrl={getConfiguratorResponsivePreviewUrl(img.image_url)}
                            alt={img.name || bullet.title || "Finding"}
                            wrapperClassName="relative h-14 w-14 overflow-hidden rounded-lg bg-white ring-1 ring-gray-100"
                            imgClassName="h-full w-full object-contain p-1"
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition group-hover:bg-black/25">
                            <Expand className="h-3.5 w-3.5 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <ImageLightboxModal
        src={lightbox.src}
        alt={lightbox.alt}
        isOpen={lightbox.isOpen}
        onClose={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
      />

      {previewDesign ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Preview top design"
          onClick={() => setPreviewDesign(null)}
        >
          <div
            className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white p-3 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">Top design</p>
                <p className="text-xs text-gray-500">Score {previewDesign.score}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {onOpenInConfigurator ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenInConfigurator(previewDesign, {
                        metric: data?.metric,
                        background_url: backgroundUrl,
                        aspect_ratio: aspectRatio,
                      })
                      setPreviewDesign(null)
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#2674BA] px-3 py-2 text-xs font-bold text-white hover:bg-[#1f5f99]"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    Open in Configurator
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
