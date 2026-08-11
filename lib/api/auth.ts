"use client"

import { api } from "@/lib/api/client"
import type { AccessTokenResponse, AuthTokenResponse, AuthUser } from "@/lib/api/types"

export type { AuthUser, AuthTokenResponse, AccessTokenResponse }

export const authApi = {
  register(input: { name: string; email: string; password: string }) {
    return api.post<AuthTokenResponse>("/auth/register", input, { skipAuth: true })
  },

  login(input: { email: string; password: string }) {
    return api.post<AuthTokenResponse>("/auth/login", input, { skipAuth: true })
  },

  refresh() {
    return api.post<AccessTokenResponse>("/auth/refresh", undefined, {
      skipAuth: true,
      skipRefresh: true,
    })
  },

  logout() {
    return api.post<{ message: string }>("/auth/logout", undefined, {
      skipAuth: true,
      skipRefresh: true,
    })
  },

  me() {
    return api.get<AuthUser>("/auth/me")
  },
}
