"use client"

import { motion } from "framer-motion"
import { BRAND } from "@/lib/brand"

/**
 * Analytics top bar — matches Unilever dashboard header chrome.
 * Brand is display-only (not clickable), per MindSurve analytics UX.
 */
export function AnalyticsNavbar() {
  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="shrink-0 border-b border-[rgba(209,223,235,1)] bg-white px-3 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex h-14 min-w-0 max-w-7xl items-center sm:h-16">
        <div
          className="select-none whitespace-nowrap"
          aria-label="MindSurve AI"
          title="MindSurve AI"
        >
          {/* Same weight/size as Unilever BrandLogo in dashboard-header */}
          <span className="text-lg font-bold sm:text-2xl">
            <span style={{ color: BRAND.accent }}>{BRAND.prefix}</span>
            <span className="text-gray-800">{BRAND.suffix}</span>
            <span className="text-gray-800"> AI</span>
          </span>
        </div>
      </div>
    </motion.header>
  )
}
