"use client"

import { API_BASE_URL } from "@/lib/api/config"
import { ApiError, type ApiErrorBody } from "@/lib/api/types"
import { runSingleFlightRefresh } from "@/lib/api/refresh"

type TokenAccessor = {
  getAccessToken: () => string | null
  setAccessToken: (token: string | null) => void
  onAuthFailure: () => void
}

let tokenAccessor: TokenAccessor | null = null

/** Wire AuthProvider memory token into the shared API client. */
export function bindAuthTokenAccessor(accessor: TokenAccessor): void {
  tokenAccessor = accessor
}

/** Current in-memory access token (for WebSocket auth). Never log this. */
export function getAccessToken(): string | null {
  return tokenAccessor?.getAccessToken() ?? null
}

function joinUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${normalized}`
}

function messageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback
  const detail = (body as ApiErrorBody).detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg)
  return fallback
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function refreshAccessToken(): Promise<string | null> {
  return runSingleFlightRefresh(async () => {
    const response = await fetch(joinUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
    if (!response.ok) {
      tokenAccessor?.setAccessToken(null)
      return null
    }
    const data = (await response.json()) as { access_token?: string }
    const token = data.access_token ?? null
    tokenAccessor?.setAccessToken(token)
    return token
  })
}

/** Ensure an access token exists (refresh via HttpOnly cookie if needed). */
export async function ensureAccessToken(): Promise<string | null> {
  const existing = getAccessToken()
  if (existing) return existing
  return refreshAccessToken()
}

/** Force a new access token from the refresh cookie (updates AuthContext memory). */
export async function forceRefreshAccessToken(): Promise<string | null> {
  return refreshAccessToken()
}

export type RequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  /** Skip Authorization header (login/register/refresh). */
  skipAuth?: boolean
  /** Internal: prevent infinite refresh retry loops. */
  _retry?: boolean
  /** Skip automatic 401→refresh→retry (used by refresh itself). */
  skipRefresh?: boolean
  /** Send body as FormData (do not set JSON Content-Type). */
  formData?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    skipAuth = false,
    _retry = false,
    skipRefresh = false,
    formData = false,
  } = options

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  }

  if (body !== undefined && !formData) {
    requestHeaders["Content-Type"] = "application/json"
  }

  if (!skipAuth) {
    const token = tokenAccessor?.getAccessToken()
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`
    }
  }

  let requestBody: BodyInit | undefined
  if (body !== undefined) {
    requestBody = formData ? (body as FormData) : JSON.stringify(body)
  }

  const response = await fetch(joinUrl(path), {
    method,
    credentials: "include",
    headers: requestHeaders,
    body: requestBody,
  })

  if (response.status === 401 && !skipAuth && !skipRefresh && !_retry) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      return apiRequest<T>(path, { ...options, _retry: true })
    }
    tokenAccessor?.onAuthFailure()
    const errBody = await parseJsonSafe(response)
    throw new ApiError(
      messageFromBody(errBody, "Session expired. Please sign in again."),
      401,
      errBody
    )
  }

  const parsed = await parseJsonSafe(response)
  if (!response.ok) {
    throw new ApiError(
      messageFromBody(parsed, `Request failed (${response.status})`),
      response.status,
      parsed
    )
  }

  return parsed as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
  upload: <T>(path: string, form: FormData, options?: Omit<RequestOptions, "method" | "body" | "formData">) =>
    apiRequest<T>(path, { ...options, method: "POST", body: form, formData: true }),
}
