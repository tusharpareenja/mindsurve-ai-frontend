/** Helpers for chat file / folder uploads (grid categories + layer studies). */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i
const DOCUMENT_EXT = /\.(pdf|docx|txt|csv|md)$/i

export type UploadItem = {
  id: string
  file: File
  previewUrl?: string
  category?: string
  relativePath?: string
  /** Root-level image in a layer folder upload → study background. */
  isBackground?: boolean
  /** Alphabetical layer folder index → z_index. */
  layerOrder?: number
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
  /** True when root images + subfolders were detected as a layer pack. */
  detectedLayerStudy: boolean
  backgroundCount: number
  layerCount: number
  warnings: string[]
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

function getRelativePath(file: File): string {
  return (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name
  ).replace(/\\/g, "/")
}

function sortNames(names: string[]): string[] {
  return [...names].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  )
}

/**
 * Strip shared wrapper folder(s) that browsers add via `webkitRelativePath`.
 *
 * Picking folder "Pack" yields paths like:
 *   Pack/Background.png
 *   Pack/Logo/a.png
 * which must become:
 *   Background.png          → study background
 *   Logo/a.png              → layer Logo
 *
 * Also strips nested wrappers (Pack/Pack/Logo/a.png).
 * Does not strip flat folders (Pack/a.png + Pack/b.png only).
 */
function stripSharedWrappers(files: File[]): Map<File, string> {
  const overrides = new Map<File, string>()
  for (const file of files) {
    overrides.set(file, getRelativePath(file))
  }

  for (let i = 0; i < 8; i += 1) {
    const partsList = files.map((f) =>
      (overrides.get(f) || "").split("/").filter(Boolean)
    )
    if (partsList.length === 0) break
    // Need at least Folder/file for every path before we can strip a wrapper.
    if (partsList.some((p) => p.length < 2)) break

    const first = partsList[0][0]
    if (!first || !partsList.every((p) => p[0] === first)) break

    // Only strip when something is nested deeper than Folder/file
    // (e.g. Folder/Layer/img.png). Flat Folder/*.png stays as-is.
    const maxDepth = Math.max(...partsList.map((p) => p.length))
    if (maxDepth < 3) break

    for (const file of files) {
      const parts = (overrides.get(file) || "").split("/").filter(Boolean)
      overrides.set(file, parts.slice(1).join("/"))
    }
  }
  return overrides
}

/**
 * Parse a FileList from either multi-file pick or folder (webkitdirectory).
 *
 * Layer pack:
 * - `Root/bg.png` → background
 * - `Root/LayerA/img.png` → layer LayerA (z from alphabetical folder order)
 *
 * Grid (subfolders only, or flat images):
 * - `Study/Aura/img.png` → category Aura
 * - flat images → no category
 *
 * `layerStudy`:
 * - `true` → force layer mapping when subfolders exist
 * - `false` → force grid mapping even if structure looks like a layer pack
 * - omit → auto-detect (root images + subfolders)
 */
