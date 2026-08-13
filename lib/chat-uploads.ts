/** Helpers for chat file / folder uploads. */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i
const DOCUMENT_EXT = /\.(pdf|docx|txt|csv|md)$/i

export type UploadItem = {
  id: string
  file: File
  previewUrl?: string
  category?: string
  relativePath?: string
  status: "uploading" | "ready" | "error"
  url?: string
  contentType?: string
  extractedText?: string | null
  error?: string
}

export type ParsedSelection = {
  items: Omit<UploadItem, "status">[]
  emptyCategories: string[]
  skippedUnsupported: number
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return IMAGE_EXT.test(file.name)
}

export function isDocumentFile(file: File): boolean {
  const type = (file.type || "").toLowerCase()
  if (
    type === "application/pdf" ||
    type === "text/plain" ||
    type === "text/csv" ||
    type === "text/markdown" ||
    type.includes("wordprocessingml")
  ) {
    return true
  }
  return DOCUMENT_EXT.test(file.name)
}

function isSupportedFile(file: File): boolean {
  return isImageFile(file) || isDocumentFile(file)
}

function elementNameFromFile(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim() || filename
}

/**
 * Parse a FileList from either multi-file pick or folder (webkitdirectory).
 *
 * Folder rules:
 * - `Study/Aura/img.png` → category Aura, name from filename
 * - `Aura/img.png` → category Aura
 * - `img.png` (flat) → no category; AI/backend can organize
 * - PDF / Word / text files are kept as documents (no category)
 * - Category folders that only contain unsupported files → emptyCategories
 */
export function parseUploadSelection(fileList: FileList | File[]): ParsedSelection {
  const files = Array.from(fileList as ArrayLike<File>)
  const emptyCategories: string[] = []
  let skippedUnsupported = 0

  type Bucket = { images: File[]; unsupported: number }
  const categoryBuckets = new Map<string, Bucket>()
  const flatFiles: File[] = []

  for (const file of files) {
    const relative =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name
    const parts = relative.split("/").filter(Boolean)

    if (parts.length >= 2 && isImageFile(file)) {
      const category = parts[parts.length - 2]
      const bucket = categoryBuckets.get(category) ?? {
        images: [],
        unsupported: 0,
      }
      bucket.images.push(file)
      categoryBuckets.set(category, bucket)
    } else if (isSupportedFile(file)) {
      flatFiles.push(file)
    } else if (parts.length >= 2) {
      const category = parts[parts.length - 2]
      const bucket = categoryBuckets.get(category) ?? {
        images: [],
        unsupported: 0,
      }
      bucket.unsupported += 1
      categoryBuckets.set(category, bucket)
      skippedUnsupported += 1
    } else {
      skippedUnsupported += 1
    }
  }

  for (const [category, bucket] of categoryBuckets) {
    if (bucket.images.length === 0) emptyCategories.push(category)
  }

  const items: Omit<UploadItem, "status">[] = []

  if (categoryBuckets.size > 0) {
    for (const [category, bucket] of categoryBuckets) {
      for (const file of bucket.images) {
        const relative =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name
        items.push({
          id: `${relative}-${file.size}-${file.lastModified}`,
          file,
          previewUrl: URL.createObjectURL(file),
          category,
          relativePath: relative,
        })
      }
    }
  }

  for (const file of flatFiles) {
    items.push({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      previewUrl: isImageFile(file) ? URL.createObjectURL(file) : undefined,
      relativePath: file.name,
    })
  }

  return { items, emptyCategories, skippedUnsupported }
}

export function displayNameForUpload(item: Pick<UploadItem, "file" | "category">): string {
  const base = elementNameFromFile(item.file.name)
  return item.category ? `${item.category}/${base}` : base
}

/** Run async work with a concurrency limit. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index], index)
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => run()
  )
  await Promise.all(runners)
  return results
}
