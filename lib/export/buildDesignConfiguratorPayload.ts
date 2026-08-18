/* eslint-disable @typescript-eslint/no-explicit-any */
import { listSavedDesigns, type SavedDesignPayload } from "@/lib/api/StudyAPI"
import { prepareSavedDesignsForExport } from "@/lib/export/savedDesignLocalStorage"
import type { ApiDesignConstraint } from "@/lib/utils/designConstraintsStorage"

export interface DesignConfiguratorExportPayload {
  studyId: string
  studyTitle: string
  studyType: string
  exportedAt: string
  analysisData: any
  designConstraints?: ApiDesignConstraint[]
  studyLayers?: any[]
  savedDesigns: {
    configurator: SavedDesignPayload[]
    input: SavedDesignPayload[]
  }
}

export async function buildDesignConfiguratorPayload(input: {
  studyId: string
  studyTitle: string
  studyType: string
  analysisData: any
  designConstraints?: ApiDesignConstraint[]
  studyLayers?: any[]
}): Promise<DesignConfiguratorExportPayload> {
  const [configurator, inputDesigns] = await Promise.all([
    listSavedDesigns(input.studyId, "configurator").catch(() => []),
    listSavedDesigns(input.studyId, "input").catch(() => []),
  ])

  return {
    studyId: input.studyId,
    studyTitle: input.studyTitle,
    studyType: input.studyType,
    exportedAt: new Date().toISOString(),
    analysisData: input.analysisData,
    designConstraints: input.designConstraints || [],
    studyLayers: input.studyLayers || [],
    savedDesigns: prepareSavedDesignsForExport({
      configurator,
      input: inputDesigns,
    }),
  }
}
