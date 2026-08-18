"use client"

import React, { useState, useCallback } from "react"

const TICK_WIDTH = 112
const THUMB_SIZE = 36
/** Gap between label and Y-axis line */
const GAP = 0
/** Position labels left of tick so they don't overlap bars; small gap before axis */
const LABEL_OFFSET_X = -(TICK_WIDTH + GAP)

export interface PerformerThumbnailProps {
  /** Performer display name (for text fallback and alt) */
  name: string
  /** Truncated short name for text display */
  shortName: string
  /** Image URL for thumbnail (null/undefined = text only) */
  imageUrl?: string | null
  /** Called when thumbnail is clicked (only when image is shown). */
  onThumbClick?: (imageUrl: string) => void
  /** Optional class for container */
  className?: string
}

export function PerformerThumbnail({
  name,
  shortName,
  imageUrl,
  onThumbClick,
  className = "",
}: PerformerThumbnailProps) {
  const [imageError, setImageError] = useState(false)

  /** Show image when URL exists (grid, hybrid, layer - per-element; text study has no URLs) */
  const showImage = !!imageUrl && !imageError
  const showText = !showImage

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  const handleClick = useCallback(() => {
    if (showImage && imageUrl && onThumbClick) onThumbClick(imageUrl)
  }, [showImage, imageUrl, onThumbClick])

  return (
    <foreignObject
      x={LABEL_OFFSET_X}
      y={-THUMB_SIZE / 2}
      width={TICK_WIDTH}
      height={THUMB_SIZE}
      className={className}
    >
      <div
        className="flex h-full w-full items-center overflow-hidden"
        style={{ width: TICK_WIDTH, minWidth: TICK_WIDTH }}
      >
        {showImage ? (
          <button
            type="button"
            onClick={handleClick}
            className="flex h-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 transition hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            style={{
              width: THUMB_SIZE,
              minWidth: THUMB_SIZE,
              height: THUMB_SIZE,
            }}
            aria-label={`View ${name} in full size`}
          >
            <img
              src={imageUrl!}
              alt={name}
              width={THUMB_SIZE}
              height={THUMB_SIZE}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain"
              onError={handleImageError}
              referrerPolicy="no-referrer"
            />
          </button>
        ) : (
          <span
            className="truncate text-[10px] text-slate-600"
            title={name}
            style={{ maxWidth: TICK_WIDTH }}
          >
            {shortName}
          </span>
        )}
      </div>
    </foreignObject>
  )
}
