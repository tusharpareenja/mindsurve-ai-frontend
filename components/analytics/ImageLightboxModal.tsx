"use client"

import React, { useEffect, useCallback } from "react"
import { X } from "lucide-react"

export interface ImageLightboxModalProps {
  /** High-quality image URL to display. Loaded only when modal opens. */
  src: string | null
  /** Alt text for accessibility */
  alt: string
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when user closes the modal */
  onClose: () => void
}

export function ImageLightboxModal({
  src,
  alt,
  isOpen,
  onClose,
}: ImageLightboxModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      {/* Dark overlay - click to close */}
      <div
        className="absolute inset-0 cursor-pointer bg-black/80 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Close image preview"
      >
        <X className="h-6 w-6" />
      </button>
      {/* Image container - stop propagation so clicking image doesn't close */}
      <div
        className="relative z-10 max-h-[90vh] max-w-[90vw] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] max-w-full object-contain"
            loading="eager"
          />
        ) : (
          <div className="flex h-48 w-64 items-center justify-center rounded-lg bg-gray-800/50 text-gray-400">
            Loading...
          </div>
        )}
      </div>
    </div>
  )
}
