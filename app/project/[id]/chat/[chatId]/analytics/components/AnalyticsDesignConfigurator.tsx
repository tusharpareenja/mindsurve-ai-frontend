"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { CheckCircle2, ChevronDown, Download, Eye, FileCode2, GitCompare, ImageIcon, Loader2, RotateCcw, Save, Sparkles, Trash2, Type, X } from "lucide-react"
import { renderLayersToCanvas } from "@/lib/canvas-export"
import {
  compareSavedDesigns,
  createSavedDesign,
  deleteSavedDesign,
  listSavedDesigns,
  SavedDesignConfigurationPayload,
  SavedDesignPayload,
  SavedDesignType,
  StudyType,
} from "@/lib/api/StudyAPI"
import {
  compareLocalSavedDesigns,
  createLocalDesignId,
  createLocalSavedDesign,
  deleteLocalSavedDesign,
  listLocalSavedDesigns,
  type LocalSavedDesignsStore,
} from "@/lib/export/savedDesignLocalStorage"
import type { ApiDesignConstraint } from "@/lib/utils/designConstraintsStorage"
import { imageCacheManager } from "@/lib/utils/imageCacheManager"
import {
  collectConfiguratorDisplayUrls,
  CONFIGURATOR_PRELOAD_BATCH_SIZE,
  CONFIGURATOR_PREVIEW_PRELOAD_BATCH_SIZE,
  getConfiguratorExportProxyUrl,
  getConfiguratorResponsivePreviewUrl,
  getConfiguratorThumbnailUrl,
} from "@/lib/utils/configuratorImageUrls"

type Metric = "Top Down" | "Bottom Up" | "Response Time"

type ConfiguratorElement = {
  id: string
  name: string
  category: string
  categoryKey: string
  layerId?: string
  imageId?: string
  value: number
  imageUrl?: string | null
  content?: string | null
  elementType?: string
  zIndex: number
  transform?: { x: number; y: number; width: number; height: number }
}

type ConfiguratorCategory = {
  key: string
  name: string
  code?: string
  zIndex: number
  elements: ConfiguratorElement[]
}

type SegmentOption = {
  id: string
  label: string
  sectionKey: string
  valueKey?: string
}

type InputInsightRow = {
  segment_id: string
  label: string
  value: number
}

const METRIC_OPTIONS: { value: Metric; label: string; description: string }[] = [
  { value: "Top Down", label: "Top Down", description: "Conscious preference" },
  { value: "Bottom Up", label: "Bottom Up", description: "Implicit lift" },
  { value: "Response Time", label: "Response Time", description: "Decision speed" },
]

const METRIC_KEYS: Record<Metric, string> = {
  "Top Down": "(T) Overall",
  "Bottom Up": "(B) Overall",
  "Response Time": "(R) Overall",
}

const METRIC_PREFIX: Record<Metric, string> = {
  "Top Down": "(T)",
  "Bottom Up": "(B)",
  "Response Time": "(R)",
}

const MAX_NON_LAYER_SELECTIONS = 4
const AGE_SEGMENTS = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]

function safeFileName(value: string, fallback = "download"): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback
}

function getProxiedImageUrl(url: string): string {
  return getConfiguratorExportProxyUrl(url)
}

function getExtensionFromType(contentType: string | null): string {
  if (!contentType) return "png"
  if (contentType.includes("jpeg")) return "jpg"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("gif")) return "gif"
  if (contentType.includes("svg")) return "svg"
  return "png"
}

function triggerDownload(url: string, fileName: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function downloadCanvas(canvas: HTMLCanvasElement, fileName: string) {
  const dataUrl = canvas.toDataURL("image/png")
  triggerDownload(dataUrl, fileName)
}

function getCanvasAspect(aspectRatio: string): "portrait" | "landscape" | "square" {
  if (aspectRatio === "16 / 9") return "landscape"
  if (aspectRatio === "1 / 1") return "square"
  return "portrait"
}

function loadImageForCanvas(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    image.src = getProxiedImageUrl(url)
  })
}

async function getCanvasBackgroundRect(
  canvas: HTMLCanvasElement,
  backgroundUrl: string | null
): Promise<{ x: number; y: number; width: number; height: number }> {
  const rect = { x: 0, y: 0, width: canvas.width, height: canvas.height }
  if (!backgroundUrl) return rect

  try {
    const background = await loadImageForCanvas(backgroundUrl)
    const imageAspect = background.width / background.height
    const canvasAspect = canvas.width / canvas.height

    if (imageAspect > canvasAspect) {
      rect.width = canvas.width
      rect.height = canvas.width / imageAspect
      rect.y = (canvas.height - rect.height) / 2
    } else {
      rect.height = canvas.height
      rect.width = canvas.height * imageAspect
      rect.x = (canvas.width - rect.width) / 2
    }
  } catch (error) {
    console.warn("Failed to measure background for text layer export", error)
  }

  return rect
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next
    } else {
      lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.slice(0, 4)
}

async function drawTextElementsOnLayerCanvas(
  canvas: HTMLCanvasElement,
  elements: ConfiguratorElement[],
  backgroundUrl: string | null
) {
  if (elements.length === 0) return

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const backgroundRect = await getCanvasBackgroundRect(canvas, backgroundUrl)
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex)

  for (const element of sorted) {
    const transform = element.transform || { x: 0, y: 0, width: 100, height: 100 }
    const widthPct = Math.max(1, Math.min(100, transform.width))
    const heightPct = Math.max(1, Math.min(100, transform.height))
    const leftPct = Math.max(0, Math.min(100 - widthPct, transform.x))
    const topPct = Math.max(0, Math.min(100 - heightPct, transform.y))
    const x = backgroundRect.x + (leftPct / 100) * backgroundRect.width
    const y = backgroundRect.y + (topPct / 100) * backgroundRect.height
    const width = (widthPct / 100) * backgroundRect.width
    const height = (heightPct / 100) * backgroundRect.height
    const fontSize = Math.max(18, Math.min(44, Math.round(height * 0.18)))
    const lineHeight = fontSize * 1.25
    const label = element.content || element.name

    ctx.save()
    drawRoundedRect(ctx, x, y, width, height, Math.max(10, Math.min(width, height) * 0.08))
    ctx.fillStyle = "rgba(255,255,255,0.82)"
    ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,0.7)"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = `700 ${fontSize}px Arial, sans-serif`
    ctx.fillStyle = "#374151"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    const lines = wrapCanvasText(ctx, label, Math.max(10, width - 24))
    const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2
    lines.forEach((line, index) => {
      ctx.fillText(line, x + width / 2, startY + index * lineHeight)
    })
    ctx.restore()
  }
}

async function renderLayerSelectionToCanvas(
  selectedElements: ConfiguratorElement[],
  backgroundUrl: string | null,
  aspectRatio: string
): Promise<HTMLCanvasElement> {
  const canvas = await renderLayersToCanvas(
    backgroundUrl ? { secureUrl: backgroundUrl, previewUrl: backgroundUrl } : null,
    selectedElements
      .filter((element) => element.imageUrl)
      .map((element) => {
        const transform = element.transform || { x: 0, y: 0, width: 100, height: 100 }
        return {
          id: element.id,
          name: element.name,
          z: element.zIndex,
          transform,
          images: [
            {
              id: element.id,
              previewUrl: element.imageUrl || "",
              secureUrl: element.imageUrl || "",
              x: transform.x,
              y: transform.y,
              width: transform.width,
              height: transform.height,
            },
          ],
        }
      }),
    Object.fromEntries(selectedElements.map((element) => [element.id, element.id])),
    getCanvasAspect(aspectRatio)
  )

  await drawTextElementsOnLayerCanvas(
    canvas,
    selectedElements.filter((element) => !element.imageUrl || element.elementType?.toLowerCase() === "text"),
    backgroundUrl
  )

  return canvas
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isImageUrl(value: unknown): value is string {
  return typeof value === "string" && (/^https?:\/\//i.test(value) || /^data:image\//i.test(value))
}

function getBackgroundUrl(analysisData: any): string | null {
  const info = analysisData?.["Information Block"] || {}
  const candidates = [
    info["Study Background"],
    info.background_image_url,
    info.Background,
    info.metadata?.background_image_url,
    analysisData?.background_image_url,
    analysisData?.metadata?.background_image_url,
  ]
  return candidates.find(isImageUrl) || null
}

function getLayerAspectRatio(analysisData: any): string {
  const info = analysisData?.["Information Block"] || {}
  const frontPage = analysisData?.["Front Page"] || {}
  const raw = normalizeText(info["Aspect Ratio"] ?? info.aspect_ratio ?? frontPage["Aspect Ratio"] ?? frontPage.aspect_ratio)
    .toLowerCase()

  if (raw === "landscape" || raw === "16:9") return "16 / 9"
  if (raw === "square" || raw === "1:1") return "1 / 1"
  if (raw === "portrait" || raw === "9:16") return "9 / 16"

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/)
  if (match) return `${match[1]} / ${match[2]}`

  return "9 / 16"
}

function getElementKey(category: string, elementName: string): string {
  return `${category}::${elementName}`
}

function getLayerId(category: any): string | undefined {
  const value = normalizeText(
    category?.layer_id ??
      category?.layerId ??
      category?.id ??
      category?.category_id ??
      category?.categoryId
  )
  return value || undefined
}

function getImageId(element: any): string | undefined {
  const value = normalizeText(
    element?.image_id ??
      element?.imageId ??
      element?.id ??
      element?.element_id ??
      element?.elementId
  )
  return value || undefined
}

function getSegmentId(sectionKey: string, valueKey?: string): string {
  return valueKey ? `${sectionKey}::${valueKey}` : sectionKey
}

function formatSegmentLabel(valueKey: string): string {
  const mindsetMatch = valueKey.match(/^Mindset_(\d+)_of_\d+$/)
  if (mindsetMatch) return `Mindset ${mindsetMatch[1]}`
  return valueKey.replace(/_/g, " ")
}

function addSegmentOption(options: SegmentOption[], option: Omit<SegmentOption, "id">) {
  const id = getSegmentId(option.sectionKey, option.valueKey)
  if (options.some((existing) => existing.id === id || existing.label === option.label)) return
  options.push({ ...option, id })
}

function getAvailableSegmentOptions(analysisData: any, metric: Metric): SegmentOption[] {
  const prefix = METRIC_PREFIX[metric]
  const options: SegmentOption[] = []

  addSegmentOption(options, {
    label: "Overall",
    sectionKey: `${prefix} Overall`,
  })

  const genderSection = analysisData?.[`${prefix} Gender`]
  for (const key of Object.keys(genderSection?.segments || {})) {
    addSegmentOption(options, {
      label: key,
      sectionKey: `${prefix} Gender`,
      valueKey: key,
    })
  }

  const ageSection = analysisData?.[`${prefix} Age`]
  const ageKeys = Array.from(new Set([...AGE_SEGMENTS, ...Object.keys(ageSection?.segments || {})])).sort((a, b) => {
    const aNum = Number.parseInt(a, 10)
    const bNum = Number.parseInt(b, 10)
    if (Number.isNaN(aNum) || Number.isNaN(bNum)) return a.localeCompare(b)
    return aNum - bNum
  })
  if (ageSection) {
    for (const key of ageKeys) {
      addSegmentOption(options, {
        label: key,
        sectionKey: `${prefix} Age`,
        valueKey: key,
      })
    }
  }

  const mindsetSection = analysisData?.[`${prefix} Mindsets`]
  const mindsetGroup = mindsetSection?.groups?.Mindset_3 || mindsetSection?.groups?.Mindset_2 || {}
  const mindsetKeys = Object.keys(mindsetGroup).sort()
  for (const key of mindsetKeys) {
    addSegmentOption(options, {
      label: formatSegmentLabel(key),
      sectionKey: `${prefix} Mindsets`,
      valueKey: key,
    })
  }

  return options
}

function getInfoCategories(analysisData: any): any[] {
  const info = analysisData?.["Information Block"] || {}
  const candidates = [
    info.Categories,
    info.categories,
    info.Layers,
    info.layers,
    info["Study Layers"],
    info.study_layers,
    analysisData?.study_layers,
  ]
  const match = candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0)
  return Array.isArray(match) ? match : []
}

