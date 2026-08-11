import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

type BrandNameProps = {
  className?: string
  /** When true, appends " AI" (navbar: MindSurve AI) */
  withAi?: boolean
  /** Use on dark surfaces (login) */
  dark?: boolean
}

/** Simple text brand mark — Mind (accent) + Surve (+ optional AI). Not a logo image. */
export function BrandName({ className, withAi = false, dark = false }: BrandNameProps) {
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      <span style={{ color: BRAND.accent }}>{BRAND.prefix}</span>
      <span className={dark ? "text-white" : "text-gray-800"}>{BRAND.suffix}</span>
      {withAi && (
        <span className={dark ? "text-white" : "text-gray-800"}> AI</span>
      )}
    </span>
  )
}
