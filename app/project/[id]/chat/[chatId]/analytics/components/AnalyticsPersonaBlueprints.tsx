"use client"

import React, { useMemo, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { ClipboardList, CheckCircle2, XCircle, User } from "lucide-react"
import {
  getAvailableSegmentTypes,
  getPersonas,
  getPersonaBlueprint,
  getPersonaBlueprints,
  type StudyType,
  type PersonaBlueprint,
  type BlueprintMetric,
} from "@/lib/utils/personaBlueprints"
import { getElementImageUrl } from "@/lib/utils/analysisDashboard"
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal"

interface AnalyticsPersonaBlueprintsProps {
  analysisData: any
  studyType?: StudyType
}

const STUDY_TYPE_LABELS: Record<StudyType, string> = {
  text: "Narrative elements (hooks, characters, conflict)",
  grid: "Grid elements & categories",
  layer: "Layers & assets",
  hybrid: "Grid + copy per phase",
}

const METRIC_OPTIONS: { value: BlueprintMetric; label: string }[] = [
  { value: "Top Down", label: "Top Down" },
  { value: "Bottom Up", label: "Bottom Up" },
  { value: "Response Time", label: "Response Time" },
]

export function AnalyticsPersonaBlueprints({
  analysisData,
  studyType = "text",
}: AnalyticsPersonaBlueprintsProps) {
  const segmentTypes = useMemo(
    () => getAvailableSegmentTypes(analysisData || {}),
    [analysisData]
  )
  const [activeMetric, setActiveMetric] = useState<BlueprintMetric>("Top Down")
  const [selectedSegmentType, setSelectedSegmentType] = useState<string>(
    segmentTypes[0] || ""
  )
  const personas = useMemo(
    () =>
      getPersonas(analysisData || {}, selectedSegmentType, activeMetric),
    [analysisData, selectedSegmentType, activeMetric]
  )
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("")
  const activePersona =
    personas.find((p) => p.id === selectedPersonaId) ?? personas[0] ?? null

  const blueprint: PersonaBlueprint | null = useMemo(() => {
    if (!analysisData || !activePersona) return null
    return getPersonaBlueprint(analysisData, activePersona, studyType, {
      topN: 8,
      bottomN: 4,
      metric: activeMetric,
    })
  }, [analysisData, activePersona, studyType, activeMetric])

  const allBlueprints = useMemo(() => {
    if (!analysisData || !selectedSegmentType) return []
    return getPersonaBlueprints(
      analysisData,
      selectedSegmentType,
      studyType,
      { topN: 8, bottomN: 4, metric: activeMetric }
    )
  }, [analysisData, selectedSegmentType, studyType, activeMetric])

  const [lightbox, setLightbox] = useState<{ isOpen: boolean; src: string | null; alt: string }>({
    isOpen: false,
    src: null,
    alt: "",
  })
  const openLightbox = useCallback((src: string, alt: string) => {
    setLightbox({ isOpen: true, src, alt })
  }, [])
  const closeLightbox = useCallback(() => {
    setLightbox((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const getImageUrl = useCallback(
    (category: string, name: string) => getElementImageUrl(analysisData || {}, category, name),
    [analysisData]
  )

  if (segmentTypes.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
    >
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-1.5 rounded-full bg-[#2674BA]" />
          <h2 className="text-xl font-bold text-gray-800" style={{ color: "#2674BA" }}>
            Persona product blueprints
          </h2>
        </div>
        <p className="text-sm text-gray-500 mt-1 ml-5">
          Winning elements per segment. Use for {STUDY_TYPE_LABELS[studyType]}.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Metric
            </label>
            <div className="flex flex-wrap gap-3">
              {METRIC_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActiveMetric(opt.value)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeMetric === opt.value
                      ? "bg-[#2674BA] text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="flex-1 space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Segment type
              </label>
              <select
                value={selectedSegmentType}
                onChange={(e) => {
                  setSelectedSegmentType(e.target.value)
                  setSelectedPersonaId("")
                }}
                className="w-full max-w-xs px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2674BA]/30 focus:border-[#2674BA]"
              >
                {segmentTypes.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Persona
              </label>
              <select
                value={selectedPersonaId || (personas[0]?.id ?? "")}
                onChange={(e) => setSelectedPersonaId(e.target.value)}
                className="w-full max-w-md px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#2674BA]/30 focus:border-[#2674BA]"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {blueprint && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div
              className="px-6 py-4 border-b border-gray-100 flex items-center gap-3"
              style={{ backgroundColor: "rgba(38, 116, 186, 0.06)" }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#2674BA]/10">
                <User className="w-5 h-5" style={{ color: "#2674BA" }} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  {blueprint.persona.label}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Use these elements for this persona · {activeMetric}
                </p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 @5xl/analytics:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Use / emphasize
                  </h4>
                </div>
                <ul className="space-y-3">
                  {blueprint.use.map((el, i) => {
                    const imageUrl = getImageUrl(el.category, el.name)
                    const hasLink = !!imageUrl && imageUrl.startsWith("http")
                    return (
                      <li
                        key={`${el.category}-${el.name}-${i}`}
                        className="flex gap-3 items-start text-sm"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                          {el.priority ?? i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-800 leading-snug">
                            {hasLink ? (
                              <button
                                type="button"
                                onClick={() => openLightbox(imageUrl, el.name)}
                                className="underline cursor-pointer text-left hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#2674BA]/30 rounded"
                                style={{ color: "#2674BA" }}
                              >
                                {el.name}
                              </button>
                            ) : (
                              el.name
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {studyType === "layer" ? `Layer: ${el.category}` : el.category}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-medium text-gray-500 tabular-nums">
                          {el.value}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-amber-600" />
                  <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Avoid / de‑emphasize
                  </h4>
                </div>
                <ul className="space-y-3">
                  {blueprint.avoid.map((el, i) => {
                    const imageUrl = getImageUrl(el.category, el.name)
                    const hasLink = !!imageUrl && imageUrl.startsWith("http")
                    return (
                      <li
                        key={`avoid-${el.category}-${el.name}-${i}`}
                        className="flex gap-3 items-start text-sm"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                          –
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-700 leading-snug">
                            {hasLink ? (
                              <button
                                type="button"
                                onClick={() => openLightbox(imageUrl, el.name)}
                                className="underline cursor-pointer text-left hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#2674BA]/30 rounded"
                                style={{ color: "#2674BA" }}
                              >
                                {el.name}
                              </button>
                            ) : (
                              el.name
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {studyType === "layer" ? `Layer: ${el.category}` : el.category}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-medium text-gray-500 tabular-nums">
                          {el.value}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>

          {allBlueprints.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-gray-500" />
                <h4 className="text-sm font-bold text-gray-700">
                  All personas in {selectedSegmentType}
                </h4>
              </div>
              <div className="flex flex-wrap gap-3">
                {allBlueprints.map((bp) => (
                  <button
                    key={bp.persona.id}
                    type="button"
                    onClick={() => setSelectedPersonaId(bp.persona.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activePersona?.id === bp.persona.id
                        ? "bg-[#2674BA] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {bp.persona.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!blueprint && personas.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
          No personas available for this segment type.
        </div>
      )}
      {!blueprint && activePersona && personas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
          No blueprint data for this persona.
        </div>
      )}

      <ImageLightboxModal
        src={lightbox.src}
        alt={lightbox.alt}
        isOpen={lightbox.isOpen}
        onClose={closeLightbox}
      />
    </motion.section>
  )
}
