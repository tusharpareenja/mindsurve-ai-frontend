"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/components/feedback/Toaster"
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary"
import { AuthProvider } from "@/context/AuthContext"
import { ProjectsProvider } from "@/context/ProjectsContext"
import { ChatsProvider } from "@/context/ChatsContext"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <AuthProvider>
          <ProjectsProvider>
            <ChatsProvider>
              <ErrorBoundary>{children}</ErrorBoundary>
            </ChatsProvider>
          </ProjectsProvider>
        </AuthProvider>
      </ToastProvider>
    </SessionProvider>
  )
}
