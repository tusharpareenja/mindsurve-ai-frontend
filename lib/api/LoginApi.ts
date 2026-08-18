/**
 * Unilever study-engine API base (analytics live on Unilever, JWT is shared).
 * Example: http://127.0.0.1:5000/api/v1
 */
export function resolveUnileverApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_UNILEVER_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    ""
  if (raw) return raw.replace(/\/+$/, "")
  // Local Unilever default used by MindSurve backend .env
  return "http://127.0.0.1:5000/api/v1"
}

export const UNILEVER_API_BASE_URL = resolveUnileverApiBaseUrl()

/** Alias used by ported Unilever modules that import API_BASE_URL from LoginApi. */
export const API_BASE_URL = UNILEVER_API_BASE_URL
