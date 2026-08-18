const HTTP_URL_RE = /^https?:\/\//i
const IMAGE_EMBED_CONCURRENCY = 5

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && HTTP_URL_RE.test(value)
}

function getProxiedImageUrl(url: string): string {
  if (typeof window !== "undefined" && url.includes(window.location.host)) return url
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

export function collectHttpUrls(value: unknown, urls = new Set<string>()): Set<string> {
  if (isHttpUrl(value)) {
    urls.add(value)
    return urls
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectHttpUrls(item, urls))
    return urls
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectHttpUrls(item, urls))
  }
  return urls
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(getProxiedImageUrl(url))
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function embedImagesInValue<T>(
  value: T,
  urlMap: Map<string, string>,
  onProgress?: (done: number, total: number) => void
): Promise<T> {
  if (isHttpUrl(value)) {
    return (urlMap.get(value) || value) as T
  }
  if (Array.isArray(value)) {
    const next = await Promise.all(value.map((item) => embedImagesInValue(item, urlMap, onProgress)))
    return next as T
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([key, item]) => [
        key,
        await embedImagesInValue(item, urlMap, onProgress),
      ])
    )
    return Object.fromEntries(entries) as T
  }
  return value
}

export async function buildImageDataUrlMap(
  urls: Iterable<string>,
  onProgress?: (done: number, total: number) => void
): Promise<{ map: Map<string, string>; failed: string[] }> {
  const unique = Array.from(new Set(urls))
  const map = new Map<string, string>()
  const failed: string[] = []
  let done = 0

  let nextIndex = 0
  const workerCount = Math.min(IMAGE_EMBED_CONCURRENCY, unique.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < unique.length) {
        const url = unique[nextIndex]
        nextIndex += 1

        const dataUrl = await fetchAsDataUrl(url)
        if (dataUrl) map.set(url, dataUrl)
        else failed.push(url)
        done += 1
        onProgress?.(done, unique.length)
      }
    })
  )

  return { map, failed }
}
