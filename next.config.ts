import type { NextConfig } from "next"

/**
 * Browser calls NEXT_PUBLIC_API_BASE_URL (same-origin /api/v1 by default).
 * `/api/v1/*` is handled by `app/api/v1/[...path]/route.ts` (long timeout)
 * so AI turns with attachments do not hit the short rewrite proxy limit.
 */
const nextConfig: NextConfig = {}

export default nextConfig
