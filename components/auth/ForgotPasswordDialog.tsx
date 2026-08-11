"use client"

import { useState } from "react"
import { Dialog } from "@/components/feedback/Dialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ForgotPasswordDialogProps = {
  open: boolean
  onClose: () => void
}

export function ForgotPasswordDialog({ open, onClose }: ForgotPasswordDialogProps) {
  const { toast } = useToast()
  const [email, setEmail] = useState("")

  const resetAndClose = () => {
    setEmail("")
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
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

    // Password-reset API is not part of this auth phase.
    toast({
      type: "success",
      title: "Check your email",
      description: "If an account exists, we sent a reset link.",
    })
    resetAndClose()
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
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button type="submit" className="cursor-pointer bg-blue-600 text-white hover:bg-blue-500">
            Send reset link
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
