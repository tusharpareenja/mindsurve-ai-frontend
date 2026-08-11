"use client"

import { AuthGate } from "@/components/auth/AuthGate"
import { AuthForm } from "@/components/auth/AuthForm"

export default function RegisterPage() {
  return (
    <AuthGate guestOnly>
      <AuthForm mode="register" />
    </AuthGate>
  )
}
