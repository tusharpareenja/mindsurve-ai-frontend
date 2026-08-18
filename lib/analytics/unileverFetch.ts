"use client"

import {
  ensureAccessToken,
  forceRefreshAccessToken,
  getAccessToken,
} from "@/lib/api/client"

function isUnileverAuthFailure(res: Response): boolean {
  // Missing Bearer → FastAPI HTTPBearer returns 403 "Not authenticated".
  // Bad/expired JWT → 401 "Could not validate credentials".
  return res.status === 401 || res.status === 403
}

/**
 * Call Unilever study-engine APIs with the MindSurve access JWT.
 * Secrets must match (`JWT_SECRET_KEY` on both backends).
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retry = true
): Promise<Response> {
  let token = getAccessToken()
  if (!token) {
    token = await ensureAccessToken()
  }

  const headers = new Headers(init.headers || {})
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const res = await fetch(input, { ...init, headers })
  if (!isUnileverAuthFailure(res) || !retry) return res

  // Cookie refresh → new access token in AuthContext, then one retry.
  const refreshed = await forceRefreshAccessToken()
  if (!refreshed) return res

  const headers2 = new Headers(init.headers || {})
  headers2.set("Authorization", `Bearer ${refreshed}`)
  return fetch(input, { ...init, headers: headers2 })
}
