"use client"

import React from "react"
import { motion } from "framer-motion"
import { Users, Clock, Star, Layers } from "lucide-react"
import { getKPIStats } from "@/lib/utils/analysisDashboard"
import { CountUp } from "./CountUp"

const CARD_COLORS = ["#2674BA", "#22C55E", "#F7945A", "#FCCD5B"]

interface AnalyticsKPICardsProps {
  analysisData: any
  rawDataOverride?: any[]
  studyType?: string
}

export function AnalyticsKPICards({ analysisData, rawDataOverride, studyType }: AnalyticsKPICardsProps) {
  const stats = getKPIStats(analysisData || {}, rawDataOverride)
  const isLayerStudy = (studyType || "").toLowerCase() === "layer"

  const cards = [
    {
      title: "Total Respondents",
      value: stats.totalRespondents,
      numeric: stats.totalRespondents,
      suffix: "",
      decimals: 0,
      icon: Users,
      color: CARD_COLORS[0],
    },
    {
      title: "Avg Response Time(Tasks)",
      value: stats.avgResponseTime > 0 ? `${(stats.avgResponseTime * 1000).toFixed(0)}ms` : "-",
      numeric: stats.avgResponseTime > 0 ? stats.avgResponseTime * 1000 : 0,
      suffix: "ms",
      decimals: 0,
      icon: Clock,
      color: CARD_COLORS[1],
    },
    {
      title: "Avg Rating",
      value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "-",
      numeric: stats.avgRating > 0 ? stats.avgRating : 0,
      suffix: "",
      decimals: 1,
      icon: Star,
      color: CARD_COLORS[2],
    },
    {
      title: isLayerStudy ? "Layers" : "Categories",
      value: stats.categoryCount,
      numeric: stats.categoryCount,
      suffix: "",
      decimals: 0,
      icon: Layers,
      color: CARD_COLORS[3],
    },
  ]

  return (
    <div className="grid grid-cols-1 @3xl/analytics:grid-cols-2 @6xl/analytics:grid-cols-4 gap-4 mb-8">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
          whileHover={{ y: -4, boxShadow: "0 12px 40px -12px rgba(0,0,0,0.15)" }}
          className="flex min-h-[7.5rem] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
        >
          <div className="flex flex-1 items-start justify-between p-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {card.value === "-" ? (
                  card.value
                ) : (
                  <CountUp
                    value={card.numeric}
                    decimals={card.decimals}
                    suffix={card.suffix}
                  />
                )}
              </p>
            </div>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${card.color}20`, color: card.color }}
            >
              <card.icon className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-auto h-1 w-full shrink-0" style={{ backgroundColor: `${card.color}40` }} />
        </motion.div>
      ))}
    </div>
  )
}
