"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog } from "@/components/feedback/Dialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api/auth"

type ForgotPasswordDialogProps = {
  open: boolean
  onClose: () => void
}

export function ForgotPasswordDialog({ open, onClose }: ForgotPasswordDialogProps) {
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const resetAndClose = () => {
    setEmail("")
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      toast({
        type: "error",
        title: "Email required",
        description: "Please enter your email address.",
      })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({
        type: "error",
        title: "Invalid email",
        description: "Please enter a valid email address.",
      })
      return
    }

    setSubmitting(true)
    try {
      await authApi.forgotPassword({ email: trimmed })
      toast({
        type: "success",
        title: "Check your email",
        description: "If an account exists, we sent a secure reset link.",
      })
      resetAndClose()
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Password reset request failed", error)
      }
      toast({
        type: "error",
        title: "We couldn’t send the link",
        description: "Please check your connection and try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={resetAndClose} title="Forgot password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Enter your email and we’ll send you a link to reset your password.
        </p>
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border-gray-300"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={resetAndClose}
            disabled={submitting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="cursor-pointer bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
