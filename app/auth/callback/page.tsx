"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { BrandName } from "@/components/brand/BrandName"
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/components/feedback/Toaster"

/**
 * After Google OAuth, exchange the Google profile for MindSurve JWT + refresh cookie.
 */
export default function AuthCallbackPage() {
  const { data: session, status } = useSession()
  const { loginWithOAuth, isAuthenticated } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(true)
  const started = useRef(false)

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/welcome")
      return
    }
    if (status === "loading" || started.current) return
    if (status === "unauthenticated") {
      toast({
        type: "error",
        title: "Google sign-in cancelled",
        description: "Please try again.",
      })
      router.replace("/login")
      return
    }
    if (status !== "authenticated" || !session?.user?.email) return

    started.current = true
    void (async () => {
      setBusy(true)
      const result = await loginWithOAuth({
        email: session.user!.email!,
        name: session.user!.name || session.user!.email!.split("@")[0] || "User",
        provider: "google",
        provider_id: session.user!.email || undefined,
        profile_picture: session.user!.image || undefined,
      })
      if (!result.ok) {
        toast({
          type: "error",
          title: "Couldn't finish Google sign-in",
          description: result.error ?? "Please try again.",
        })
        router.replace("/login")
        return
      }
      toast({
        type: "success",
        title: "Signed in",
        description: "Welcome to MindSurve.",
      })
      router.replace("/welcome")
    })()
  }, [
    status,
    session,
    isAuthenticated,
    loginWithOAuth,
    router,
    toast,
  ])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <BrandName withAi className="mb-6 text-2xl" />
      <div className="flex items-center gap-3 text-sm text-gray-600">
        {(busy || status === "loading") && (
          <Loader2 className="size-5 animate-spin text-blue-500" aria-hidden />
        )}
        <span>Completing Google sign-in…</span>
      </div>
    </main>
  )
}
