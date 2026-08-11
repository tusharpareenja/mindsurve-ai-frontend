/**
 * Central API base URL. All client requests must use this — never hardcode hosts.
 *
 * Prefer a same-origin path so the HttpOnly refresh cookie is first-party:
 *   NEXT_PUBLIC_API_BASE_URL=/api/v1
 *
 * Next.js rewrites `/api/v1/*` → BACKEND_URL (see next.config.ts).
 * Pointing this at http://127.0.0.1:8000 (cross-origin) breaks session restore.
 */
function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  if (!raw) {
    return "/api/v1"
  }
  return raw.replace(/\/+$/, "")
}

export const API_BASE_URL = resolveApiBaseUrl()
