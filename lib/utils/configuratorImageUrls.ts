export const CONFIGURATOR_THUMB_WIDTH = 240
export const CONFIGURATOR_PREVIEW_WIDTH = 720
export const CONFIGURATOR_IMAGE_QUALITY = 82
export const CONFIGURATOR_PREVIEW_QUALITY = 85
export const CONFIGURATOR_PRELOAD_BATCH_SIZE = 8
export const CONFIGURATOR_PREVIEW_PRELOAD_BATCH_SIZE = 3

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function shouldUseOptimizedProxy(): boolean {
  if (typeof window === "undefined") return true
  return window.location.protocol !== "file:"
}

export function getConfiguratorOptimizedImageUrl(
  url: string | null | undefined,
  width: number,
  quality: number = CONFIGURATOR_IMAGE_QUALITY
): string {
  if (!url) return ""
  if (!isHttpUrl(url)) return url
  if (!shouldUseOptimizedProxy()) return url

  const params = new URLSearchParams({
    url,
    w: String(width),
    q: String(quality),
    fmt: "webp",
  })
  return `/api/proxy-image?${params.toString()}`
}

export function getConfiguratorThumbnailUrl(url: string | null | undefined): string {
  return getConfiguratorOptimizedImageUrl(url, CONFIGURATOR_THUMB_WIDTH)
}

export function getConfiguratorPreviewUrl(url: string | null | undefined): string {
  return getConfiguratorOptimizedImageUrl(url, CONFIGURATOR_PREVIEW_WIDTH)
}

function clampWidth(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

/**
 * Chooses a preview width matched to the *display size × device pixel ratio*.
 *
 * Goal: crisp on high-DPI screens (no quality loss) without ever downloading /
 * decoding a bitmap far larger than what is shown. Because the configurator
 * pre-warms these URLs when a category is opened and paints a cached thumbnail
 * instantly underneath, transfer latency is hidden — so we can size for quality
 * while keeping the decoded bitmap (width × height × 4 bytes) bounded so phones
 * with many images do not run out of memory. DPR is capped at 2 for this reason.
 */
export function getResponsivePreviewWidth(fullscreen = false): number {
  if (typeof window === "undefined") return CONFIGURATOR_PREVIEW_WIDTH
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const vw = window.innerWidth || 420

  if (fullscreen) {
    return clampWidth(Math.min(vw, 1080) * dpr, 900, 1800)
  }

  // Inline preview box is small on phones (~280-460 css px) and modest on
  // desktop. Size to it, then account for DPR, then clamp.
  const cssWidth = vw < 640 ? Math.min(vw - 24, 460) : 720
  return clampWidth(cssWidth * dpr, 480, 1400)
}

/** Preview URL sized to the current device (crisp + memory-safe). */
export function getConfiguratorResponsivePreviewUrl(
  url: string | null | undefined,
  fullscreen = false
): string {
  return getConfiguratorOptimizedImageUrl(url, getResponsivePreviewWidth(fullscreen), CONFIGURATOR_PREVIEW_QUALITY)
}

/** Full-resolution proxy for canvas export / file download (not display). */
export function getConfiguratorExportProxyUrl(url: string): string {
  if (!isHttpUrl(url)) return url
  if (typeof window !== "undefined" && window.location.protocol === "file:") return url
  if (typeof window !== "undefined" && url.includes(window.location.host)) return url
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

export function collectConfiguratorDisplayUrls(input: {
  backgroundUrl?: string | null
  categories: Array<{ elements: Array<{ imageUrl?: string | null; elementType?: string }> }>
}): { previewUrls: string[]; thumbnailUrls: string[] } {
  const previewUrls = new Set<string>()
  const thumbnailUrls = new Set<string>()

  input.categories.forEach((category) => {
    category.elements.forEach((element) => {
      const isText = !element.imageUrl || element.elementType?.toLowerCase() === "text"
      if (isText || !element.imageUrl) return
      const thumb = getConfiguratorThumbnailUrl(element.imageUrl)
      if (thumb) thumbnailUrls.add(thumb)
    })
  })

  return {
    previewUrls: [...previewUrls],
    thumbnailUrls: [...thumbnailUrls],
  }
}