function getRawElements(category: any): any[] {
  const candidates = [
    category?.elements,
    category?.Elements,
    category?.images,
    category?.Images,
    category?.options,
  ]
  const match = candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0)
  return Array.isArray(match) ? match : []
}

function pickElementImage(element: any): string | null {
  const candidates = [
    element?.content,
    element?.url,
    element?.imageUrl,
    element?.image_url,
    element?.imageLink,
    element?.image_link,
    element?.image,
    element?.secureUrl,
    element?.previewUrl,
  ]
  return candidates.find(isImageUrl) || null
}

function pickTransform(element: any): ConfiguratorElement["transform"] | undefined {
  const transform = element?.transform || element?.position || element?.metadata?.transform
  if (!transform || typeof transform !== "object") return undefined
  return {
    x: toNumber(transform.x, 0),
    y: toNumber(transform.y, 0),
    width: toNumber(transform.width, 100),
    height: toNumber(transform.height, 100),
  }
}

function getScoreMap(analysisData: any, metric: Metric, segment: SegmentOption): Map<string, { value: number; code?: string }> {
  const section = analysisData?.[segment?.sectionKey || METRIC_KEYS[metric]]
  const scoreMap = new Map<string, { value: number; code?: string }>()

  for (const category of section?.categories || []) {
    const categoryName = normalizeText(category?.name)
    for (const element of category?.elements || []) {
      const name = normalizeText(element?.name)
      if (!categoryName || !name) continue
      scoreMap.set(getElementKey(categoryName, name), {
        value: segment?.valueKey ? toNumber(element?.values?.[segment.valueKey], 0) : toNumber(element?.value, 0),
        code: normalizeText(element?.code) || undefined,
      })
    }
  }

  return scoreMap
}

function getCategoryIdentity(category: any, categoryName: string, categoryIndex: number): string {
  const explicitId = normalizeText(
    category?.category_id ??
      category?.categoryId ??
      category?.id ??
      category?.layer_id ??
      category?.layerId ??
      category?.code
  )
  const phaseType = normalizeText(
    category?.phase_type ??
      category?.phaseType ??
      category?.study_type ??
      category?.studyType ??
      category?.type ??
      category?.mode
  )
  const prefix = [phaseType, explicitId].filter(Boolean).join("::")
  return [prefix || `idx-${categoryIndex}`, categoryName].join("::")
}

function getCategoriesForMetric(analysisData: any, metric: Metric, segment: SegmentOption): ConfiguratorCategory[] {
  const infoCategories = getInfoCategories(analysisData)
  const scoreMap = getScoreMap(analysisData, metric, segment)

  if (!Array.isArray(infoCategories) || infoCategories.length === 0) {
    const section = analysisData?.[segment?.sectionKey || METRIC_KEYS[metric]]
    return (section?.categories || [])
      .map((category: any, categoryIndex: number) => {
        const categoryName = normalizeText(category?.name) || `Category ${categoryIndex + 1}`
        const categoryKey = getCategoryIdentity(category, categoryName, categoryIndex)
        const layerId = getLayerId(category)
        const zIndex = toNumber(category?.z_index ?? category?.z ?? categoryIndex + 1, categoryIndex + 1)
      const elements = getRawElements(category).map((element: any, elementIndex: number) => ({
          id: getElementKey(categoryKey, normalizeText(element?.name) || `Element ${elementIndex + 1}`),
          name: normalizeText(element?.name) || `Element ${elementIndex + 1}`,
          category: categoryName,
          categoryKey,
          layerId,
          imageId: getImageId(element),
          value: segment?.valueKey ? toNumber(element?.values?.[segment.valueKey], 0) : toNumber(element?.value, 0),
          imageUrl: pickElementImage(element),
          content: normalizeText(element?.content) || null,
          elementType: normalizeText(element?.element_type ?? element?.elementType),
          zIndex,
          transform: pickTransform(element),
        }))

        return { key: categoryKey, name: categoryName, code: normalizeText(category?.code) || undefined, zIndex, elements }
      })
      .filter((category: ConfiguratorCategory) => category.elements.length > 0)
  }

  return infoCategories
    .map((category: any, categoryIndex: number) => {
      const categoryName = normalizeText(category?.name) || normalizeText(category?.title) || `Category ${categoryIndex + 1}`
      const categoryKey = getCategoryIdentity(category, categoryName, categoryIndex)
      const layerId = getLayerId(category)
      const zIndex = toNumber(category?.z_index ?? category?.z ?? categoryIndex + 1, categoryIndex + 1)
      const elements = getRawElements(category).map((element: any, elementIndex: number) => {
        const name = normalizeText(element?.name) || normalizeText(element?.alt_text) || `Element ${elementIndex + 1}`
        const score = scoreMap.get(getElementKey(categoryName, name))
        const elementType = normalizeText(element?.element_type ?? element?.elementType)
        const imageUrl = elementType.toLowerCase() === "text" ? null : pickElementImage(element)

        return {
          id: getElementKey(categoryKey, name),
          name,
          category: categoryName,
          categoryKey,
          layerId,
          imageId: getImageId(element),
          value: score?.value ?? 0,
          imageUrl,
          content: normalizeText(element?.content) || null,
          elementType,
          zIndex: toNumber(element?.z_index ?? element?.z ?? category?.z_index ?? category?.z ?? zIndex, zIndex),
          transform: pickTransform(element),
        }
      })

      return {
        key: categoryKey,
        name: categoryName,
        code: normalizeText(category?.code) || undefined,
        zIndex,
        elements,
      }
    })
    .filter((category: ConfiguratorCategory) => category.elements.length > 0)
}

function buildDefaultSelection(categories: ConfiguratorCategory[], isLayerStudy: boolean): Record<string, string> {
  const selected: Record<string, string> = {}
  const rankedCategories = [...categories]
    .map((category) => ({
      category,
      best: [...category.elements].sort((a, b) => b.value - a.value)[0],
    }))
    .filter((item) => item.best)
    .sort((a, b) => {
      if (isLayerStudy) return a.category.zIndex - b.category.zIndex
      return b.best.value - a.best.value
    })

  const limit = isLayerStudy ? rankedCategories.length : MAX_NON_LAYER_SELECTIONS
  rankedCategories.slice(0, limit).forEach(({ category, best }) => {
    selected[category.key] = best.id
  })

  return selected
}

function constraintRefKey(ref: { layer_id?: string; image_id?: string; layerId?: string; imageId?: string }): string | null {
  const layerId = normalizeText(ref.layer_id ?? ref.layerId)
  const imageId = normalizeText(ref.image_id ?? ref.imageId)
  return layerId && imageId ? `${layerId}::${imageId}` : null
}

function elementConstraintKey(element: ConfiguratorElement): string | null {
  return element.layerId && element.imageId ? `${element.layerId}::${element.imageId}` : null
}

function buildConflictPairSet(designConstraints: ApiDesignConstraint[]): Set<string> {
  const pairs = new Set<string>()
  designConstraints.forEach((constraint) => {
    const anchors = Array.isArray(constraint.anchors) ? constraint.anchors : []
    const blocked = Array.isArray(constraint.blocked) ? constraint.blocked : []
    anchors.forEach((anchor) => {
      const anchorKey = constraintRefKey(anchor)
      if (!anchorKey) return
      blocked.forEach((blockedRef) => {
        const blockedKey = constraintRefKey(blockedRef)
        if (!blockedKey || blockedKey === anchorKey) return
        pairs.add(`${anchorKey}|${blockedKey}`)
        pairs.add(`${blockedKey}|${anchorKey}`)
      })
    })
  })
  return pairs
}

function conflictsWithSelected(
  element: ConfiguratorElement,
  selectedElements: ConfiguratorElement[],
  conflictPairs: Set<string>
): boolean {
  const elementKey = elementConstraintKey(element)
  if (!elementKey) return false
  return selectedElements.some((selected) => {
    const selectedKey = elementConstraintKey(selected)
    return Boolean(selectedKey && conflictPairs.has(`${elementKey}|${selectedKey}`))
  })
}

function buildConstraintAwareLayerBestMix(
  categories: ConfiguratorCategory[],
  designConstraints: ApiDesignConstraint[]
): Record<string, string> | null {
  const conflictPairs = buildConflictPairSet(designConstraints)
  if (conflictPairs.size === 0) {
    return buildDefaultSelection(categories, true)
  }

  const conflictDegree = (category: ConfiguratorCategory) =>
    category.elements.reduce((count, element) => {
      const key = elementConstraintKey(element)
      if (!key) return count
      for (const pair of conflictPairs) {
        if (pair.startsWith(`${key}|`)) count += 1
      }
      return count
    }, 0)

  const layerCategories = [...categories]
    .filter((category) => category.elements.length > 0)
    .sort((a, b) => {
      const degreeDelta = conflictDegree(b) - conflictDegree(a)
      if (degreeDelta !== 0) return degreeDelta
      const sizeDelta = a.elements.length - b.elements.length
      if (sizeDelta !== 0) return sizeDelta
      return a.zIndex - b.zIndex
    })
    .map((category) => ({
      category,
      elements: [...category.elements].sort((a, b) => b.value - a.value),
    }))

  if (layerCategories.length === 0) return {}

  const suffixBest = new Array(layerCategories.length + 1).fill(0)
  for (let idx = layerCategories.length - 1; idx >= 0; idx -= 1) {
    suffixBest[idx] = suffixBest[idx + 1] + Math.max(0, layerCategories[idx].elements[0]?.value ?? 0)
  }

  let bestScore = 0
  let bestSelection: Record<string, string> = {}

  const search = (
    index: number,
    selectedElements: ConfiguratorElement[],
    selectedByCategory: Record<string, string>,
    score: number
  ) => {
    if (score + suffixBest[index] <= bestScore) return

    if (index === layerCategories.length) {
      bestScore = score
      bestSelection = { ...selectedByCategory }
      return
    }

    const { category, elements } = layerCategories[index]
    search(index + 1, selectedElements, selectedByCategory, score)
    for (const element of elements) {
      if (conflictsWithSelected(element, selectedElements, conflictPairs)) continue
      selectedByCategory[category.key] = element.id
      selectedElements.push(element)
      search(index + 1, selectedElements, selectedByCategory, score + element.value)
      selectedElements.pop()
      delete selectedByCategory[category.key]
    }
  }

  search(0, [], {}, 0)
  return bestSelection
}

