"use client"

import { useEffect, useState } from "react"
import type { Ref } from "react"
import { imageCacheManager } from "@/lib/utils/imageCacheManager"

/**
 * Paints an already-cached low-res thumbnail instantly, then fades in the
 * full-quality image once it decodes. Mirrors the pattern used by the
 * response design configurator: only a tiny thumbnail and one right-sized
 * image are ever mounted per instance, so decoded-bitmap memory stays
 * bounded even when many of these are rendered at once (e.g. a template
 * picker list on mobile).
 */
export function ProgressiveImage({
  thumbUrl,
  fullUrl,
  alt,
  wrapperClassName,
  wrapperStyle,
  imgClassName,
  loading = "lazy",
  imgRef,
  onLoad,
}: {
  thumbUrl: string
  fullUrl: string
  alt: string
  wrapperClassName?: string
  wrapperStyle?: React.CSSProperties
  imgClassName?: string
  loading?: "eager" | "lazy"
  imgRef?: Ref<HTMLImageElement>
  onLoad?: () => void
}) {
  const initiallyCached = imageCacheManager.isPreloaded(fullUrl)
  const [hiResReady, setHiResReady] = useState(initiallyCached)
  const [usePlaceholder, setUsePlaceholder] = useState(
    !initiallyCached && Boolean(thumbUrl) && thumbUrl !== fullUrl
  )

  useEffect(() => {
    const cached = imageCacheManager.isPreloaded(fullUrl)
    setHiResReady(cached)
    setUsePlaceholder(!cached && Boolean(thumbUrl) && thumbUrl !== fullUrl)
  }, [fullUrl, thumbUrl])

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      {usePlaceholder && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          className={`${imgClassName ?? ""} absolute inset-0`}
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={fullUrl}
        alt={alt}
        loading={loading}
        decoding="async"
        className={`${imgClassName ?? ""} absolute inset-0`}
        style={{
          opacity: hiResReady ? 1 : 0,
          transition: usePlaceholder ? "opacity 150ms ease-out" : "none",
        }}
        onLoad={() => {
          setHiResReady(true)
          onLoad?.()
        }}
        onError={(event) => {
          event.currentTarget.style.display = "none"
        }}
      />
    </div>
  )
}
