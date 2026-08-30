"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { BrandName } from "@/components/brand/BrandName"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api/auth"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const token = searchParams.get("token")?.trim() ?? ""

  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    let active = true

    async function validate() {
      if (!token) {
        setValidating(false)
        return
      }
      try {
        const result = await authApi.validateResetToken(token)
        if (active) setTokenValid(result.valid)
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Reset-link validation failed", error)
        }
        if (active) {
          toast({
            type: "error",
            title: "We couldn’t verify this link",
            description: "Please check your connection and try opening the link again.",
          })
        }
      } finally {
        if (active) setValidating(false)
      }
    }

    void validate()
    return () => {
      active = false
    }
  }, [token, toast])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      toast({
        type: "error",
        title: "Password too short",
        description: "Use at least 8 characters.",
      })
      return
    }
    if (password !== confirmation) {
      toast({
        type: "error",
        title: "Passwords don’t match",
        description: "Enter the same password in both fields.",
      })
      return
    }

    setSubmitting(true)
    try {
      await authApi.resetPassword({ token, new_password: password })
      setComplete(true)
      setPassword("")
      setConfirmation("")
      toast({
        type: "success",
        title: "Password updated",
        description: "Sign in with your new password to continue.",
      })
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Password reset failed", error)
      }
      setTokenValid(false)
      toast({
        type: "error",
        title: "This link can’t be used",
        description: "It may have expired or already been used. Request a new reset link.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-500/10 via-blue-500/5 to-transparent blur-2xl" />
      <section className="relative z-10 w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <BrandName withAi className="text-2xl" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900">
            {complete ? "Your password is ready" : "Choose a new password"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {complete
              ? "Your other MindSurve sessions have been signed out for security."
              : "Use a password you don’t use on another account."}
          </p>
        </div>

        <div className="mt-8 rounded-xl bg-white px-5 py-8 shadow-sm ring-1 ring-gray-900/5 sm:px-10">
          {validating ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <Loader2 className="size-8 animate-spin text-blue-600" />
              <p className="mt-4 text-sm font-medium text-gray-700">Checking your secure link…</p>
              <p className="mt-1 text-xs text-gray-500">This should only take a moment.</p>
            </div>
          ) : complete ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <CheckCircle2 className="size-12 text-emerald-600" />
              <p className="mt-4 text-sm text-gray-600">
                You can now use your new password to access MindSurve.
              </p>
              <Button
                type="button"
                onClick={() => router.replace("/login")}
                className="mt-6 h-11 w-full cursor-pointer bg-blue-600 text-white hover:bg-blue-500"
              >
                Continue to sign in
              </Button>
            </div>
          ) : !tokenValid ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-amber-50">
                <KeyRound className="size-6 text-amber-600" />
              </div>
              <h2 className="mt-4 font-semibold text-gray-900">This reset link has expired</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Reset links are single-use and expire after 60 minutes. Return to sign in to
                request a new one.
              </p>
              <Button asChild className="mt-6 h-11 w-full bg-blue-600 text-white hover:bg-blue-500">
                <Link href="/login" className="cursor-pointer">Return to sign in</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="new-password" className="text-gray-900">New password</Label>
                <div className="relative mt-2">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 border-gray-300 bg-white pr-11 text-gray-900"
                    required
                    minLength={8}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">At least 8 characters.</p>
              </div>

              <div>
                <Label htmlFor="confirm-password" className="text-gray-900">
                  Confirm new password
                </Label>
                <div className="relative mt-2">
                  <Input
                    id="confirm-password"
                    type={showConfirmation ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="h-11 border-gray-300 bg-white pr-11 text-gray-900"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmation((shown) => !shown)}
                    className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                    aria-label={showConfirmation ? "Hide password" : "Show password"}
                  >
                    {showConfirmation ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full cursor-pointer bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Updating password…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

function ResetPasswordFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <Loader2 className="size-8 animate-spin text-blue-600" aria-label="Loading" />
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