export function parseUploadSelection(
  fileList: FileList | File[],
  options?: { layerStudy?: boolean }
): ParsedSelection {
  const files = Array.from(fileList as ArrayLike<File>)
  const emptyCategories: string[] = []
  let skippedUnsupported = 0
  const warnings: string[] = []

  const imageFiles = files.filter(isImageFile)
  const docFiles = files.filter((f) => isDocumentFile(f) && !isImageFile(f))
  const pathMap = stripSharedWrappers(imageFiles)

  const rootImages: File[] = []
  const layerBuckets = new Map<string, File[]>()
  let skippedNested = 0

  for (const file of imageFiles) {
    const parts = (pathMap.get(file) || getRelativePath(file))
      .split("/")
      .filter(Boolean)
    if (parts.length === 1) {
      rootImages.push(file)
    } else if (parts.length === 2) {
      const folder = parts[0]
      const bucket = layerBuckets.get(folder) ?? []
      bucket.push(file)
      layerBuckets.set(folder, bucket)
    } else {
      skippedNested += 1
      skippedUnsupported += 1
    }
  }

  for (const file of files) {
    if (!isSupportedFile(file) && !isImageFile(file)) {
      skippedUnsupported += 1
    }
  }

  const hasSubfolders = layerBuckets.size > 0
  const autoLayer = hasSubfolders && rootImages.length > 0
  const forceLayer = options?.layerStudy === true
  const forceGrid = options?.layerStudy === false
  const detectedLayerStudy =
    !forceGrid && (forceLayer ? hasSubfolders : autoLayer)

  if (forceLayer && !hasSubfolders) {
    warnings.push(
      "Layer study is on, but this upload has no layer folders. Use a background image plus subfolders."
    )
  }
  if (forceLayer && hasSubfolders && rootImages.length === 0) {
    warnings.push(
      "Layer study is on, but no root background image was found. Add a background image at the folder root."
    )
  }

  if (skippedNested > 0) {
    warnings.push(
      `${skippedNested} image(s) in deeper nested folders were skipped. Use Root → layer folders → images.`
    )
  }

  const items: Omit<UploadItem, "status">[] = []

  if (detectedLayerStudy) {
    if (rootImages.length > 1) {
      warnings.push(
        `Using the first root image as the background (${rootImages.length - 1} extra root image(s) ignored).`
      )
    }
    const bg = rootImages[0]
    if (bg) {
      const relative = pathMap.get(bg) || getRelativePath(bg)
      items.push({
        id: `${relative}-${bg.size}-${bg.lastModified}`,
        file: bg,
        previewUrl: URL.createObjectURL(bg),
        relativePath: relative,
        isBackground: true,
      })
    }

    const folderNames = sortNames(Array.from(layerBuckets.keys()))
    for (const [order, folderName] of folderNames.entries()) {
      const bucket = layerBuckets.get(folderName) || []
      if (bucket.length === 0) {
        emptyCategories.push(folderName)
        continue
      }
      for (const file of bucket) {
        const relative = pathMap.get(file) || getRelativePath(file)
        items.push({
          id: `${relative}-${file.size}-${file.lastModified}`,
          file,
          previewUrl: URL.createObjectURL(file),
          category: folderName,
          relativePath: relative,
          isBackground: false,
          layerOrder: order,
        })
      }
    }

    for (const file of docFiles) {
      items.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        relativePath: file.name,
      })
    }

    return {
      items,
      emptyCategories,
      skippedUnsupported,
      detectedLayerStudy: true,
      backgroundCount: bg ? 1 : 0,
      layerCount: folderNames.filter((n) => (layerBuckets.get(n) || []).length > 0)
        .length,
      warnings,
    }
  }

  // Grid / flat path (existing behavior).
  type Bucket = { images: File[]; unsupported: number }
  const categoryBuckets = new Map<string, Bucket>()
  const flatFiles: File[] = []

  for (const file of files) {
    const relative = getRelativePath(file)
    const parts = relative.split("/").filter(Boolean)

    if (parts.length >= 2 && isImageFile(file)) {
      // Prefer immediate parent as category; if this looks like Root/Cat/file
      // after a single wrapper, use parent folder (last-but-one).
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

  // If we only had subfolders (no root images), still map as grid categories —
  // but prefer the true layer-folder names (alphabetical) when paths are Root/Layer/img.
  if (hasSubfolders && rootImages.length === 0 && layerBuckets.size > 0) {
    categoryBuckets.clear()
    for (const [folderName, bucketFiles] of layerBuckets) {
      categoryBuckets.set(folderName, {
        images: bucketFiles,
        unsupported: 0,
      })
    }
  }

  for (const [category, bucket] of categoryBuckets) {
    if (bucket.images.length === 0) emptyCategories.push(category)
  }

  if (categoryBuckets.size > 0) {
    for (const [category, bucket] of categoryBuckets) {
      for (const file of bucket.images) {
        const relative = getRelativePath(file)
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

  return {
    items,
    emptyCategories,
    skippedUnsupported,
    detectedLayerStudy: false,
    backgroundCount: 0,
    layerCount: 0,
    warnings,
  }
}

export function displayNameForUpload(
  item: Pick<UploadItem, "file" | "category" | "isBackground">
): string {
  const base = elementNameFromFile(item.file.name)
  if (item.isBackground) return `Background/${base}`
  return item.category ? `${item.category}/${base}` : base
}

function withRelativePath(file: File, relativePath: string): File {
  const path = relativePath.replace(/\\/g, "/")
  try {
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: path,
    })
    return file
  } catch {
    const copy = new File([file], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    })
    Object.defineProperty(copy, "webkitRelativePath", {
      configurable: true,
      value: path,
    })
    return copy
  }
}

async function readDirectoryEntry(
  entry: FileSystemDirectoryEntry,
  prefix: string
): Promise<File[]> {
  const reader = entry.createReader()
  const files: File[] = []

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })

  // readEntries may return partial batches until an empty array.
  for (;;) {
    const entries = await readBatch()
    if (!entries.length) break
    for (const child of entries) {
      const nextPrefix = prefix ? `${prefix}/${child.name}` : child.name
      if (child.isFile) {
        const fileEntry = child as FileSystemFileEntry
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject)
        })
        files.push(withRelativePath(file, nextPrefix))
      } else if (child.isDirectory) {
        files.push(
          ...(await readDirectoryEntry(
            child as FileSystemDirectoryEntry,
            nextPrefix
          ))
        )
      }
    }
  }
  return files
}

