"use client"

import { AuthGate } from "@/components/auth/AuthGate"
import { AuthForm } from "@/components/auth/AuthForm"

export default function LoginPage() {
  return (
    <AuthGate guestOnly>
      <AuthForm mode="login" />
    </AuthGate>
  )
}
