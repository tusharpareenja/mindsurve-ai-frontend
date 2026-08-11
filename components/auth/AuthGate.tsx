"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Skeleton } from "@/components/feedback/Skeleton"

const AUTH_PATHS = ["/", "/login", "/register", "/signup"]

type AuthGateProps = {
  children: React.ReactNode
  /** When true, only authenticated users may view */
  requireAuth?: boolean
  /** When true, authenticated users are redirected away (auth pages) */
  guestOnly?: boolean
}

/**
 * Route guard based on validated auth status (not mere token presence).
 */
export function AuthGate({
  children,
  requireAuth = false,
  guestOnly = false,
}: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return

    if (requireAuth && !isAuthenticated) {
      router.replace("/login")
      return
    }

    if (guestOnly && isAuthenticated) {
      router.replace("/welcome")
    }
  }, [isLoading, isAuthenticated, requireAuth, guestOnly, router, pathname])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="mx-auto h-6 w-40" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (requireAuth && !isAuthenticated) return null
  if (guestOnly && isAuthenticated) return null

  return <>{children}</>
}

export function isAuthPath(pathname: string) {
  return AUTH_PATHS.includes(pathname)
}
