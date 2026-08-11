"use client"

import type { PropsWithChildren } from "react"

type GradientBackgroundProps = PropsWithChildren<{
  className?: string
}>

export default function GradientBackground({ children, className }: GradientBackgroundProps) {
  return (
    <div className={`relative min-h-screen bg-white overflow-hidden ${className ?? ""}`}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-500/10 via-blue-500/5 to-transparent blur-2xl"></div>
      {children}
    </div>
  )
}