function normalizeLookupKey(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

function enrichLayerCategoriesWithIds(
  categories: ConfiguratorCategory[],
  studyLayers: any[] | undefined
): ConfiguratorCategory[] {
  if (!Array.isArray(studyLayers) || studyLayers.length === 0) return categories

  const layerByName = new Map<string, any>()
  studyLayers.forEach((layer) => {
    const nameKey = normalizeLookupKey(layer?.name || layer?.title)
    if (nameKey && !layerByName.has(nameKey)) layerByName.set(nameKey, layer)
  })

  return categories.map((category) => {
    const matchedLayer = layerByName.get(normalizeLookupKey(category.name))
    if (!matchedLayer) return category

    const layerId = normalizeText(matchedLayer.layer_id ?? matchedLayer.layerId ?? matchedLayer.id) || undefined
    const imageByName = new Map<string, any>()
    ;(Array.isArray(matchedLayer.images) ? matchedLayer.images : []).forEach((image: any) => {
      const nameKey = normalizeLookupKey(image?.name || image?.alt_text)
      if (nameKey && !imageByName.has(nameKey)) imageByName.set(nameKey, image)
    })

    return {
      ...category,
      elements: category.elements.map((element) => {
        if (element.layerId && element.imageId) return element
        const matchedImage = imageByName.get(normalizeLookupKey(element.name))
        if (!matchedImage) return { ...element, layerId: element.layerId || layerId }
        return {
          ...element,
          layerId: element.layerId || layerId,
          imageId: element.imageId || normalizeText(matchedImage.image_id ?? matchedImage.imageId ?? matchedImage.id) || undefined,
        }
      }),
    }
  })
}

function buildInputDesignInsights(
  analysisData: any,
  selectedByCategory: Record<string, string>
): Record<Metric, InputInsightRow[]> {
  return METRIC_OPTIONS.reduce<Record<Metric, InputInsightRow[]>>((next, metric) => {
    const segments = getAvailableSegmentOptions(analysisData || {}, metric.value)
    next[metric.value] = segments.map((segment) => {
      const categories = getCategoriesForMetric(analysisData || {}, metric.value, segment)
      const value = categories.reduce((sum, category) => {
        const selectedId = selectedByCategory[category.key]
        const element = category.elements.find((candidate) => candidate.id === selectedId)
        return sum + (element?.value || 0)
      }, 0)
      return {
        segment_id: segment.id,
        label: segment.label,
        value,
      }
    })
    return next
  }, {} as Record<Metric, InputInsightRow[]>)
}

function formatValue(value: number, metric: Metric): string {
  if (!Number.isFinite(value)) return "0"
  if (metric === "Response Time") return Math.abs(value) < 1 ? value.toFixed(3) : value.toFixed(1)
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function BodyPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === "undefined") return null
  return createPortal(children, document.body)
}

function PreviewFullscreenModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <BodyPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Full screen preview"
        className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-8"
      >
        <div className="absolute inset-0 bg-black" aria-hidden="true" onClick={onClose} />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Close preview"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="relative z-10 flex w-full max-w-6xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
          {children}
        </div>
      </div>
    </BodyPortal>
  )
}

/**
 * Paints an already-cached low-res thumbnail instantly, then fades in the
 * device-sized high-quality preview once it decodes. This removes the
 * tap-to-preview delay (the thumbnail is served from the browser HTTP cache
 * with no round-trip) while still ending on a crisp, full-quality image.
 *
 * Only the thumbnail (tiny) and one high-res image per *selected* element are
 * ever mounted, so decoded-bitmap memory stays bounded even for studies with
 * hundreds of elements in the picker.
 */
function ProgressiveImage({
  thumbUrl,
  fullUrl,
  alt,
  wrapperClassName,
  wrapperStyle,
  imgClassName,
}: {
  thumbUrl: string
  fullUrl: string
  alt: string
  wrapperClassName?: string
  wrapperStyle?: React.CSSProperties
  imgClassName?: string
}) {
  // If the device-sized preview is already in the HTTP cache (we pre-warm it
  // when the category opens), show it immediately with no placeholder and no
  // fade — that's the "instant, no flicker" path for anything already warmed.
  const initiallyCached = imageCacheManager.isPreloaded(fullUrl)
  const [hiResReady, setHiResReady] = useState(initiallyCached)
  const [usePlaceholder, setUsePlaceholder] = useState(
    !initiallyCached && Boolean(thumbUrl) && thumbUrl !== fullUrl
  )

  useEffect(() => {
    const cached = imageCacheManager.isPreloaded(fullUrl)
    setHiResReady(cached)
    setUsePlaceholder(!cached && Boolean(thumbUrl) && thumbUrl !== fullUrl)
  }, [fullUrl, thumbUrl])

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      {usePlaceholder && (
        // Low-res thumbnail stays mounted *behind* the hi-res image (which
        // covers it once opaque), so there is never an empty frame / flicker
        // during the cross-fade.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          className={`${imgClassName ?? ""} absolute inset-0`}
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fullUrl}
        alt={alt}
        loading="eager"
        decoding="async"
        className={`${imgClassName ?? ""} absolute inset-0`}
        style={{
          opacity: hiResReady ? 1 : 0,
          transition: usePlaceholder ? "opacity 150ms ease-out" : "none",
        }}
        onLoad={() => setHiResReady(true)}
        onError={(event) => {
          event.currentTarget.style.display = "none"
        }}
      />
    </div>
  )
}

