export type BrandId = "mindsurve" | "mindsurf"

export type BrandConfig = {
  id: BrandId
  displayName: string
  prefix: "Mind"
  suffix: "Surve" | "Surf"
  aiName: string
}

const BRANDS: Record<BrandId, BrandConfig> = {
  mindsurve: {
    id: "mindsurve",
    displayName: "Mindsurve",
    prefix: "Mind",
    suffix: "Surve",
    aiName: "Mindsurve AI",
  },
  mindsurf: {
    id: "mindsurf",
    displayName: "Mindsurf",
    prefix: "Mind",
    suffix: "Surf",
    aiName: "Mindsurf AI",
  },
}

function normalizeBrandId(raw: string | undefined): BrandId {
  const value = (raw || "mindsurve").trim().toLowerCase()
  if (value === "mindsurf") return "mindsurf"
  return "mindsurve"
}

export function getBrandId(): BrandId {
  return normalizeBrandId(process.env.NEXT_PUBLIC_BRAND_NAME)
}

export function getBrand(): BrandConfig {
  return BRANDS[getBrandId()]
}
