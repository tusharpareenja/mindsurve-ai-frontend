export const DESIGN_CONSTRAINTS_STORAGE_KEY = 'cs_step5_layer_design_constraints'

export type StoredConstraintElementRef = {
  layerId: string
  imageId: string
}

export type StoredDesignConstraint = {
  id: string
  name: string
  anchors: StoredConstraintElementRef[]
  blocked: StoredConstraintElementRef[]
  createdAt: number
}

export type ApiDesignConstraintElementRef = {
  layer_id: string
  image_id: string
}

export type ApiDesignConstraint = {
  id?: string
  name: string
  anchors: ApiDesignConstraintElementRef[]
  blocked: ApiDesignConstraintElementRef[]
  created_at?: number
}

const parseElementRef = (item: unknown): StoredConstraintElementRef | null => {
  if (!item || typeof item !== 'object') return null
  const ref = item as Record<string, unknown>
  const layerId = String(ref.layerId ?? ref.layer_id ?? '').trim()
  const imageId = String(ref.imageId ?? ref.image_id ?? '').trim()
  if (!layerId || !imageId) return null
  return { layerId, imageId }
}

export const normalizeStoredDesignConstraint = (item: unknown, index: number): StoredDesignConstraint | null => {
  if (!item || typeof item !== 'object') return null
  const raw = item as Record<string, unknown>

  const blocked = Array.isArray(raw.blocked)
    ? raw.blocked.map(parseElementRef).filter((entry): entry is StoredConstraintElementRef => Boolean(entry))
    : []

  let anchors: StoredConstraintElementRef[] = []
  if (Array.isArray(raw.anchors) && raw.anchors.length > 0) {
    anchors = raw.anchors
      .map(parseElementRef)
      .filter((entry): entry is StoredConstraintElementRef => Boolean(entry))
  } else {
    const legacyAnchor = parseElementRef({
      layerId: raw.anchorLayerId ?? raw.anchor_layer_id,
      imageId: raw.anchorImageId ?? raw.anchor_image_id,
    })
    if (legacyAnchor) anchors = [legacyAnchor]
  }

  const id = String(raw.id ?? '').trim() || crypto.randomUUID()
  if (anchors.length === 0 || blocked.length === 0) return null

  const name = typeof raw.name === 'string' && raw.name.trim()
    ? raw.name.trim()
    : `Design Constraint ${index + 1}`

  return {
    id,
    name,
    anchors,
    blocked,
    createdAt: typeof raw.created_at === 'number'
      ? raw.created_at
      : typeof raw.createdAt === 'number'
        ? raw.createdAt
        : Date.now(),
  }
}

export function readDesignConstraintsFromLocalStorage(): StoredDesignConstraint[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DESIGN_CONSTRAINTS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => normalizeStoredDesignConstraint(item, index))
      .filter((item): item is StoredDesignConstraint => Boolean(item))
  } catch {
    return []
  }
}

export function writeDesignConstraintsToLocalStorage(constraints: StoredDesignConstraint[]): void {
  if (typeof window === 'undefined') return
  try {
    if (constraints.length > 0) {
      localStorage.setItem(DESIGN_CONSTRAINTS_STORAGE_KEY, JSON.stringify(constraints))
    } else {
      localStorage.removeItem(DESIGN_CONSTRAINTS_STORAGE_KEY)
    }
  } catch { }
}

export function alignDesignConstraintsWithStudyLayers(
  constraints: StoredDesignConstraint[],
  studyLayers: unknown[],
): StoredDesignConstraint[] {
  const layerIdByAny = new Map<string, string>()
  const imageIdByAny = new Map<string, string>()

  studyLayers.forEach((layer) => {
    if (!layer || typeof layer !== 'object') return
    const rawLayer = layer as Record<string, unknown>
    const canonicalLayerId = String(rawLayer.layer_id ?? rawLayer.id ?? '').trim()
    if (!canonicalLayerId) return

    ;[rawLayer.id, rawLayer.layer_id].forEach((value) => {
      const key = String(value ?? '').trim()
      if (key) layerIdByAny.set(key, canonicalLayerId)
    })

    const images = Array.isArray(rawLayer.images) ? rawLayer.images : []
    images.forEach((image) => {
      if (!image || typeof image !== 'object') return
      const rawImage = image as Record<string, unknown>
      const canonicalImageId = String(rawImage.image_id ?? rawImage.id ?? '').trim()
      if (!canonicalImageId) return

      ;[rawImage.id, rawImage.image_id].forEach((value) => {
        const key = String(value ?? '').trim()
        if (key) imageIdByAny.set(key, canonicalImageId)
      })
    })
  })

  const remapRef = (ref: StoredConstraintElementRef): StoredConstraintElementRef => ({
    layerId: layerIdByAny.get(ref.layerId) || ref.layerId,
    imageId: imageIdByAny.get(ref.imageId) || ref.imageId,
  })

  return constraints.map((constraint) => ({
    ...constraint,
    anchors: constraint.anchors.map(remapRef),
    blocked: constraint.blocked.map(remapRef),
  }))
}

export function parseDesignConstraintsFromStudyDetails(studyDetails: {
  design_constraints?: unknown
  study_layers?: unknown
} | null | undefined): StoredDesignConstraint[] {
  const raw = studyDetails?.design_constraints
  if (!Array.isArray(raw)) return []

  let constraints = raw
    .map((item, index) => normalizeStoredDesignConstraint(item, index))
    .filter((item): item is StoredDesignConstraint => Boolean(item))

  if (Array.isArray(studyDetails?.study_layers) && studyDetails.study_layers.length > 0) {
    constraints = alignDesignConstraintsWithStudyLayers(constraints, studyDetails.study_layers)
  }

  return constraints
}

export function persistDesignConstraintsFromStudyDetails(studyDetails: {
  design_constraints?: unknown
  study_layers?: unknown
} | null | undefined): void {
  writeDesignConstraintsToLocalStorage(parseDesignConstraintsFromStudyDetails(studyDetails))
}

export function designConstraintsToApiPayload(constraints: StoredDesignConstraint[]): ApiDesignConstraint[] {
  return constraints.map((constraint) => ({
    id: constraint.id,
    name: constraint.name,
    anchors: constraint.anchors.map((item) => ({
      layer_id: item.layerId,
      image_id: item.imageId,
    })),
    blocked: constraint.blocked.map((item) => ({
      layer_id: item.layerId,
      image_id: item.imageId,
    })),
    created_at: constraint.createdAt,
  }))
}
