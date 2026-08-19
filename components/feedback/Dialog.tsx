"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    if (open) {
      document.addEventListener("keydown", handler)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = "unset"
    }
  }, [open, onClose])

  if (!open) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-[1] w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 text-gray-900">{children}</div>
      </div>
    </div>,
    document.body
  )
}