/** Collect image / doc files from a paste event (clipboard images + files). */
export function filesFromClipboard(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return []
  const out: File[] = []
  const seen = new Set<string>()

  const push = (file: File | null | undefined) => {
    if (!file || (!isImageFile(file) && !isDocumentFile(file))) return
    const key = `${file.name}-${file.size}-${file.lastModified}-${file.type}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(file)
  }

  if (clipboardData.files?.length) {
    Array.from(clipboardData.files).forEach((f) => push(f))
  }

  if (clipboardData.items?.length) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind !== "file") continue
      push(item.getAsFile())
    }
  }

  return out
}

/**
 * Collect files from a drag-and-drop DataTransfer, including folders
 * (via webkitGetAsEntry) so relative paths survive for grid/layer mapping.
 */
export async function filesFromDataTransfer(
  dataTransfer: DataTransfer | null
): Promise<File[]> {
  if (!dataTransfer) return []
  const items = dataTransfer.items
  if (items?.length) {
    const collected: File[] = []
    const tasks: Promise<void>[] = []

    for (const item of Array.from(items)) {
      if (item.kind !== "file") continue
      const entry =
        typeof item.webkitGetAsEntry === "function"
          ? item.webkitGetAsEntry()
          : null
      if (entry?.isDirectory) {
        tasks.push(
          readDirectoryEntry(entry as FileSystemDirectoryEntry, entry.name).then(
            (files) => {
              collected.push(...files)
            }
          )
        )
      } else if (entry?.isFile) {
        tasks.push(
          new Promise<void>((resolve, reject) => {
            ;(entry as FileSystemFileEntry).file((file) => {
              collected.push(withRelativePath(file, file.name))
              resolve()
            }, reject)
          })
        )
      } else {
        const file = item.getAsFile()
        if (file) collected.push(file)
      }
    }

    await Promise.all(tasks)
    if (collected.length) {
      return collected.filter((f) => isImageFile(f) || isDocumentFile(f))
    }
  }

  return Array.from(dataTransfer.files || []).filter(
    (f) => isImageFile(f) || isDocumentFile(f)
  )
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
