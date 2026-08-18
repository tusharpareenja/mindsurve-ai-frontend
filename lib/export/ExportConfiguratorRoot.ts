import type { LocalSavedDesignsStore } from "@/lib/export/savedDesignLocalStorage"
import type { ApiDesignConstraint } from "@/lib/utils/designConstraintsStorage"

/** Payload shape embedded in standalone HTML exports (matches Unilever export bundle). */
export interface ExportConfiguratorPayload {
  studyId: string
  studyTitle: string
  studyType: string
  exportedAt: string
  analysisData: unknown
  designConstraints?: ApiDesignConstraint[]
  studyLayers?: unknown[]
  savedDesigns: LocalSavedDesignsStore
}