function SelectionPreview({
  selectedElements,
  studyType,
  backgroundUrl,
  aspectRatio,
  size = "default",
}: {
  selectedElements: ConfiguratorElement[]
  studyType: string
  backgroundUrl: string | null
  aspectRatio: string
  size?: "default" | "fullscreen"
}) {
  const isLayerStudy = studyType === "layer"
  const isFullscreen = size === "fullscreen"
  const containerRef = useRef<HTMLDivElement>(null)
  const backgroundImgRef = useRef<HTMLImageElement>(null)
  const [layerFit, setLayerFit] = useState({ left: 0, top: 0, width: 0, height: 0 })

  useEffect(() => {
    if (!isLayerStudy) return

    const computeFit = () => {
      const container = containerRef.current
      if (!container) return

      const cw = container.offsetWidth
      const ch = container.offsetHeight
      if (!cw || !ch) return

      const background = backgroundImgRef.current
      if (!backgroundUrl || !background) {
        setLayerFit({ left: 0, top: 0, width: cw, height: ch })
        return
      }

      const iw = background.naturalWidth || cw
      const ih = background.naturalHeight || ch
      const scale = Math.min(cw / iw, ch / ih)
      const width = iw * scale
      const height = ih * scale

      setLayerFit({
        left: (cw - width) / 2,
        top: (ch - height) / 2,
        width,
        height,
      })
    }

    computeFit()
    const resizeObserver = new ResizeObserver(computeFit)
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [aspectRatio, backgroundUrl, isLayerStudy])

  const isLandscape = aspectRatio === "16 / 9"
  // Non-fullscreen preview lives in the sticky sidebar next to the scrolling element
  // list. Cap it relative to the viewport (not a fixed px) so the buttons + preview +
  // total-coefficient block always fits on screen and the action buttons stay pinned.
  const layerMaxHeight = isFullscreen ? "85vh" : isLandscape ? "min(600px, 40vh)" : "min(320px, 34vh)"
  const layerMaxWidth = isFullscreen
    ? isLandscape
      ? "90vw"
      : "min(90vw, 540px)"
    : isLandscape
      ? "100%"
      : "280px"

  if (selectedElements.length === 0 && (!isLayerStudy || !backgroundUrl)) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-center"
        style={{
          aspectRatio: isLayerStudy ? aspectRatio : "1 / 1",
          maxHeight: isLayerStudy ? layerMaxHeight : undefined,
          maxWidth: isLayerStudy ? layerMaxWidth : undefined,
          margin: "0 auto"
        }}
      >
        <div className="px-6">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-blue-300" />
          <p className="text-sm font-medium text-gray-500">Select elements to build your preview</p>
        </div>
      </div>
    )
  }

  if (isLayerStudy) {
    const sorted = [...selectedElements].sort((a, b) => a.zIndex - b.zIndex)
    return (
      <div
        ref={containerRef}
        className="relative mx-auto overflow-hidden bg-transparent"
        style={{
          aspectRatio,
          height: isFullscreen ? layerMaxHeight : undefined,
          maxHeight: layerMaxHeight,
          maxWidth: layerMaxWidth,
          width: isFullscreen ? "auto" : "100%",
        }}
      >
        {backgroundUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={backgroundImgRef}
            src={getConfiguratorResponsivePreviewUrl(backgroundUrl, isFullscreen)}
            alt="Background"
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain"
            style={{ zIndex: 0 }}
            onLoad={() => {
              const container = containerRef.current
              const background = backgroundImgRef.current
              if (!container || !background) return

              const cw = container.offsetWidth
              const ch = container.offsetHeight
              const iw = background.naturalWidth || cw
              const ih = background.naturalHeight || ch
              const scale = Math.min(cw / iw, ch / ih)
              const width = iw * scale
              const height = ih * scale

              setLayerFit({
                left: (cw - width) / 2,
                top: (ch - height) / 2,
                width,
                height,
              })
            }}
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
        )}
        <div
          className="absolute overflow-hidden"
          style={{
            left: backgroundUrl ? layerFit.left : 0,
            top: backgroundUrl ? layerFit.top : 0,
            width: backgroundUrl ? layerFit.width || "100%" : "100%",
            height: backgroundUrl ? layerFit.height || "100%" : "100%",
            zIndex: 1,
          }}
        >
          {sorted.map((element) => {
            const transform = element.transform || { x: 0, y: 0, width: 100, height: 100 }
            const widthPct = Math.max(1, Math.min(100, transform.width))
            const heightPct = Math.max(1, Math.min(100, transform.height))
            const leftPct = Math.max(0, Math.min(100 - widthPct, transform.x))
            const topPct = Math.max(0, Math.min(100 - heightPct, transform.y))
            const useFitPixels = Boolean(backgroundUrl && layerFit.width && layerFit.height)
            const fitWidth = layerFit.width || 1
            const fitHeight = layerFit.height || 1
            const layerStyle = useFitPixels
              ? {
                  top: `${(topPct / 100) * fitHeight}px`,
                  left: `${(leftPct / 100) * fitWidth}px`,
                  width: `${(widthPct / 100) * fitWidth}px`,
                  height: `${(heightPct / 100) * fitHeight}px`,
                }
              : {
                  top: `${topPct}%`,
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                }

            if (!element.imageUrl) {
              return (
                <div
                  key={element.id}
                  className="absolute flex items-center justify-center rounded-lg border border-white/70 bg-white/80 p-2 text-center text-[10px] font-semibold text-gray-700 shadow-sm backdrop-blur-sm sm:p-3 sm:text-xs"
                  style={{
                    zIndex: element.zIndex + 1,
                    ...layerStyle,
                  }}
                >
                  {element.name}
                </div>
              )
            }

            return (
              <ProgressiveImage
                key={element.id}
                thumbUrl={getConfiguratorThumbnailUrl(element.imageUrl)}
                fullUrl={getConfiguratorResponsivePreviewUrl(element.imageUrl, isFullscreen)}
                alt={element.name}
                wrapperClassName="absolute overflow-hidden"
                wrapperStyle={{
                  zIndex: element.zIndex + 1,
                  ...layerStyle,
                }}
                imgClassName="h-full w-full object-contain"
              />
            )
          })}
        </div>
      </div>
    )
  }

  const count = selectedElements.length
  const hasImage = selectedElements.some(e => e.imageUrl && e.elementType?.toLowerCase() !== "text")
  const allText = count > 0 && !hasImage

  if (allText) {
    return (
      <div
        className={`relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 ${
          isFullscreen ? "max-w-[min(90vw,720px)]" : "max-w-[380px]"
        }`}
        style={{ minHeight: isFullscreen ? "min(70vh, 720px)" : "380px" }}
      >
        <div className="flex w-full flex-col items-center justify-center gap-2 h-full flex-1">
          {selectedElements.map((element) => (
            <div
              key={element.id}
              className="w-full flex items-center justify-center text-center px-4 py-3 rounded-xl shadow-sm transition-colors bg-gray-50 border border-gray-100"
              style={{
                height: `${100 / count}%`,
                maxHeight: '120px',
                fontSize: 'clamp(14px, 1.2vw, 20px)',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
            >
              {element.content || element.name}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const gridClass =
    count === 1
      ? "grid-cols-1"
      : count === 2
        ? "grid-cols-2"
        : "grid-cols-2"

  return (
    <div
      className={`relative mx-auto flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 ${
        isFullscreen ? "max-w-[min(90vw,720px)]" : "max-w-[380px]"
      }`}
    >
      {backgroundUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getConfiguratorResponsivePreviewUrl(backgroundUrl, isFullscreen)}
          alt="Background"
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain opacity-10"
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
      )}
      <div className={`relative grid w-full ${gridClass} gap-3 sm:gap-4`}>
        {selectedElements.map((element, index) => {
          const isText = !element.imageUrl || element.elementType?.toLowerCase() === "text"
          return (
            <div
              key={element.id}
              className={`flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4 ${
                count === 3 && index === 2 ? "col-span-2 mx-auto w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)]" : ""
              }`}
            >
              {isText ? (
                <div className="text-center">
                  <Type className="mx-auto mb-1.5 h-5 w-5 text-blue-500 sm:mb-2 sm:h-6 sm:w-6" />
                  <p className="text-xs font-medium leading-snug text-gray-800 sm:text-sm">{element.content || element.name}</p>
                </div>
              ) : (
                <ProgressiveImage
                  thumbUrl={getConfiguratorThumbnailUrl(element.imageUrl)}
                  fullUrl={getConfiguratorResponsivePreviewUrl(element.imageUrl, isFullscreen)}
                  alt={element.name}
                  wrapperClassName="relative h-full w-full"
                  imgClassName="h-full w-full object-contain"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getSavedDesignElements(
  design: SavedDesignPayload,
  mediaLookup?: Record<string, Partial<ConfiguratorElement>>
): ConfiguratorElement[] {
  const elements = design.configuration?.selected_elements || []
  return elements.map((element: any, index: number) => {
    const id = String(element.id || element.element_id || `${design.id}-${index}`)
    const media = mediaLookup?.[id]
    return {
      id,
      name: String(element.name || element.element_name || `Element ${index + 1}`),
      category: String(element.category || "Selection"),
      categoryKey: String(element.categoryKey || element.category_key || element.category || `selection-${index}`),
      layerId: normalizeText(element.layerId ?? element.layer_id ?? media?.layerId) || undefined,
      imageId: normalizeText(element.imageId ?? element.image_id ?? media?.imageId) || undefined,
      value: toNumber(element.value, 0),
      imageUrl: media?.imageUrl ?? element.imageUrl ?? element.image_url ?? null,
      content: media?.content ?? element.content ?? null,
      elementType: media?.elementType ?? element.elementType ?? element.element_type,
      zIndex: toNumber(element.zIndex ?? element.z_index ?? media?.zIndex, index),
      transform: element.transform ?? media?.transform,
    }
  })
}

function SelectionImageLightbox({
  image,
  onClose,
}: {
  image: { url: string; name: string } | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!image) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [image, onClose])

  if (!image) return null

  return (
    <BodyPortal>
      <div role="dialog" aria-modal="true" aria-label={image.name} className="fixed inset-0 z-[230] flex items-center justify-center bg-black p-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close image preview"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="max-h-[86vh] max-w-[92vw] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getConfiguratorResponsivePreviewUrl(image.url, true) || image.url} alt={image.name} className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl" />
          <p className="mt-4 text-sm font-semibold text-white">{image.name}</p>
        </div>
      </div>
    </BodyPortal>
  )
}

function SaveDesignModal({
  isOpen,
  defaultName,
  error,
  isSaving,
  onClose,
  onSave,
}: {
  isOpen: boolean
  defaultName: string
  error: string | null
  isSaving: boolean
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(defaultName)

  useEffect(() => {
    if (isOpen) setName(defaultName)
  }, [defaultName, isOpen])

  if (!isOpen) return null

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
        <div role="dialog" aria-modal="true" aria-label="Save design" className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Save design</h3>
            <p className="mt-1 text-sm text-gray-500">Give this selection a unique name for this study.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close save dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block text-sm font-semibold text-gray-700" htmlFor="saved-design-name">
          Design name
        </label>
        <input
          id="saved-design-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder="Design 1"
          autoFocus
        />
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(name)}
            disabled={isSaving || name.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
      </div>
    </BodyPortal>
  )
}

function SavedDesignComparePanel({
  isOpen,
  savedDesigns,
  selectedIds,
  error,
  isLoading,
  isComparing,
  onClose,
  onToggle,
  onCompare,
  onDelete,
}: {
  isOpen: boolean
  savedDesigns: SavedDesignPayload[]
  selectedIds: string[]
  error: string | null
  isLoading: boolean
  isComparing: boolean
  onClose: () => void
  onToggle: (designId: string) => void
  onCompare: () => void
  onDelete: (designId: string) => void
}) {
  if (!isOpen) return null

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[205]">
        <div className="absolute inset-0 bg-black/30" aria-hidden="true" onClick={onClose} />
        <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Compare saved designs</h3>
            <p className="mt-1 text-sm text-gray-500">Select 2 to 4 designs to compare.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close compare panel">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm font-medium text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading saved designs...
            </div>
          ) : savedDesigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-blue-300" />
              <p className="text-sm font-semibold text-gray-700">No saved designs yet</p>
              <p className="mt-1 text-xs text-gray-500">Save a design first, then return here to compare.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedDesigns.map((design) => {
                const checked = selectedIds.includes(design.id)
                const disabled = !checked && selectedIds.length >= 4
                return (
                  <div key={design.id} className={`rounded-2xl border p-4 transition ${checked ? "border-blue-500 bg-blue-50/60" : "border-gray-200 bg-white"}`}>
                    <label className={`flex cursor-pointer items-start gap-3 ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggle(design.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-gray-900">{design.name}</span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {design.design_type === "input"
                            ? `${design.selection_count} selected`
                            : `${design.metric} · ${design.segment_label || design.configuration?.segment?.label || "Overall"} · ${design.selection_count} selected`}
                        </span>
                      </span>
                    </label>
                    <div className="mt-3 flex items-center justify-between">
                      {design.design_type === "input" ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600">Input Design</span>
                      ) : (
                        <span className="text-sm font-black tabular-nums text-gray-900">
                          {formatValue(design.total_coefficient ?? design.configuration?.total_coefficient ?? 0, design.metric)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(design.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onCompare}
            disabled={isComparing || selectedIds.length < 2 || selectedIds.length > 4}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isComparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
            Compare {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
        </div>
      </aside>
      </div>
    </BodyPortal>
  )
}

function SavedInputDesignInsights({
  design,
  analysisData,
}: {
  design: SavedDesignPayload
  analysisData: any
}) {
  const [metric, setMetric] = useState<Metric>("Top Down")
  const insights = useMemo(() => {
    const stored = design.configuration?.input_insights
    if (stored && Object.keys(stored).length > 0) return stored

    const selectedByCategory = design.configuration?.selected_by_category || {}
    if (analysisData && Object.keys(selectedByCategory).length > 0) {
      return buildInputDesignInsights(analysisData, selectedByCategory)
    }
    return {}
  }, [analysisData, design.configuration?.input_insights, design.configuration?.selected_by_category])
  const rows = insights[metric] || []

  return (
    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/30">
      <div className="flex items-center justify-between gap-3 border-b border-blue-100 p-3">
        <span className="text-sm font-black text-gray-900">Segment Insights</span>
        <div className="relative min-w-[145px]">
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
            className="h-9 w-full appearance-none rounded-xl border border-blue-100 bg-white px-3 pr-8 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto p-3">
        {rows.length === 0 ? (
          <p className="text-xs font-medium text-gray-500">No insight data saved for this design.</p>
        ) : (
          rows.map((row: any) => (
            <div key={`${design.id}-${metric}-${row.segment_id}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
              <span className="min-w-0 truncate text-xs font-semibold text-gray-600">{row.label}</span>
              <span className={`ml-3 tabular-nums text-xs font-black ${row.value >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {row.value >= 0 ? "+" : ""}
                {formatValue(row.value, metric)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SavedDesignCompareOverlay({
  designs,
  analysisData,
  elementMediaLookup,
  onImageOpen,
  onClose,
}: {
  designs: SavedDesignPayload[]
  analysisData: any
  elementMediaLookup?: Record<string, Partial<ConfiguratorElement>>
  onImageOpen: (image: { url: string; name: string }) => void
  onClose: () => void
}) {
  const [previewDesign, setPreviewDesign] = useState<SavedDesignPayload | null>(null)
  const [downloadingDesignId, setDownloadingDesignId] = useState<string | null>(null)
  const [highlightedElementKey, setHighlightedElementKey] = useState<string | null>(null)

  const handleDownloadLayerDesign = async (design: SavedDesignPayload) => {
    if (design.study_type !== "layer" || downloadingDesignId) return

    const elements = getSavedDesignElements(design, elementMediaLookup)
    const backgroundUrl = design.configuration?.show_layer_background
      ? design.configuration?.background_url || getBackgroundUrl(analysisData)
      : null
    setDownloadingDesignId(design.id)
    try {
      const canvas = await renderLayerSelectionToCanvas(elements, backgroundUrl, design.configuration?.aspect_ratio || "9 / 16")
      downloadCanvas(canvas, `${safeFileName(design.name, "saved-design")}.png`)
    } catch (error) {
      console.error("Saved design download failed", error)
      alert("Failed to download this saved design. Please try again.")
    } finally {
      setDownloadingDesignId(null)
    }
  }

  if (designs.length === 0) return null

  const previewElements = previewDesign ? getSavedDesignElements(previewDesign, elementMediaLookup) : []
  const previewIsLayer = previewDesign?.study_type === "layer"

  return (
    <BodyPortal>
      <div role="dialog" aria-modal="true" aria-label="Saved design comparison" className="fixed inset-0 z-[220] overflow-y-auto bg-black p-4 text-white sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="fixed right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close comparison"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="mx-auto max-w-7xl pb-10 pt-10">
        <div className="mb-6">
          <h3 className="text-2xl font-black">Saved design comparison</h3>
          <p className="mt-1 text-sm text-white/60">Showing {designs.length} saved designs side by side.</p>
        </div>
        <div className={`grid gap-5 ${designs.length === 2 ? "lg:grid-cols-2" : designs.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {designs.map((design) => {
            const elements = getSavedDesignElements(design, elementMediaLookup)
            const isLayer = design.study_type === "layer"
            const compareBackgroundUrl = design.configuration?.show_layer_background
              ? design.configuration?.background_url || getBackgroundUrl(analysisData)
              : null
            return (
              <div key={design.id} className="rounded-3xl bg-white p-4 text-gray-900 shadow-xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-lg font-black">{design.name}</h4>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {design.design_type === "input"
                        ? "Input Design"
                        : `${design.metric} · ${design.segment_label || design.configuration?.segment?.label || "Overall"}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewDesign(design)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                      aria-label={`Preview ${design.name}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {isLayer && (
                      <button
                        type="button"
                        onClick={() => void handleDownloadLayerDesign(design)}
                        disabled={downloadingDesignId === design.id}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Download ${design.name}`}
                      >
                        {downloadingDesignId === design.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
                <SelectionPreview
                  selectedElements={elements}
                  studyType={design.study_type}
                  backgroundUrl={isLayer ? compareBackgroundUrl : design.configuration?.background_url || getBackgroundUrl(analysisData)}
                  aspectRatio={design.configuration?.aspect_ratio || "9 / 16"}
                />
                {design.design_type === "input" ? (
                  <SavedInputDesignInsights design={design} analysisData={analysisData} />
                ) : (
                  <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Coefficient</span>
                      <span className="text-xl font-black tabular-nums text-gray-900">
                        {formatValue(design.total_coefficient ?? design.configuration?.total_coefficient ?? 0, design.metric)}
                      </span>
                    </div>
                  </div>
                )}
                <details className="mt-4 rounded-2xl border border-gray-200">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-gray-900">Active Selection ({elements.length})</summary>
                  <div className="space-y-3 border-t border-gray-100 p-4">
                    {elements.map((element) => (
                      <div key={`${design.id}-${element.id}`} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!element.imageUrl) return
                            setHighlightedElementKey(`${design.id}-${element.id}`)
                            onImageOpen({ url: element.imageUrl, name: element.name })
                          }}
                          disabled={!element.imageUrl}
                          className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-1 ring-1 ring-gray-100 transition hover:ring-blue-300 disabled:cursor-default disabled:hover:ring-gray-100"
                        >
                          {element.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getConfiguratorThumbnailUrl(element.imageUrl)} alt={element.name} className="h-full w-full object-contain" />
                          ) : (
                            <Type className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (!element.imageUrl) return
                              setHighlightedElementKey(`${design.id}-${element.id}`)
                              onImageOpen({ url: element.imageUrl, name: element.name })
                            }}
                            disabled={!element.imageUrl}
                            className={`truncate text-left text-sm font-semibold transition disabled:cursor-default ${
                              highlightedElementKey === `${design.id}-${element.id}`
                                ? "text-blue-600"
                                : "text-gray-900 hover:text-blue-600 disabled:hover:text-gray-900"
                            }`}
                          >
                            {element.name}
                          </button>
                          <p className="truncate text-xs text-gray-500">{element.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )
          })}
        </div>
      </div>
      <PreviewFullscreenModal
        isOpen={Boolean(previewDesign)}
        onClose={() => setPreviewDesign(null)}
      >
        {previewDesign && (
          <SelectionPreview
            selectedElements={previewElements}
            studyType={previewDesign.study_type}
            backgroundUrl={previewIsLayer ? (previewDesign.configuration?.show_layer_background ? previewDesign.configuration?.background_url || null : null) : previewDesign.configuration?.background_url || null}
            aspectRatio={previewDesign.configuration?.aspect_ratio || "9 / 16"}
            size="fullscreen"
          />
        )}
      </PreviewFullscreenModal>
      </div>
    </BodyPortal>
  )
}

export type AssistantPendingDesignSelection = {
  elements?: Array<{
    name?: string
    category_name?: string
    category_key?: string
    element_id?: string
    layer_id?: string | null
    image_id?: string | null
  }>
  selected_by_category?: Record<string, string>
  metric?: string | null
  segment_label?: string | null
  /** Changes every open so the same design can be re-applied. */
  requestId?: string | number | null
}

function resolveMetricLabel(raw?: string | null): Metric | null {
  const value = String(raw || "").trim().toLowerCase()
  if (!value) return null
  if (value === "t" || value.includes("top")) return "Top Down"
  if (value === "b" || value.includes("bottom")) return "Bottom Up"
  if (value === "r" || value.includes("response")) return "Response Time"
  return null
}

function mapAssistantDesignToSelection(
  categories: ConfiguratorCategory[],
  design: AssistantPendingDesignSelection
): Record<string, string> {
  const mapped: Record<string, string> = {}
  const elements = Array.isArray(design.elements) ? design.elements : []

  for (const el of elements) {
    const elName = normalizeText(el?.name)
    const catName = normalizeText(el?.category_name)
    const layerId = normalizeText(el?.layer_id)
    const imageId = normalizeText(el?.image_id)

    let category =
      (layerId
        ? categories.find((item) =>
            item.elements.some((element) => normalizeText(element.layerId) === layerId)
          )
        : undefined) ||
      (catName
        ? categories.find((item) => normalizeText(item.name) === catName)
        : undefined)
    if (!category && catName) {
      category = categories.find(
        (item) =>
          normalizeText(item.name).includes(catName) ||
          catName.includes(normalizeText(item.name))
      )
    }
    if (!category) continue

    let element =
      (imageId
        ? category.elements.find((item) => normalizeText(item.imageId) === imageId)
        : undefined) ||
      (elName
        ? category.elements.find((item) => normalizeText(item.name) === elName)
        : undefined)

    if (!element && elName) {
      element = category.elements.find((item) => {
        const name = normalizeText(item.name)
        return name.includes(elName) || elName.includes(name)
      })
    }
    if (!element && el?.element_id) {
      const wanted = String(el.element_id)
      element = category.elements.find(
        (item) => item.id === wanted || item.id.endsWith(`::${elName}`)
      )
    }
    if (element) {
      mapped[category.key] = element.id
    }
  }

  return mapped
}

interface AnalyticsDesignConfiguratorProps {
  analysisData: any
  studyId: string
  studyType?: string
  designConstraints?: ApiDesignConstraint[]
  studyLayers?: any[]
  persistence?: "api" | "local"
  initialSavedDesigns?: LocalSavedDesignsStore
  pendingAssistantDesign?: AssistantPendingDesignSelection | null
  onPendingAssistantDesignConsumed?: () => void
  onExportHtml?: () => void
  isExportingHtml?: boolean
  exportHtmlStage?: "preparing" | "embedding" | "generating" | "done"
}

export function AnalyticsDesignConfigurator({
  analysisData,
  studyId,
  studyType = "grid",
  designConstraints = [],
  studyLayers = [],
  persistence = "api",
  initialSavedDesigns,
  pendingAssistantDesign = null,
  onPendingAssistantDesignConsumed,
  onExportHtml,
  isExportingHtml = false,
  exportHtmlStage = "preparing",
}: AnalyticsDesignConfiguratorProps) {
  const isLocalPersistence = persistence === "local"
  const initialSavedDesignsRef = useRef<LocalSavedDesignsStore>(
    initialSavedDesigns || { configurator: [], input: [] }
  )
  const normalizedStudyType = (studyType || "grid").toLowerCase()
  const isLayerStudy = normalizedStudyType === "layer"
  const [isInputDesignMode, setIsInputDesignMode] = useState(false)
  const [showInputInsights, setShowInputInsights] = useState(false)
  const [activeInputInsightMetric, setActiveInputInsightMetric] = useState<Metric>("Top Down")
  const savedDesignType: SavedDesignType = isInputDesignMode ? "input" : "configurator"
  const [activeMetric, setActiveMetric] = useState<Metric>("Top Down")
  const segmentOptions = useMemo(
    () => getAvailableSegmentOptions(analysisData || {}, activeMetric),
    [analysisData, activeMetric]
  )
  const [activeSegmentId, setActiveSegmentId] = useState<string>("")
  const activeSegment = useMemo(
    () => segmentOptions.find((segment) => segment.id === activeSegmentId) ?? segmentOptions[0],
    [segmentOptions, activeSegmentId]
  )
  const categories = useMemo(
    () => enrichLayerCategoriesWithIds(
      getCategoriesForMetric(analysisData || {}, activeMetric, activeSegment),
      isLayerStudy ? studyLayers : []
    ),
    [analysisData, activeMetric, activeSegment, isLayerStudy, studyLayers]
  )
  const backgroundUrl = useMemo(() => getBackgroundUrl(analysisData || {}), [analysisData])
  const layerAspectRatio = useMemo(() => getLayerAspectRatio(analysisData || {}), [analysisData])
  const [selectedByCategory, setSelectedByCategory] = useState<Record<string, string>>({})
  const [assistantLoadNotice, setAssistantLoadNotice] = useState<string | null>(null)
  const [queuedAssistantDesign, setQueuedAssistantDesign] =
    useState<AssistantPendingDesignSelection | null>(null)
  const [showLayerBackground, setShowLayerBackground] = useState(
    () => isLayerStudy && Boolean(getBackgroundUrl(analysisData || {}))
  )
  const [isSelectionOpen, setIsSelectionOpen] = useState(false)
  const [openCategoryNames, setOpenCategoryNames] = useState<Record<string, boolean>>({})
  const [isMobileElementDrawerOpen, setIsMobileElementDrawerOpen] = useState(false)
  const [isPreviewDownloading, setIsPreviewDownloading] = useState(false)
  const [isPreviewFullscreenOpen, setIsPreviewFullscreenOpen] = useState(false)
  const [downloadingElementId, setDownloadingElementId] = useState<string | null>(null)
  const [savedDesigns, setSavedDesigns] = useState<SavedDesignPayload[]>([])
  const [isLoadingSavedDesigns, setIsLoadingSavedDesigns] = useState(false)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [isSavingDesign, setIsSavingDesign] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isComparePanelOpen, setIsComparePanelOpen] = useState(false)
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([])
  const [isComparingDesigns, setIsComparingDesigns] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [compareDesigns, setCompareDesigns] = useState<SavedDesignPayload[]>([])
  const [activeSelectionImage, setActiveSelectionImage] = useState<{ url: string; name: string } | null>(null)
  const [highlightedSelectionId, setHighlightedSelectionId] = useState<string | null>(null)
  const previewCaptureRef = useRef<HTMLDivElement>(null)
  const elementMediaLookup = useMemo(() => {
    const lookup: Record<string, Partial<ConfiguratorElement>> = {}
    const rememberCategory = (category: any, categoryIndex: number) => {
      const categoryName = normalizeText(category?.name || category?.title) || `Category ${categoryIndex + 1}`
      const categoryKey = getCategoryIdentity(category, categoryName, categoryIndex)
      const layerId = getLayerId(category)
      const zIndex = toNumber(category?.z_index ?? category?.z, categoryIndex + 1)
      getRawElements(category).forEach((element: any, elementIndex: number) => {
        const name = normalizeText(element?.name || element?.alt_text) || `Element ${elementIndex + 1}`
        const elementType = normalizeText(element?.element_type ?? element?.elementType)
        const id = getElementKey(categoryKey, name)
        lookup[id] = {
          layerId,
          imageId: getImageId(element),
          imageUrl: elementType.toLowerCase() === "text" ? null : pickElementImage(element),
          content: normalizeText(element?.content) || null,
          elementType,
          zIndex: toNumber(element?.z_index ?? element?.z ?? zIndex, zIndex),
          transform: pickTransform(element),
        }
      })
    }
    getInfoCategories(analysisData || {}).forEach(rememberCategory)
    METRIC_OPTIONS.forEach((metric) => {
      const section = analysisData?.[METRIC_KEYS[metric.value]]
      ;(section?.categories || []).forEach(rememberCategory)
    })
    return lookup
  }, [analysisData])

  const loadSavedDesigns = async () => {
    if (!studyId) return
    setIsLoadingSavedDesigns(true)
    setCompareError(null)
    try {
      if (isLocalPersistence) {
        const designs = listLocalSavedDesigns(studyId, savedDesignType, initialSavedDesignsRef.current)
        setSavedDesigns(designs)
      } else {
        const designs = await listSavedDesigns(studyId, savedDesignType)
        setSavedDesigns(designs)
      }
    } catch (error) {
      console.error("Failed to load saved designs", error)
      setCompareError((error as Error)?.message || "Failed to load saved designs")
    } finally {
      setIsLoadingSavedDesigns(false)
    }
  }

  useEffect(() => {
    setSelectedCompareIds([])
    setCompareDesigns([])
    void loadSavedDesigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, savedDesignType])

  useEffect(() => {
    if (!isLayerStudy) return
    if (backgroundUrl) setShowLayerBackground(true)
    else setShowLayerBackground(false)
  }, [isLayerStudy, backgroundUrl])

  useEffect(() => {
    if (segmentOptions.length === 0) return
    if (!segmentOptions.some((segment) => segment.id === activeSegmentId)) {
      setActiveSegmentId(segmentOptions[0].id)
    }
  }, [segmentOptions, activeSegmentId])

  useEffect(() => {
    if (!isMobileElementDrawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileElementDrawerOpen])

  useEffect(() => {
    setOpenCategoryNames((current) =>
      categories.reduce<Record<string, boolean>>((next, category) => {
        next[category.key] = current[category.key] ?? false
        return next
      }, {})
    )
  }, [categories])

  // Phase 1: accept pending design from assistant chat and sync metric/segment first.
  useEffect(() => {
    if (!pendingAssistantDesign) return
    const nextMetric = resolveMetricLabel(pendingAssistantDesign.metric)
    if (nextMetric && nextMetric !== activeMetric) {
      setActiveMetric(nextMetric)
    }
    const segmentLabel = normalizeText(pendingAssistantDesign.segment_label)
    if (segmentLabel && segmentOptions.length) {
      const match = segmentOptions.find((segment) => {
        const label = normalizeText(segment.label || segment.id)
        return label === segmentLabel || label.includes(segmentLabel) || segmentLabel.includes(label)
      })
      if (match && match.id !== activeSegmentId) {
        setActiveSegmentId(match.id)
      }
    }
    setQueuedAssistantDesign(pendingAssistantDesign)
    onPendingAssistantDesignConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAssistantDesign?.requestId, pendingAssistantDesign])

  // Phase 2: map assistant elements onto live configurator category/element keys.
  useEffect(() => {
    if (!queuedAssistantDesign || categories.length === 0) return
    const mapped = mapAssistantDesignToSelection(categories, queuedAssistantDesign)
    if (Object.keys(mapped).length === 0) {
      setAssistantLoadNotice("Could not map that design onto this configurator. Try Best Mix, then re-open from chat.")
      setQueuedAssistantDesign(null)
      return
    }
    setSelectedByCategory(mapped)
    setOpenCategoryNames((current) => {
      const next = { ...current }
      Object.keys(mapped).forEach((key) => {
        next[key] = true
      })
      return next
    })
    setIsSelectionOpen(true)
    setIsInputDesignMode(false)
    if (isLayerStudy && backgroundUrl) setShowLayerBackground(true)
    setAssistantLoadNotice(
      `Loaded design from assistant · ${Object.keys(mapped).length} layer${
        Object.keys(mapped).length === 1 ? "" : "s"
      } selected`
    )
    setQueuedAssistantDesign(null)
  }, [queuedAssistantDesign, categories, isLayerStudy, backgroundUrl])

  useEffect(() => {
    if (!assistantLoadNotice) return
    const timer = window.setTimeout(() => setAssistantLoadNotice(null), 4500)
    return () => window.clearTimeout(timer)
  }, [assistantLoadNotice])

  const selectedElements = useMemo(
    () =>
      categories
        .map((category) => category.elements.find((element) => element.id === selectedByCategory[category.key]))
        .filter((element): element is ConfiguratorElement => Boolean(element)),
    [categories, selectedByCategory]
  )

  const configuratorDisplayUrls = useMemo(
    () => collectConfiguratorDisplayUrls({ backgroundUrl, categories }),
    [backgroundUrl, categories]
  )

  const selectedPreviewUrls = useMemo(() => {
    const urls = new Set<string>()
    if ((!isLayerStudy || showLayerBackground) && backgroundUrl) {
      const preview = getConfiguratorResponsivePreviewUrl(backgroundUrl, false)
      if (preview) urls.add(preview)
    }
    selectedElements.forEach((element) => {
      const isText = !element.imageUrl || element.elementType?.toLowerCase() === "text"
      if (isText || !element.imageUrl) return
      const preview = getConfiguratorResponsivePreviewUrl(element.imageUrl, false)
      if (preview) urls.add(preview)
    })
    return [...urls]
  }, [backgroundUrl, isLayerStudy, selectedElements, showLayerBackground])

  useEffect(() => {
    const { thumbnailUrls } = configuratorDisplayUrls
    if (thumbnailUrls.length === 0) return

    void (async () => {
      await imageCacheManager.prewarmUrls(thumbnailUrls, "low", CONFIGURATOR_PRELOAD_BATCH_SIZE)
    })()
  }, [configuratorDisplayUrls])

  useEffect(() => {
    if (selectedPreviewUrls.length === 0) return

    void imageCacheManager.prewarmUrls(
      selectedPreviewUrls,
      "critical",
      CONFIGURATOR_PREVIEW_PRELOAD_BATCH_SIZE
    )
  }, [selectedPreviewUrls])

  useEffect(() => {
    if (!isPreviewFullscreenOpen) return

    const fullscreenUrls = new Set<string>()
    if ((!isLayerStudy || showLayerBackground) && backgroundUrl) {
      const url = getConfiguratorResponsivePreviewUrl(backgroundUrl, true)
      if (url) fullscreenUrls.add(url)
    }
    selectedElements.forEach((element) => {
      const isText = !element.imageUrl || element.elementType?.toLowerCase() === "text"
      if (isText || !element.imageUrl) return
      const url = getConfiguratorResponsivePreviewUrl(element.imageUrl, true)
      if (url) fullscreenUrls.add(url)
    })

    if (fullscreenUrls.size > 0) {
      void imageCacheManager.prewarmUrls(
        [...fullscreenUrls],
        "critical",
        CONFIGURATOR_PREVIEW_PRELOAD_BATCH_SIZE
      )
    }
  }, [isPreviewFullscreenOpen, isLayerStudy, showLayerBackground, backgroundUrl, selectedElements])

  const totalCoefficient = selectedElements.reduce((sum, element) => sum + element.value, 0)
  const selectedCount = selectedElements.length

  const hasPreviewContent =
    selectedElements.length > 0 || (isLayerStudy && showLayerBackground && Boolean(backgroundUrl))

  const inputDesignInsights = useMemo(
    () => buildInputDesignInsights(analysisData || {}, selectedByCategory),
    [analysisData, selectedByCategory]
  )

  const currentSavedDesignConfiguration: SavedDesignConfigurationPayload = useMemo(
    () => ({
      metric: activeMetric,
      study_type: (["grid", "layer", "text", "hybrid"].includes(normalizedStudyType)
        ? normalizedStudyType
        : "grid") as StudyType,
      design_type: savedDesignType,
      segment: activeSegment
        ? {
            id: activeSegment.id,
            label: activeSegment.label,
            section_key: activeSegment.sectionKey,
            value_key: activeSegment.valueKey,
          }
        : undefined,
      selected_by_category: selectedByCategory,
      selected_elements: selectedElements.map((element) => ({
        id: element.id,
        name: element.name,
        category: element.category,
        category_key: element.categoryKey,
        layer_id: element.layerId,
        image_id: element.imageId,
        value: element.value,
        image_url: element.imageUrl ?? null,
        content: element.content ?? null,
        element_type: element.elementType,
        z_index: element.zIndex,
        transform: element.transform,
      })),
      input_insights: isInputDesignMode ? inputDesignInsights : undefined,
      show_layer_background: isLayerStudy ? showLayerBackground : false,
      background_url: isLayerStudy ? backgroundUrl : backgroundUrl,
      aspect_ratio: layerAspectRatio,
      total_coefficient: totalCoefficient,
    }),
    [
      activeMetric,
      activeSegment,
      backgroundUrl,
      isLayerStudy,
      isInputDesignMode,
      inputDesignInsights,
      layerAspectRatio,
      normalizedStudyType,
      savedDesignType,
      selectedByCategory,
      selectedElements,
      showLayerBackground,
      totalCoefficient,
    ]
  )

  const defaultSavedDesignName = useMemo(() => {
    const usedNames = new Set(savedDesigns.map((design) => design.name.trim().toLowerCase()))
    let index = savedDesigns.length + 1
    const prefix = isInputDesignMode ? "Input Design" : "Design"
    let candidate = `${prefix} ${index}`
    while (usedNames.has(candidate.toLowerCase())) {
      index += 1
      candidate = `${prefix} ${index}`
    }
    return candidate
  }, [isInputDesignMode, savedDesigns])

  const handleSelect = (category: ConfiguratorCategory, element: ConfiguratorElement) => {
    setSelectedByCategory((current) => {
      const next = { ...current }
      const alreadySelected = next[category.key] === element.id

      if (alreadySelected) {
        delete next[category.key]
        return next
      }

      const currentCount = Object.keys(next).length
      if (!isLayerStudy && !next[category.key] && currentCount >= MAX_NON_LAYER_SELECTIONS) {
        return next
      }

      next[category.key] = element.id
      return next
    })
  }

  const toggleCategoryOpen = (categoryKey: string) => {
    const willOpen = !(openCategoryNames[categoryKey] ?? false)

    // When a category expands, pre-warm the device-sized preview images for its
    // elements into the browser HTTP cache (compressed bytes on disk, nothing
    // decoded yet, throttled). By the time the user taps an element its preview
    // is already cached, so it appears instantly with no proxy round-trip.
    if (willOpen) {
      const category = categories.find((item) => item.key === categoryKey)
      if (category) {
        const previewUrls = category.elements
          .filter((element) => element.imageUrl && element.elementType?.toLowerCase() !== "text")
          .map((element) => getConfiguratorResponsivePreviewUrl(element.imageUrl as string, false))
          .filter(Boolean)
        if (previewUrls.length > 0) {
          void imageCacheManager.prewarmUrls(previewUrls, "high", CONFIGURATOR_PREVIEW_PRELOAD_BATCH_SIZE)
        }
      }
    }

    setOpenCategoryNames((current) => ({
      ...current,
      [categoryKey]: !(current[categoryKey] ?? false),
    }))
  }

  const handleBestMix = () => {
    const bestSelection = isLayerStudy
      ? buildConstraintAwareLayerBestMix(categories, designConstraints)
      : buildDefaultSelection(categories, false)
    if (!bestSelection) {
      alert("No valid Best Mix exists with the current design constraints. Please relax constraints or review layer images.")
      return
    }
    setSelectedByCategory(bestSelection)
    setOpenCategoryNames(
      categories.reduce<Record<string, boolean>>((next, category) => {
        next[category.key] = Boolean(bestSelection[category.key])
        return next
      }, {})
    )
  }

  const handleDownloadPreview = async () => {
    if (isPreviewDownloading) return

    if (!hasPreviewContent) return

    setIsPreviewDownloading(true)
    try {
      if (isLayerStudy) {
        const canvas = await renderLayerSelectionToCanvas(
          selectedElements,
          showLayerBackground ? backgroundUrl : null,
          layerAspectRatio
        )
        downloadCanvas(canvas, `analytics-preview-${Date.now()}.png`)
        return
      }

      const node = previewCaptureRef.current
      if (!node) return
      if ((document as any).fonts?.ready) {
        try {
          await (document as any).fonts.ready
        } catch {
          // Font readiness is best-effort; the export can continue with browser fallbacks.
        }
      }

      const domToImage = (await import("dom-to-image-more")).default
      const rect = node.getBoundingClientRect()
      const scale = 3
      const blob = await domToImage.toBlob(node, {
        width: Math.ceil(rect.width * scale),
        height: Math.ceil(rect.height * scale),
        style: {
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${Math.ceil(rect.width)}px`,
          height: `${Math.ceil(rect.height)}px`,
        },
      })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, `analytics-preview-${Date.now()}.png`)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Preview download failed", error)
      alert("Failed to download preview. Please try again.")
    } finally {
      setIsPreviewDownloading(false)
    }
  }

  const handleDownloadElement = async (element: ConfiguratorElement) => {
    if (!element.imageUrl || downloadingElementId) return

    setDownloadingElementId(element.id)
    try {
      const response = await fetch(getProxiedImageUrl(element.imageUrl))
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)

      const blob = await response.blob()
      const extension = getExtensionFromType(blob.type)
      const url = URL.createObjectURL(blob)
      triggerDownload(url, `${safeFileName(element.name, "element")}.${extension}`)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Element download failed", error)
      alert("Failed to download this element. Please try again.")
    } finally {
      setDownloadingElementId(null)
    }
  }

  const handleSaveDesign = async (name: string) => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setSaveError("Enter a design name.")
      return
    }
    if (!hasPreviewContent) {
      setSaveError("Select at least one element before saving.")
      return
    }

    setIsSavingDesign(true)
    setSaveError(null)
    try {
      if (isLocalPersistence) {
        const now = new Date().toISOString()
        const saved: SavedDesignPayload = {
          id: createLocalDesignId(),
          study_id: studyId,
          name: trimmedName,
          design_type: savedDesignType,
          study_type: (["grid", "layer", "text", "hybrid"].includes(normalizedStudyType)
            ? normalizedStudyType
            : "grid") as StudyType,
          metric: activeMetric,
          segment_label: activeSegment?.label ?? null,
          selection_count: selectedElements.length,
          total_coefficient: totalCoefficient,
          configuration: currentSavedDesignConfiguration,
          created_at: now,
          updated_at: now,
        }
        createLocalSavedDesign(studyId, saved, initialSavedDesignsRef.current)
        initialSavedDesignsRef.current = {
          ...initialSavedDesignsRef.current,
          [savedDesignType]: [saved, ...((initialSavedDesignsRef.current[savedDesignType] as SavedDesignPayload[] | undefined) || [])],
        } as LocalSavedDesignsStore
        setSavedDesigns((current) => [saved, ...current])
      } else {
        const saved = await createSavedDesign(studyId, trimmedName, currentSavedDesignConfiguration, savedDesignType)
        setSavedDesigns((current) => [saved, ...current])
      }
      setIsSaveModalOpen(false)
    } catch (error) {
      const message = (error as Error)?.message || "Failed to save design"
      setSaveError(message)
    } finally {
      setIsSavingDesign(false)
    }
  }

  const handleOpenComparePanel = async () => {
    setIsComparePanelOpen(true)
    await loadSavedDesigns()
  }

  const handleToggleCompareDesign = (designId: string) => {
    setSelectedCompareIds((current) => {
      if (current.includes(designId)) return current.filter((id) => id !== designId)
      if (current.length >= 4) return current
      return [...current, designId]
    })
  }

  const handleCompareDesigns = async () => {
    if (selectedCompareIds.length < 2 || selectedCompareIds.length > 4) {
      setCompareError("Select between 2 and 4 saved designs.")
      return
    }

    setIsComparingDesigns(true)
    setCompareError(null)
    try {
      const designs = isLocalPersistence
        ? compareLocalSavedDesigns(studyId, selectedCompareIds, savedDesignType, initialSavedDesignsRef.current)
        : await compareSavedDesigns(studyId, selectedCompareIds, savedDesignType)
      setCompareDesigns(designs)
      setIsComparePanelOpen(false)
    } catch (error) {
      setCompareError((error as Error)?.message || "Failed to compare saved designs")
    } finally {
      setIsComparingDesigns(false)
    }
  }

  const handleDeleteSavedDesign = async (designId: string) => {
    const confirmed = window.confirm("Delete this saved design?")
    if (!confirmed) return

    try {
      if (isLocalPersistence) {
        deleteLocalSavedDesign(studyId, designId, initialSavedDesignsRef.current)
        initialSavedDesignsRef.current = {
          configurator: initialSavedDesignsRef.current.configurator.filter((design) => design.id !== designId),
          input: initialSavedDesignsRef.current.input.filter((design) => design.id !== designId),
          deleted_ids: Array.from(new Set([...(initialSavedDesignsRef.current.deleted_ids || []), designId])),
        }
      } else {
        await deleteSavedDesign(studyId, designId)
      }
      setSavedDesigns((current) => current.filter((design) => design.id !== designId))
      setSelectedCompareIds((current) => current.filter((id) => id !== designId))
      setCompareDesigns((current) => current.filter((design) => design.id !== designId))
    } catch (error) {
      setCompareError((error as Error)?.message || "Failed to delete saved design")
    }
  }

  if (!analysisData || categories.length === 0) return null

  return (
    // NOTE: opacity-only animation on purpose. A `y` (translate) animation leaves a
    // CSS transform on this section, and a transform on any ancestor breaks
    // `position: sticky` for the left preview column — the buttons would scroll away.
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-10"
    >
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Design configurator
            </h2>
          </div>
          <p className="ml-4 text-sm text-gray-500">
            Combine winning {isLayerStudy ? "layer assets" : "elements"} and preview the total coefficient.
          </p>
          {assistantLoadNotice ? (
            <div className="ml-4 mt-3 inline-flex max-w-xl items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{assistantLoadNotice}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:pt-0.5">
          {!isInputDesignMode && (
            <>
              <div className="flex rounded-xl bg-gray-100 p-1 shadow-inner">
                {METRIC_OPTIONS.map((metric) => (
                  <button
                    key={metric.value}
                    type="button"
                    onClick={() => setActiveMetric(metric.value)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      activeMetric === metric.value
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[180px]">
                <select
                  value={activeSegment?.id || ""}
                  onChange={(event) => setActiveSegmentId(event.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm font-medium text-gray-700 shadow-sm outline-none transition-colors hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {segmentOptions.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setIsInputDesignMode((current) => !current)
              setShowInputInsights(false)
            }}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold shadow-sm transition ${
              isInputDesignMode
                ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {isInputDesignMode ? "Input Design On" : "Input Design"}
          </button>

          <button
            type="button"
            onClick={() => void handleOpenComparePanel()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-sm font-bold text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-100"
          >
            <GitCompare className="h-4 w-4" />
            Compare Saved
            {savedDesigns.length > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-blue-600">{savedDesigns.length}</span>
            )}
          </button>

          {onExportHtml && (
            <button
              type="button"
              onClick={onExportHtml}
              disabled={isExportingHtml || !analysisData}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-sm font-bold text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExportingHtml ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {exportHtmlStage === "preparing" && "Preparing..."}
                    {exportHtmlStage === "embedding" && "Embedding images..."}
                    {exportHtmlStage === "generating" && "Generating HTML..."}
                    {exportHtmlStage === "done" && "Done"}
                  </span>
                </>
              ) : (
                <>
                  <FileCode2 className="h-4 w-4" />
                  <span>Export HTML</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileElementDrawerOpen(true)}
            className="inline-flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-blue-700 active:scale-[0.98] active:bg-blue-800 lg:hidden"
          >
            <ImageIcon className="h-4 w-4" />
            Select Elements
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Left Column - Preview & Selected Elements (fixed while right column scrolls) */}
        {/* Bounded to the viewport (max-h) with NO scrollbar on the column itself — the
            preview card (buttons + preview + total) is flex-shrink-0 and stays pinned at
            the top, while only the Active Selection card scrolls internally. The preview
            height is viewport-capped (see layerMaxHeight) so this top block always fits,
            which is what keeps the action buttons visible. A scrollbar here would also
            narrow the column and make the button header wrap. */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:z-10 lg:w-5/12 lg:flex-shrink-0 lg:self-start lg:pr-2 lg:max-h-[calc(100vh-3rem)] lg:min-h-0">
          {/* Preview Card */}
          <div className="flex flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/50 px-3 py-3 sm:px-5">
              {isLayerStudy ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLayerBackground((current) => !current)}
                    disabled={!backgroundUrl}
                    className={`inline-flex h-11 min-w-11 touch-manipulation cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-all duration-150 active:scale-95 sm:h-auto sm:min-w-0 sm:px-2.5 sm:py-1.5 sm:text-sm sm:active:scale-100 ${
                      showLayerBackground
                        ? "bg-blue-50 text-blue-600 hover:bg-blue-100 active:bg-blue-200"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
                    } disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100`}
                    aria-pressed={showLayerBackground}
                  >
                    <ImageIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden min-w-0 truncate min-[420px]:inline">Background</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPreview}
                    disabled={isPreviewDownloading || (selectedElements.length === 0 && !showLayerBackground)}
                    className="inline-flex h-11 min-w-11 touch-manipulation cursor-pointer items-center justify-center gap-1.5 rounded-full bg-blue-50 px-2.5 text-xs font-semibold text-blue-600 transition-all duration-150 hover:bg-blue-100 hover:text-blue-700 active:scale-95 active:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:h-auto sm:min-w-0 sm:px-2.5 sm:py-1.5 sm:text-sm sm:active:scale-100"
                  >
                    <Download className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden min-w-0 truncate min-[420px]:inline">{isPreviewDownloading ? "Downloading..." : "Download"}</span>
                  </button>
                </div>
              ) : (
                <div className="min-w-0 flex-1" />
              )}
              <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
                {!isLayerStudy && hasPreviewContent && (
                  <div className="mr-1 flex items-center gap-1 rounded-full bg-gray-100 p-1 shadow-inner">
                    <button
                      type="button"
                      onClick={() => {
                        setSaveError(null)
                        setIsSaveModalOpen(true)
                      }}
                      disabled={isSavingDesign}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Save current design"
                    >
                      {isSavingDesign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPreviewFullscreenOpen(true)}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      aria-label="Open full screen preview"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {!isInputDesignMode && (
                  <button
                    type="button"
                    onClick={handleBestMix}
                    className="inline-flex h-11 min-w-[96px] touch-manipulation cursor-pointer items-center justify-center gap-1.5 rounded-full bg-blue-50/80 px-3 text-xs font-semibold text-blue-600 transition-all duration-150 hover:bg-blue-100 hover:text-blue-700 active:scale-95 active:bg-blue-200 sm:h-auto sm:min-w-0 sm:bg-transparent sm:px-3 sm:py-1.5 sm:text-sm sm:hover:bg-blue-50 sm:active:scale-100 sm:active:bg-blue-100"
                  >
                    <Sparkles className="h-4 w-4 flex-shrink-0" />
                    <span className="min-w-0 truncate">Best Mix</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedByCategory({})}
                  className="inline-flex h-11 min-w-11 touch-manipulation cursor-pointer items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold text-gray-500 transition-all duration-150 hover:bg-gray-100 hover:text-gray-800 active:scale-95 active:bg-gray-200 sm:h-auto sm:min-w-0 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm sm:active:scale-100"
                >
                  <RotateCcw className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden min-w-0 truncate min-[420px]:inline">Clear</span>
                </button>
              </div>
            </div>

            <div className="bg-transparent p-4 sm:p-6">
              <div className="relative">
                <div
                  ref={previewCaptureRef}
                  className={`mx-auto bg-transparent ${isLayerStudy ? "w-full" : "w-full max-w-[380px]"}`}
                >
                  <SelectionPreview
                    selectedElements={selectedElements}
                    studyType={normalizedStudyType}
                    backgroundUrl={isLayerStudy ? (showLayerBackground ? backgroundUrl : null) : backgroundUrl}
                    aspectRatio={layerAspectRatio}
                  />
                </div>
                {isLayerStudy && hasPreviewContent && (
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-2 sm:right-3 sm:top-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSaveError(null)
                        setIsSaveModalOpen(true)
                      }}
                      disabled={isSavingDesign}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md backdrop-blur-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Save current design"
                    >
                      {isSavingDesign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPreviewFullscreenOpen(true)}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      aria-label="Open full screen preview"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <PreviewFullscreenModal
              isOpen={isPreviewFullscreenOpen}
              onClose={() => setIsPreviewFullscreenOpen(false)}
            >
              <SelectionPreview
                selectedElements={selectedElements}
                studyType={normalizedStudyType}
                backgroundUrl={isLayerStudy ? (showLayerBackground ? backgroundUrl : null) : backgroundUrl}
                aspectRatio={layerAspectRatio}
                size="fullscreen"
              />
            </PreviewFullscreenModal>

            <div className="flex items-center justify-between border-t border-gray-100 bg-white px-6 py-4">
              {isInputDesignMode ? (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Input Design</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-400">{selectedElements.length} selected</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInputInsights(true)}
                    disabled={selectedElements.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Check Insights
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Coefficient</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-400">{activeSegment?.label || "Overall"}</p>
                  </div>
                  <div className="tabular-nums text-3xl font-black text-gray-900">
                    {formatValue(totalCoefficient, activeMetric)}
                  </div>
                </>
              )}
            </div>
          </div>

          {isInputDesignMode && showInputInsights && selectedElements.length > 0 && (
            <div className="rounded-3xl border border-blue-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Input Design Insights</h3>
                  <p className="mt-1 text-xs text-gray-500">Summed coefficients for your selected elements across all segments.</p>
                </div>
                <div className="relative min-w-[180px]">
                  <select
                    value={activeInputInsightMetric}
                    onChange={(event) => setActiveInputInsightMetric(event.target.value as Metric)}
                    className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm font-bold text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    {METRIC_OPTIONS.map((metric) => (
                      <option key={metric.value} value={metric.value}>
                        {metric.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto p-5">
                {(inputDesignInsights[activeInputInsightMetric] || []).map((row) => (
                  <div key={row.segment_id} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-gray-700">{row.label}</span>
                    <span className={`ml-3 tabular-nums text-sm font-black ${row.value >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {row.value >= 0 ? "+" : ""}
                      {formatValue(row.value, activeInputInsightMetric)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Elements Card */}
          {selectedElements.length > 0 && (
            <div className={`flex flex-col rounded-3xl border border-gray-200 bg-white shadow-sm transition-all ${isSelectionOpen ? "min-h-[200px] flex-1" : "flex-shrink-0"}`}>
              <button
                type="button"
                onClick={() => setIsSelectionOpen(!isSelectionOpen)}
                className="flex w-full cursor-pointer items-center justify-between p-5 outline-none sm:p-6"
              >
                <h3 className="text-sm font-bold text-gray-900">Active Selection ({selectedElements.length})</h3>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isSelectionOpen ? "rotate-180" : ""}`} />
              </button>
              {isSelectionOpen && (
                <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-5 pr-3 sm:px-6 sm:pb-6 sm:pr-4">
                  {selectedElements.map((element) => (
                    <div key={`selected-${element.id}`} className="group flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!element.imageUrl) return
                            setHighlightedSelectionId(element.id)
                            setActiveSelectionImage({ url: element.imageUrl, name: element.name })
                          }}
                          disabled={!element.imageUrl}
                          className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-1 ring-1 ring-gray-100 transition hover:ring-blue-300 disabled:cursor-default disabled:hover:ring-gray-100"
                        >
                          {element.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getConfiguratorThumbnailUrl(element.imageUrl)} alt={element.name} className="h-full w-full object-contain" />
                          ) : (
                            <Type className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (!element.imageUrl) return
                              setHighlightedSelectionId(element.id)
                              setActiveSelectionImage({ url: element.imageUrl, name: element.name })
                            }}
                            disabled={!element.imageUrl}
                            className={`break-words text-left text-sm font-medium transition disabled:cursor-default ${
                              highlightedSelectionId === element.id
                                ? "text-blue-600"
                                : "text-gray-900 hover:text-blue-600 disabled:hover:text-gray-900"
                            }`}
                          >
                            {element.name}
                          </button>
                          <p className="truncate text-xs text-gray-500">{element.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {!isInputDesignMode && (
                          <span
                            className={`tabular-nums text-sm font-bold ${
                              element.value >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {element.value >= 0 ? "+" : ""}
                            {formatValue(element.value, activeMetric)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedByCategory((current) => {
                              const next = { ...current }
                              delete next[element.categoryKey]
                              return next
                            })
                          }
                          className="text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                          aria-label={`Remove ${element.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Categories (independently scrollable on desktop).
            overscroll-auto (not -contain) lets the scroll CHAIN to the page: when the
            element list reaches its top or bottom edge, continued scrolling carries over
            and moves the whole page, so the user never gets "stuck" inside the list. */}
        <div className="hidden space-y-4 pb-10 lg:sticky lg:top-6 lg:block lg:w-7/12 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-auto lg:pr-2 [-webkit-overflow-scrolling:touch]">
          {!isLayerStudy && selectedCount >= MAX_NON_LAYER_SELECTIONS && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
              Maximum 4 elements can be selected. Remove one to add another category.
            </div>
          )}

          {categories.map((category) => {
            const selectedId = selectedByCategory[category.key]
            const isOpen = openCategoryNames[category.key] ?? false
            return (
              <div key={category.key} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleCategoryOpen(category.key)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 sm:px-6"
                  aria-expanded={isOpen}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {isLayerStudy ? "Layer" : "Category"}: {category.name}
                      </h3>
                      {selectedId && (
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {category.elements.length} option{category.elements.length === 1 ? "" : "s"}{" "}
                      {isLayerStudy ? `· z-index ${category.zIndex}` : ""}
                    </p>
                  </div>
                  <ChevronDown className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-5 sm:p-6">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {(isInputDesignMode ? [...category.elements] : [...category.elements].sort((a, b) => b.value - a.value))
                        .map((element) => {
                          const isSelected = selectedId === element.id
                          const disabled =
                            !isLayerStudy &&
                            !isSelected &&
                            !selectedId &&
                            selectedCount >= MAX_NON_LAYER_SELECTIONS
                          const isText = !element.imageUrl || element.elementType?.toLowerCase() === "text"

                          return (
                            <div
                              key={element.id}
                              role="button"
                              tabIndex={disabled ? -1 : 0}
                              onClick={() => {
                                if (!disabled) handleSelect(category, element)
                              }}
                              onKeyDown={(event) => {
                                if (disabled) return
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  handleSelect(category, element)
                                }
                              }}
                              aria-disabled={disabled}
                              className={`relative flex flex-col rounded-2xl border p-3 text-left transition-all ${
                                isSelected
                                  ? "border-blue-500 ring-1 ring-blue-500 shadow-md bg-white"
                                  : disabled
                                    ? "cursor-not-allowed border-gray-200 bg-gray-50/50 opacity-50"
                                    : "cursor-pointer border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                              }`}
                            >
                              <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-xl bg-gray-50 p-2">
                                {isText ? (
                                  <Type className="h-8 w-8 text-gray-300" />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={getConfiguratorThumbnailUrl(element.imageUrl) || ""}
                                    alt={element.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-contain"
                                    onError={(event) => {
                                      event.currentTarget.style.display = "none"
                                    }}
                                  />
                                )}
                              </div>
                              <div className="flex w-full flex-1 flex-col justify-between">
                                <p className="mb-2 text-sm font-medium leading-snug text-gray-900 break-words">
                                  {element.name}
                                </p>
                                <div className="mt-auto flex items-center justify-between">
                                  {/* <span className="text-xs text-gray-500">
                                    {isLayerStudy ? `Stack ${element.zIndex}` : isText ? "Text" : "Image"}
                                  </span> */}
                                  {!isInputDesignMode && (
                                    <span
                                      className={`rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${
                                        element.value >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                      }`}
                                    >
                                      {element.value >= 0 ? "+" : ""}
                                      {formatValue(element.value, activeMetric)}
                                    </span>
                                  )}
                                  {!isText && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void handleDownloadElement(element)
                                      }}
                                      disabled={Boolean(downloadingElementId)}
                                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                                      aria-label={`Download ${element.name}`}
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {isMobileElementDrawerOpen && (
        <BodyPortal>
          <div className="fixed inset-0 z-[210] lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/35"
              aria-label="Close element selector"
              onClick={() => setIsMobileElementDrawerOpen(false)}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Select design elements"
              className="absolute right-0 top-0 flex h-full w-[min(92vw,420px)] flex-col overflow-hidden rounded-l-3xl bg-white shadow-2xl"
            >
              <div className="border-b border-gray-100 bg-white px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Select Elements</h3>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {selectedCount} selected · {categories.length} {isLayerStudy ? "layers" : "categories"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileElementDrawerOpen(false)}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                    aria-label="Close element selector"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-gray-50 px-4 py-4 [-webkit-overflow-scrolling:touch]">
                {!isLayerStudy && selectedCount >= MAX_NON_LAYER_SELECTIONS && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    Maximum 4 elements can be selected. Remove one to add another category.
                  </div>
                )}

                {categories.map((category) => {
                  const selectedId = selectedByCategory[category.key]
                  const isOpen = openCategoryNames[category.key] ?? false
                  return (
                    <div key={`mobile-${category.key}`} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleCategoryOpen(category.key)}
                        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-gray-900">
                              {isLayerStudy ? "Layer" : "Category"}: {category.name}
                            </h3>
                            {selectedId && (
                              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            {category.elements.length} option{category.elements.length === 1 ? "" : "s"}{" "}
                            {isLayerStudy ? `· z-index ${category.zIndex}` : ""}
                          </p>
                        </div>
                        <ChevronDown className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isOpen && (
                        <div className="border-t border-gray-100 p-4">
                          <div className="grid grid-cols-2 gap-3">
                            {(isInputDesignMode ? [...category.elements] : [...category.elements].sort((a, b) => b.value - a.value))
                              .map((element) => {
                                const isSelected = selectedId === element.id
                                const disabled =
                                  !isLayerStudy &&
                                  !isSelected &&
                                  !selectedId &&
                                  selectedCount >= MAX_NON_LAYER_SELECTIONS
                                const isText = !element.imageUrl || element.elementType?.toLowerCase() === "text"

                                return (
                                  <div
                                    key={`mobile-${element.id}`}
                                    role="button"
                                    tabIndex={disabled ? -1 : 0}
                                    onClick={() => {
                                      if (!disabled) handleSelect(category, element)
                                    }}
                                    onKeyDown={(event) => {
                                      if (disabled) return
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault()
                                        handleSelect(category, element)
                                      }
                                    }}
                                    aria-disabled={disabled}
                                    className={`relative flex min-h-[178px] flex-col rounded-2xl border p-3 text-left transition-all ${
                                      isSelected
                                        ? "border-blue-500 ring-2 ring-blue-500 shadow-md bg-white"
                                        : disabled
                                          ? "cursor-not-allowed border-gray-200 bg-gray-50/50 opacity-50"
                                          : "cursor-pointer border-gray-200 bg-white active:scale-[0.99]"
                                    }`}
                                  >
                                    <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-xl bg-gray-50 p-2">
                                      {isText ? (
                                        <Type className="h-8 w-8 text-gray-300" />
                                      ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={getConfiguratorThumbnailUrl(element.imageUrl) || ""}
                                          alt={element.name}
                                          loading="lazy"
                                          decoding="async"
                                          className="h-full w-full object-contain"
                                          onError={(event) => {
                                            event.currentTarget.style.display = "none"
                                          }}
                                        />
                                      )}
                                    </div>
                                    <div className="flex w-full flex-1 flex-col justify-between">
                                      <p className="mb-2 text-sm font-medium leading-snug text-gray-900 break-words">
                                        {element.name}
                                      </p>
                                      <div className="mt-auto flex items-center justify-between">
                                        {!isInputDesignMode && (
                                          <span
                                            className={`rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${
                                              element.value >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                            }`}
                                          >
                                            {element.value >= 0 ? "+" : ""}
                                            {formatValue(element.value, activeMetric)}
                                          </span>
                                        )}
                                        {!isText && (
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              void handleDownloadElement(element)
                                            }}
                                            disabled={Boolean(downloadingElementId)}
                                            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                                            aria-label={`Download ${element.name}`}
                                          >
                                            <Download className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        </BodyPortal>
      )}

      <SaveDesignModal
        isOpen={isSaveModalOpen}
        defaultName={defaultSavedDesignName}
        error={saveError}
        isSaving={isSavingDesign}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={(name) => void handleSaveDesign(name)}
      />

      <SavedDesignComparePanel
        isOpen={isComparePanelOpen}
        savedDesigns={savedDesigns}
        selectedIds={selectedCompareIds}
        error={compareError}
        isLoading={isLoadingSavedDesigns}
        isComparing={isComparingDesigns}
        onClose={() => setIsComparePanelOpen(false)}
        onToggle={handleToggleCompareDesign}
        onCompare={() => void handleCompareDesigns()}
        onDelete={(designId) => void handleDeleteSavedDesign(designId)}
      />

      <SavedDesignCompareOverlay
        designs={compareDesigns}
        analysisData={analysisData}
        elementMediaLookup={elementMediaLookup}
        onImageOpen={(image) => setActiveSelectionImage(image)}
        onClose={() => setCompareDesigns([])}
      />

      <SelectionImageLightbox
        image={activeSelectionImage}
        onClose={() => setActiveSelectionImage(null)}
      />
    </motion.section>
  )
}
