"use client"

import Link from "next/link"
import { PanelLeft, Bell } from "lucide-react"
import { BrandName } from "@/components/brand/BrandName"
import { cn } from "@/lib/utils"

type TopBarProps = {
  onOpenSidebar: () => void
  sidebarOpen?: boolean
  title?: string
  className?: string
}

/**
 * ChatGPT-style top bar: same surface as page, separated by a bottom line.
 * On desktop the icon rail opens the sidebar — hamburger only needed on mobile.
 */
export function TopBar({ onOpenSidebar, sidebarOpen, title, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200/60 bg-white/75 px-3 backdrop-blur-md sm:px-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {/* Mobile only — desktop uses collapsed icon rail */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="cursor-pointer inline-flex size-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden"
            aria-label="Open sidebar"
          >
            <PanelLeft className="size-5" />
          </button>
        )}
        <Link href="/welcome" className="cursor-pointer truncate">
          <BrandName withAi className="text-base sm:text-lg" />
        </Link>
        {title && (
          <>
            <span className="hidden text-gray-300 sm:inline" aria-hidden>
              /
            </span>
            <span className="hidden truncate text-sm text-gray-500 sm:inline">{title}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="cursor-pointer inline-flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
        </button>
      </div>
    </header>
  )
}
