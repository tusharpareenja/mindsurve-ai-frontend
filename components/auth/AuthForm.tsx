"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { BrandName } from "@/components/brand/BrandName"
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"

type AuthFormMode = "login" | "register"

type AuthFormProps = {
  mode: AuthFormMode
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { login, register } = useAuth()
  const isLogin = mode === "login"

  const [showPassword, setShowPassword] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  })

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      await signIn("google", { callbackUrl: "/auth/callback" })
    } catch {
      toast({
        type: "error",
        title: "Google sign-in failed",
        description: "Please try again.",
      })
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email.trim() || !formData.password.trim() || (!isLogin && !formData.name.trim())) {
      toast({
        type: "error",
        title: "Missing details",
        description: "Please fill out all required fields.",
      })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      toast({
        type: "error",
        title: "Invalid email",
        description: "Please enter a valid email address.",
      })
      return
    }

    if (formData.password.length < 8) {
      toast({
        type: "error",
        title: "Password too short",
        description: "Use at least 8 characters.",
      })
      return
    }

    setSubmitting(true)
    try {
      const result = isLogin
        ? await login(formData.email, formData.password)
        : await register(formData.name, formData.email, formData.password)

      if (!result.ok) {
        toast({
          type: "error",
          title: isLogin ? "Couldn't sign in" : "Couldn't create account",
          description: result.error ?? "Please try again.",
        })
        return
      }

      toast({
        type: "success",
        title: isLogin ? "Signed in" : "Account created",
        description: "Welcome to MindSurve.",
      })
      router.replace("/welcome")
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-500/10 via-blue-500/5 to-transparent blur-2xl" />

      <div className="relative z-10 animate-in fade-in-0 slide-in-from-bottom-4 duration-700 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <BrandName withAi className="text-2xl" />
          <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-900">
            {isLogin ? "Sign in to your account" : "Create an account"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isLogin ? (
              <>
                Or{" "}
                <Link
                  href="/register"
                  className="cursor-pointer font-medium text-blue-600 transition-colors hover:text-blue-500"
                >
                  create new account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="cursor-pointer font-medium text-blue-600 transition-colors hover:text-blue-500"
                >
                  sign in instead
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white px-4 py-8 shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
                  <Label htmlFor="name" className="text-gray-900">
                    Full name
                  </Label>
                  <div className="mt-2">
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required={!isLogin}
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="John Doe"
                      className="border-gray-300 bg-white text-gray-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="email" className="text-gray-900">
                  Email address
                </Label>
                <div className="mt-2">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    className="border-gray-300 bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-gray-900">
                  Password
                </Label>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="border-gray-300 bg-white pr-10 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="cursor-pointer text-sm font-medium text-blue-600 transition-colors hover:text-blue-500"
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || googleLoading}
                className="flex w-full cursor-pointer justify-center bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isLogin ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 uppercase tracking-wide text-gray-400">
                  or
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={submitting || googleLoading}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="size-4 animate-spin text-gray-500" />
              ) : (
                <>
                  <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <div className="mt-6 text-center text-sm text-gray-500">
              By clicking continue, you agree to our{" "}
              <Link href="#" className="cursor-pointer font-medium text-blue-600 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="#" className="cursor-pointer font-medium text-blue-600 hover:underline">
                Privacy Policy
              </Link>
              .
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  )
}
