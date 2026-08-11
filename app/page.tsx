"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Skeleton } from "@/components/feedback/Skeleton"

/**
 * Root entry: wait for session check, then send users to /welcome or /login.
 */
export default function RootPage() {
  const router = useRouter()
  const { status } = useAuth()

  useEffect(() => {
    if (status === "AUTH_LOADING") return
    if (status === "AUTHENTICATED") {
      router.replace("/welcome")
      return
    }
    router.replace("/login")
  }, [status, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="mx-auto h-6 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  )
}
