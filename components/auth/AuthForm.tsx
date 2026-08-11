"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  })

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
                disabled={submitting}
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
