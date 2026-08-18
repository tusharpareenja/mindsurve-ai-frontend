/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  buildDesignConfiguratorPayload,
  DesignConfiguratorExportPayload,
} from "@/lib/export/buildDesignConfiguratorPayload"
import { buildImageDataUrlMap, collectHttpUrls, embedImagesInValue } from "@/lib/export/embedExportImages"
import type { ExportConfiguratorPayload } from "@/lib/export/ExportConfiguratorRoot"
import type { ApiDesignConstraint } from "@/lib/utils/designConstraintsStorage"

export type ExportHtmlStage = "preparing" | "embedding" | "generating" | "done"

function safeFileName(value: string, fallback = "study"): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function loadExportAssets(): Promise<{ bundle: string; css: string }> {
  const [bundleRes, cssRes] = await Promise.all([
    fetch("/export-assets/configurator-bundle.js"),
    fetch("/export-assets/export-styles.css"),
  ])

  if (!bundleRes.ok || !cssRes.ok) {
    throw new Error(
      "Export assets are missing. Run npm run build:export-assets, then reload this page and try again."
    )
  }

  return {
    bundle: await bundleRes.text(),
    css: await cssRes.text(),
  }
}

function toExportConfiguratorPayload(payload: DesignConfiguratorExportPayload): ExportConfiguratorPayload {
  return {
    studyId: payload.studyId,
    studyTitle: payload.studyTitle,
    studyType: payload.studyType,
    exportedAt: payload.exportedAt,
    analysisData: payload.analysisData,
    designConstraints: payload.designConstraints || [],
    studyLayers: payload.studyLayers || [],
    savedDesigns: payload.savedDesigns,
  }
}

export function generateDesignConfiguratorHtml(
  payload: DesignConfiguratorExportPayload,
  assets: { bundle: string; css: string }
): string {
  const exportPayload = toExportConfiguratorPayload(payload)
  const json = JSON.stringify(exportPayload).replace(/</g, "\\u003c")
  const bundle = assets.bundle.replace(/<\/script/gi, "<\\/script")
  const title = escapeHtml(payload.studyTitle)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - Design Configurator</title>
  <style>${assets.css}</style>
</head>
<body>
  <div id="export-root"></div>
  <script>window.__DESIGN_CONFIGURATOR_EXPORT__ = ${json};</script>
  <script>window.process = window.process || { env: { NODE_ENV: "production" } };</script>
  <script>${bundle}</script>
</body>
</html>`
}

export async function exportDesignConfiguratorHtml(input: {
  studyId: string
  studyTitle: string
  studyType: string
  analysisData: any
  designConstraints?: ApiDesignConstraint[]
  studyLayers?: any[]
  onStageChange?: (stage: ExportHtmlStage) => void
}): Promise<{ fileName: string }> {
  input.onStageChange?.("preparing")
  const [payload, assets] = await Promise.all([
    buildDesignConfiguratorPayload(input),
    loadExportAssets(),
  ])

  input.onStageChange?.("embedding")
  const imageUrls = collectHttpUrls(payload.analysisData)
  const { map } = await buildImageDataUrlMap(imageUrls)
  const exportPayload: DesignConfiguratorExportPayload = {
    ...payload,
    analysisData: await embedImagesInValue(payload.analysisData, map),
  }

  input.onStageChange?.("generating")
  const html = generateDesignConfiguratorHtml(exportPayload, assets)
  const fileName = `${safeFileName(input.studyTitle)}.html`
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  input.onStageChange?.("done")
  return { fileName }
}
