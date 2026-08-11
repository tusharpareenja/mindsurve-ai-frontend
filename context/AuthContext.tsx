"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { authApi } from "@/lib/api/auth"
import { bindAuthTokenAccessor } from "@/lib/api/client"
import { ApiError } from "@/lib/api/types"
import type { User } from "@/types"

export type AuthStatus = "AUTH_LOADING" | "AUTHENTICATED" | "UNAUTHENTICATED"

type AuthResult = { ok: true } | { ok: false; error: string }

type AuthContextValue = {
  user: User | null
  status: AuthStatus
  isLoading: boolean
  isAuthenticated: boolean
  accessToken: string | null
  login: (email: string, password: string) => Promise<AuthResult>
  register: (name: string, email: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toUser(u: { id: string; name: string; email: string }): User {
  return { id: u.id, name: u.name, email: u.email }
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>("AUTH_LOADING")
  const accessTokenRef = useRef<string | null>(null)
  const [accessToken, setAccessTokenState] = useState<string | null>(null)

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token
    setAccessTokenState(token)
  }, [])

  const clearAuth = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus("UNAUTHENTICATED")
  }, [setAccessToken])

  useEffect(() => {
    bindAuthTokenAccessor({
      getAccessToken: () => accessTokenRef.current,
      setAccessToken,
      onAuthFailure: () => {
        setAccessToken(null)
        setUser(null)
        setStatus("UNAUTHENTICATED")
      },
    })
  }, [setAccessToken])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      setStatus("AUTH_LOADING")
      try {
        // HttpOnly refresh cookie → new access token (no localStorage).
        const refreshed = await authApi.refresh()
        if (cancelled) return
        setAccessToken(refreshed.access_token)
        const me = await authApi.me()
        if (cancelled) return
        setUser(toUser(me))
        setStatus("AUTHENTICATED")
      } catch {
        if (cancelled) return
        clearAuth()
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [clearAuth, setAccessToken])

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const data = await authApi.login({ email: email.trim(), password })
        setAccessToken(data.access_token)
        setUser(toUser(data.user))
        setStatus("AUTHENTICATED")
        return { ok: true }
      } catch (err) {
        clearAuth()
        return {
          ok: false,
          error: errorMessage(err, "Invalid email or password."),
        }
      }
    },
    [clearAuth, setAccessToken]
  )

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      try {
        const data = await authApi.register({
          name: name.trim(),
          email: email.trim(),
          password,
        })
        setAccessToken(data.access_token)
        setUser(toUser(data.user))
        setStatus("AUTHENTICATED")
        return { ok: true }
      } catch (err) {
        return {
          ok: false,
          error: errorMessage(err, "We couldn’t create your account. Please try again."),
        }
      }
    },
    [setAccessToken]
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Still clear local auth even if network fails
    } finally {
      clearAuth()
    }
  }, [clearAuth])

  const value = useMemo(
    () => ({
      user,
      status,
      isLoading: status === "AUTH_LOADING",
      isAuthenticated: status === "AUTHENTICATED",
      accessToken,
      login,
      register,
      logout,
    }),
    [user, status, accessToken, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
