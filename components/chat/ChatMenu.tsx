"use client"

import { useEffect, useRef, useState } from "react"
import { FolderInput, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

type ChatMenuProps = {
  onRename: () => void
  onMove: () => void
  onDelete: () => void
  onAddCollaborator?: () => void
  moveLabel?: string
  className?: string
}

export function ChatMenu({
  onRename,
  onMove,
  onDelete,
  onAddCollaborator,
  moveLabel = "Add to project",
  className,
}: ChatMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  return (
    <div ref={ref} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cn(
          "cursor-pointer inline-flex size-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700",
          "opacity-100 sm:opacity-0 sm:group-hover/chat:opacity-100 focus:opacity-100",
          open && "bg-gray-200 text-gray-700 opacity-100"
        )}
        aria-label="Chat actions"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
            onClick={() => {
              setOpen(false)
              onRename()
            }}
          >
            <Pencil className="size-3.5 text-gray-500" />
            Rename
          </button>
          <button
            type="button"
            className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
            onClick={() => {
              setOpen(false)
              onMove()
            }}
          >
            <FolderInput className="size-3.5 text-gray-500" />
            {moveLabel}
          </button>
          {onAddCollaborator && (
            <button
              type="button"
              className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => {
                setOpen(false)
                onAddCollaborator()
              }}
            >
              <UserPlus className="size-3.5 text-gray-500" />
              Add collaborator
            </button>
          )}
          <button
            type="button"
            className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
