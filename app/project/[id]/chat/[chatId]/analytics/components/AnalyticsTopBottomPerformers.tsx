"use client"

import React, { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { getTopBottomPerformers } from "@/lib/utils/analysisDashboard"
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal"
import { PerformerThumbnail } from "./PerformerThumbnail"

const METRICS = ["Top Down", "Bottom Up", "Response Time"] as const
const BAR_COLORS = ["#2674BA", "#22C55E", "#F7945A"]

interface AnalyticsTopBottomPerformersProps {
  analysisData: any
  studyType?: string
}

export function AnalyticsTopBottomPerformers({ analysisData, studyType }: AnalyticsTopBottomPerformersProps) {
  const categoryLabel = (studyType || "").toLowerCase() === "layer" ? "Layer" : "Category"

  const [lightbox, setLightbox] = useState<{
    isOpen: boolean
    src: string | null
    alt: string
  }>({ isOpen: false, src: null, alt: "" })

  const handleThumbClick = useCallback((imageUrl: string, name: string) => {
    setLightbox({ isOpen: true, src: imageUrl, alt: name })
  }, [])

  const handleLightboxClose = useCallback(() => {
    setLightbox((prev) => ({ ...prev, isOpen: false }))
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 @5xl/analytics:grid-cols-2 @7xl/analytics:grid-cols-3 gap-6 mb-8"
    >
      {METRICS.map((metric, metricIndex) => {
        const { top } = getTopBottomPerformers(analysisData || {}, metric, 5)
        const topData = top.map((t) => ({
          ...t,
          shortName: t.name.length > 45 ? t.name.slice(0, 42) + "..." : t.name,
        }))
        const color = BAR_COLORS[metricIndex]
        const chartData = [...topData].reverse()

        const renderYAxisTick = (props: { x?: number; y?: number; index?: number }) => {
          const { x = 0, y = 0, index = 0 } = props
          const item = topData[topData.length - 1 - index] ?? {
            name: "",
            shortName: "",
            imageUrl: undefined,
          }
          return (
            <g transform={`translate(${x},${y})`}>
              <PerformerThumbnail
                name={item.name}
                shortName={item.shortName}
                imageUrl={item.imageUrl}
                onThumbClick={(url) => handleThumbClick(url, item.name)}
              />
            </g>
          )
        }

        return (
          <div
            key={metric}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <div
                className="h-8 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <h3 className="text-lg font-bold text-gray-800">
                Top 5 Performers ({metric})
              </h3>
            </div>
            {topData.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      width={120}
                      tick={renderYAxisTick as any}
                      tickLine={false}
                      axisLine={true}
                    />
                    <Tooltip
                      content={({ payload }) =>
                        payload?.[0] ? (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
                            <p className="font-semibold text-gray-800 mb-1">
                              {payload[0].payload.name}
                            </p>
                            <p className="text-gray-600">
                              {categoryLabel}: {payload[0].payload.category} · <strong>{payload[0].value}</strong>
                            </p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {topData.map((_, i) => (
                        <Cell key={i} fill={color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-12">
                No data for {metric}.
              </p>
            )}
          </div>
        )
      })}
      <ImageLightboxModal
        src={lightbox.src}
        alt={lightbox.alt}
        isOpen={lightbox.isOpen}
        onClose={handleLightboxClose}
      />
    </motion.div>
  )
}
